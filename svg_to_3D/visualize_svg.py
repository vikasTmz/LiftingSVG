#!/usr/bin/env python3
"""Render an SVG and export isolated layers, controls, and editable text labels.

Example: python visualize_svg.py animation.svg --duration 4 --fps 30
Use --layers-only to save six SVG variants per layer: three original and
three normalized. Groups stay together; IDs follow back-to-front paint order.
Empty layers are skipped; isolated layers ignore scene masks and clipping.
Animated controls are
sampled at --fps and saved as native SVG animations, without JavaScript.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright
from svgpathtools import Arc, CubicBezier, Line, QuadraticBezier, parse_path

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
CONTROL_ARTWORK_OPACITY = 0.45
NORMALIZED_PADDING = 0.12
SVG_RESOURCES = {
    "defs",
    "style",
    "metadata",
    "title",
    "desc",
    "animate",
    "animateTransform",
    "animateMotion",
    "set",
}


def clock_value(value):
    value = value.strip()
    if re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:h|min|ms|s)?", value):
        match = re.fullmatch(r"([+-]?[\d.]+)(h|min|ms|s)?", value)
        return (
            float(match[1])
            * {None: 1, "s": 1, "ms": 0.001, "min": 60, "h": 3600}[match[2]]
        )
    if re.fullmatch(r"\d+:\d{2}(?::\d{2})?(?:\.\d+)?", value):
        result = 0.0
        for part in value.split(":"):
            result = result * 60 + float(part)
        return result
    return None


def inspect_svg(path):
    raw = path.read_bytes()
    if b"<!ENTITY" in raw.upper() or b"<?XML-STYLESHEET" in raw.upper():
        raise ValueError(
            "External XML entities/stylesheets are unsupported; embed the artwork and styles."
        )
    root = ET.fromstring(raw)
    if root.tag != f"{{{SVG_NS}}}svg":
        raise ValueError("Input must be an SVG document with the SVG namespace.")
    metadata = {}
    duration, ambiguous = 0.0, False
    for node in root.iter():
        name = node.tag.rsplit("}", 1)[-1]
        if name in {
            "script",
            "foreignObject",
            "image",
            "text",
            "use",
            "feImage",
            "feDisplacementMap",
        }:
            raise ValueError(
                f"<{name}> is unsupported for geometric inspection. Convert it to ordinary vector paths first."
            )
        if name == "metadata" and node.text:
            try:
                value = json.loads(node.text)
                if isinstance(value, dict):
                    metadata.update(value)
            except (ValueError, TypeError):
                pass
        for key, value in node.attrib.items():
            local = key.rsplit("}", 1)[-1]
            if local.lower().startswith("on"):
                raise ValueError(
                    "Script/event-handler animation is unsupported; use SVG or CSS animation."
                )
            if local in {"href", "src"} and value and not value.startswith("#"):
                raise ValueError(
                    "External asset references are unsupported; embed vector artwork first."
                )
        if name in {"animate", "animateTransform", "animateMotion", "set"}:
            dur = clock_value(node.get("dur", ""))
            begins = [clock_value(s) for s in node.get("begin", "0s").split(";")]
            if dur is None or any(v is None for v in begins):
                ambiguous = True
                continue
            repeat = node.get("repeatCount", "1")
            repeat = 1.0 if repeat == "indefinite" else float(repeat)
            total = dur * repeat
            if node.get("repeatDur") not in (None, "indefinite"):
                repeat_duration = clock_value(node.get("repeatDur"))
                if repeat_duration is None:
                    ambiguous = True
                else:
                    total = (
                        min(total, repeat_duration)
                        if node.get("repeatCount")
                        else repeat_duration
                    )
            duration = max(duration, max(begins) + total)
    # Preserve original XML namespaces/styles; do not round-trip through ElementTree.
    text = raw.decode("utf-8-sig")
    text = re.sub(r"<\?xml[^?]*\?>", "", text, flags=re.I)
    text = re.sub(r"<!DOCTYPE[^>]*>", "", text, flags=re.I)
    if re.search(r"@import\b", text, flags=re.I):
        raise ValueError("CSS imports are unsupported; inline the stylesheet.")
    for match in re.finditer(r"url\(\s*['\"]?([^)'\"]+)", text, flags=re.I):
        if not match[1].strip().startswith("#"):
            raise ValueError(
                "Only local SVG fragment references such as url(#gradient) are supported."
            )
    return text, metadata, duration, ambiguous


@lru_cache(maxsize=2048)
def path_controls(d):
    """Return anchors/handle pairs. Arcs get derived cubic controls (<=45° each)."""
    anchors, handles, signature = [], [], []
    segments = parse_path(d)
    last = None
    for segment in segments:
        if last != segment.start:
            signature.append("M")
            anchors.append(segment.start)
        pieces = [segment]
        if isinstance(segment, Arc):
            pieces = list(
                segment.as_cubic_curves(max(1, math.ceil(abs(segment.delta) / 45)))
            )
        for piece in pieces:
            anchors.append(piece.end)
            if isinstance(piece, CubicBezier):
                signature.append("C")
                handles.extend(
                    [(piece.start, piece.control1), (piece.end, piece.control2)]
                )
            elif isinstance(piece, QuadraticBezier):
                signature.append("Q")
                handles.extend(
                    [(piece.start, piece.control), (piece.end, piece.control)]
                )
            elif isinstance(piece, Line):
                signature.append("L")
            else:
                raise ValueError(f"Unsupported path segment: {type(piece).__name__}")
        last = segment.end
    xy = lambda p: [p.real, p.imag]
    return {
        "anchors": [xy(p) for p in anchors],
        "handles": [[xy(a), xy(b)] for a, b in handles],
        "signature": signature,
    }


def deforms(reference, current, tolerance):
    if reference[0] != current[0]:
        return True
    a, b = np.asarray(reference[1]), np.asarray(current[1])
    if a.shape != b.shape:
        return True
    if not a.size:
        return False
    a, b = a - a.mean(axis=0), b - b.mean(axis=0)
    size_a, size_b = np.linalg.norm(a, axis=1).max(), np.linalg.norm(b, axis=1).max()
    scale = max(size_a, size_b, 1.0)
    # A collapse to/from zero can be a scale animation, not evidence of bending.
    if min(size_a, size_b) <= tolerance * scale:
        return False
    u, singular, vt = np.linalg.svd(a.T @ b)
    factor = singular.sum() / max(float((a * a).sum()), 1e-30)
    if np.linalg.norm(a @ (u @ vt) * factor - b, axis=1).max() <= tolerance * scale:
        return False
    transform, _, rank, _ = np.linalg.lstsq(a, b, rcond=None)
    gram = transform @ transform.T
    axes = max(math.sqrt(max(float(gram[0, 0] * gram[1, 1]), 0)), 1e-30)
    return bool(
        rank < 2
        or np.linalg.norm(a @ transform - b, axis=1).max() > tolerance * scale
        or abs(gram[0, 1]) > tolerance * axes
    )


RUNTIME = r"""
const NS='http://www.w3.org/2000/svg', INK='http://www.inkscape.org/namespaces/inkscape';
const SHAPES='path,rect,circle,ellipse,line,polyline,polygon';
const NON_ART='defs,clipPath,mask,pattern,marker,symbol';
let tiles=[], selection=[], size=320;
function add(tag,attrs={}) {
  const e=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,String(v));
  return e;
}
function art(e) {return !e.closest(NON_ART);}
function revealLayer(root) {
  // Scene masks/clips may contain silhouettes of other layers. They must not
  // cut holes in an isolated layer, including through CSS or animated values.
  for(const e of [root,...root.querySelectorAll('*')].filter(art)) {
    for(const property of ['mask','clip-path']) {
      e.removeAttribute(property);
      e.style.setProperty(property,'none','important');
    }
  }
}
function name(e,index) {
  return e.getAttributeNS(INK,'label') || e.getAttribute('aria-label') || e.id || 'Layer '+(index+1);
}
function choose(root,selector,metadata) {
  const disjoint=nodes=>{
    for(const a of nodes) for(const b of nodes)
      if(a!==b && a.contains(b)) throw Error('Layers must select non-overlapping groups/elements');
  };
  if(selector) {
    const nodes=[...root.querySelectorAll(selector)].filter(art);
    if(!nodes.length) throw Error('The layer selector matched no drawable elements');
    disjoint(nodes);
    return nodes.map((e,i)=>({nodes:[e],name:name(e,i)}));
  }
  const marked=[...root.querySelectorAll('[data-layer-id]')].filter(art);
  if(marked.length) {
    disjoint(marked);
    const groups=new Map();
    for(const e of marked) {
      const key=e.getAttribute('data-layer-id');
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(e);
    }
    return [...groups.entries()].map(([key,nodes],i)=>({nodes,name:metadata.layers?.[i] || key}));
  }
  const inkscape=[...root.querySelectorAll('g')].filter(e=>art(e) && e.getAttributeNS(INK,'groupmode')==='layer');
  if(inkscape.length) {
    const outer=inkscape.filter(e=>!inkscape.some(other=>other!==e && other.contains(e)));
    return outer.map((e,i)=>({nodes:[e],name:name(e,i)}));
  }
  const children=e=>[...e.children].filter(c=>art(c) &&
    (c.matches(SHAPES) || ['g','svg','a'].includes(c.localName) && [...c.querySelectorAll(SHAPES)].some(art)));
  let nodes=children(root);
  while(nodes.length===1 && ['g','svg','a'].includes(nodes[0].localName)) {
    const next=children(nodes[0]);
    // Unwrap scene containers, but retain a group that owns drawable elements.
    if(!next.length || next.some(e=>e.matches(SHAPES))) break;
    nodes=next;
  }
  return nodes.map((e,i)=>({nodes:[e],name:name(e,i)}));
}
async function makeTile(svg,label,index) {
  const tile=document.createElement('div');tile.className='tile';
  tile.style.cssText=`width:${size}px;height:${size+62}px;background:#f4f6f8;position:relative;overflow:hidden;outline:1px solid #bbc5d0;outline-offset:-1px`;
  const title=document.createElement('div');title.textContent=label;
  title.style.cssText='height:34px;padding:4px 8px;font:12px sans-serif;box-sizing:border-box;overflow:hidden';
  const holder=document.createElement('div');holder.style.cssText=`position:relative;width:${size}px;height:${size}px`;
  const iframe=document.createElement('iframe');iframe.setAttribute('sandbox','allow-same-origin');
  iframe.style.cssText=`border:0;display:block;width:${size}px;height:${size}px`;
  const overlay=add('svg',{viewBox:`0 0 ${size} ${size}`,width:size,height:size,'data-controls':index>0?'true':'false'});
  overlay.style.cssText='position:absolute;inset:0;pointer-events:none';
  const footer=document.createElement('div');footer.className='footer';
  footer.style.cssText='height:28px;font:10px sans-serif;padding:3px 8px;box-sizing:border-box';
  holder.append(iframe);if(index>0) holder.append(overlay);tile.append(title,holder,footer);
  document.getElementById('grid').append(tile);
  const loaded=new Promise((resolve,reject)=>{
    iframe.onload=resolve;iframe.onerror=()=>reject(Error('SVG iframe failed to load'));
  });
  iframe.srcdoc='<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}</style></head><body>'+svg+'</body></html>';
  await loaded;
  const doc=iframe.contentDocument,root=doc.querySelector('svg');
  if(!root) throw Error('Could not load SVG root');
  if(!root.hasAttribute('viewBox')) {
    const w=root.width.baseVal.value,h=root.height.baseVal.value;
    if(!(w>0 && h>0)) throw Error('SVG requires a valid viewBox or width/height');
    root.setAttribute('viewBox',`0 0 ${w} ${h}`);
  }
  const sourceStyle=root.getAttribute('style');
  root.style.setProperty('width','100%','important');root.style.setProperty('height','100%','important');
  root.pauseAnimations();root.setCurrentTime(0);
  const animations=doc.getAnimations();
  for(const a of animations) {a.pause();a.currentTime=0;}
  return {iframe,doc,root,overlay,footer,animations,sourceStyle};
}
window.loadSVG=async({svg,tileSize,selector,metadata})=>{
  size=tileSize;tiles=[];
  document.body.innerHTML='<div id="grid" style="display:grid;background:#192332"></div>';
  const first=await makeTile(svg,'Full composite — no control points',0);tiles.push(first);
  selection=choose(first.root,selector,metadata);
  if(!selection.length) throw Error('No drawable vector layers found');
  const cols=Math.ceil(Math.sqrt(selection.length+1)), rows=Math.ceil((selection.length+1)/cols);
  if(cols*size>16384 || rows*(size+62)>16384) throw Error('Grid exceeds 16384 pixels; reduce --tile-size or select fewer layers');
  document.getElementById('grid').style.gridTemplateColumns=`repeat(${cols},${size}px)`;
  document.getElementById('grid').style.width=cols*size+'px';
  for(let i=0;i<selection.length;i++) {
    const tile=await makeTile(svg,selection[i].name,i+1);
    const own=choose(tile.root,selector,metadata)[i].nodes;
    tile.nodes=own;
    tile.paths=[...new Set(own.flatMap(node=>node.matches(SHAPES)?[node]:
      [...node.querySelectorAll(SHAPES)].filter(art)))];
    for(const element of tile.root.querySelectorAll(SHAPES)) {
      if(art(element) && !own.some(node=>node===element || node.contains(element)))
        element.style.setProperty('display','none','important');
    }
    revealLayer(tile.root);
    tiles.push(tile);
  }
  let cssDuration=0;
  for(const a of first.animations) {
    const t=a.effect.getTiming();
    if(typeof t.duration!=='number') throw Error('Cannot infer CSS duration; supply --duration');
    cssDuration=Math.max(cssDuration,Math.max(0,t.delay+t.duration*(Number.isFinite(t.iterations)?t.iterations:1)));
  }
  return {width:cols*size,height:rows*(size+62),layers:selection.map(x=>x.name),cssDuration:cssDuration/1000,
    animated:first.animations.length>0 || !!first.root.querySelector('animate,animateTransform,animateMotion,set'),
    repeats:[...first.root.querySelectorAll('[repeatCount]')].some(e=>e.getAttribute('repeatCount')==='indefinite') ||
      first.animations.some(a=>!Number.isFinite(a.effect.getTiming().iterations))};
};
window.exportLayerSVGs=()=>{
  const original=tiles[0].root;
  const originalShapes=[...original.querySelectorAll(SHAPES)].filter(art);
  return selection.map((layer,index)=>{
    const root=original.cloneNode(true);
    // Discard the tile's CSS sizing; standalone SVGs use the original canvas.
    if(tiles[0].sourceStyle===null) root.removeAttribute('style');
    else root.setAttribute('style',tiles[0].sourceStyle);
    const box=original.viewBox.baseVal;
    root.setAttribute('width',box.width);root.setAttribute('height',box.height);
    const keep=originalShapes.map(e=>layer.nodes.some(n=>n===e || n.contains(e)));
    [...root.querySelectorAll(SHAPES)].filter(art).forEach((e,i)=>{if(!keep[i]) e.remove();});
    revealLayer(root);
    // Keep ancestors, definitions, styles and animation dependencies intact.
    root.setAttribute('data-layer-depth',index+1);
    return new XMLSerializer().serializeToString(root);
  });
};
function visible(e) {
  const view=e.ownerDocument.defaultView;
  if(view.getComputedStyle(e).visibility!=='visible') return false;
  for(let p=e;p && p instanceof view.SVGElement;p=p.parentElement)
    if(view.getComputedStyle(p).display==='none') return false;
  return true;
}
function painted(e,opacity) {
  if(!visible(e) || opacity<=0) return false;
  const cs=e.ownerDocument.defaultView.getComputedStyle(e), box=e.getBBox();
  const colorVisible=value=>value!=='none' && value!=='transparent' &&
    !/rgba\([^)]*,\s*0(?:\.0*)?\s*\)$/.test(value);
  const fill=e.localName!=='line' && colorVisible(cs.fill) && Number(cs.fillOpacity)>0 &&
    box.width>0 && box.height>0;
  const stroke=colorVisible(cs.stroke) && Number(cs.strokeOpacity)>0 && parseFloat(cs.strokeWidth)>0;
  if(!fill && !stroke) return false;
  // Geometry outside the scene canvas still belongs to the full motion envelope
  // and becomes visible after normalization; it is not an empty element.
  return e.getTotalLength()>0;
}
function geometryBounds(e,matrix) {
  const box=e.getBBox(), cs=e.ownerDocument.defaultView.getComputedStyle(e);
  const corners=[[box.x,box.y],[box.x+box.width,box.y],
    [box.x,box.y+box.height],[box.x+box.width,box.y+box.height]]
    .map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
  const pad=cs.stroke!=='none'?parseFloat(cs.strokeWidth)*
    Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))/2:0;
  return [Math.min(...corners.map(p=>p.x))-pad,Math.min(...corners.map(p=>p.y))-pad,
    Math.max(...corners.map(p=>p.x))+pad,Math.max(...corners.map(p=>p.y))+pad];
}
function dFor(e) {
  const cs=e.ownerDocument.defaultView.getComputedStyle(e);
  function n(key) {
    const value=cs.getPropertyValue(key).trim();
    if(value && value!=='auto' && !value.endsWith('%') && /^[-+\d.]/.test(value)) return parseFloat(value);
    return e[key]?.animVal?.value ?? 0;
  }
  if(e.localName==='path') {
    const d=cs.getPropertyValue('d').trim();
    if(d==='none') return '';
    const match=d.match(/^path\(["'](.*)["']\)$/s);
    if(!match) throw Error('Browser did not expose evaluated SVG path data');
    return match[1];
  }
  if(e.localName==='line') return `M${n('x1')},${n('y1')}L${n('x2')},${n('y2')}`;
  if(['polyline','polygon'].includes(e.localName)) {
    const points=e.animatedPoints;
    return [...Array(points.numberOfItems)].map((_,i)=>{const p=points.getItem(i);return (i?'L':'M')+p.x+','+p.y;}).join('')+(e.localName==='polygon'?'Z':'');
  }
  if(['circle','ellipse'].includes(e.localName)) {
    const x=n('cx'),y=n('cy'),rx=e.localName==='circle'?n('r'):n('rx'),ry=e.localName==='circle'?n('r'):n('ry');
    return rx>0&&ry>0?`M${x-rx},${y}A${rx},${ry} 0 1 0 ${x+rx},${y}A${rx},${ry} 0 1 0 ${x-rx},${y}Z`:'';
  }
  const x=n('x'),y=n('y'),w=n('width'),h=n('height');
  if(!(w>0&&h>0)) return '';
  let rx=n('rx'),ry=n('ry');
  if(!e.hasAttribute('ry') && cs.ry==='auto') ry=rx;
  if(!e.hasAttribute('rx') && cs.rx==='auto') rx=ry;
  rx=Math.min(rx,w/2);ry=Math.min(ry,h/2);
  return rx>0&&ry>0?
    `M${x+rx},${y}H${x+w-rx}A${rx},${ry} 0 0 1 ${x+w},${y+ry}V${y+h-ry}A${rx},${ry} 0 0 1 ${x+w-rx},${y+h}H${x+rx}A${rx},${ry} 0 0 1 ${x},${y+h-ry}V${y+ry}A${rx},${ry} 0 0 1 ${x+rx},${y}Z`:
    `M${x},${y}H${x+w}V${y+h}H${x}Z`;
}
window.seekSVG=async(t)=>{
  for(const tile of tiles) {
    tile.root.setCurrentTime(t);
    for(const a of tile.doc.getAnimations()) {a.pause();a.currentTime=t*1000;}
    tile.overlay.replaceChildren();
    tile.footer.textContent=t.toFixed(3)+' s'+(tile===tiles[0]?' | Full composite':' | Blue: anchors · Orange: handles');
  }
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const result=[];
  for(let i=1;i<tiles.length;i++) {
    const tile=tiles[i];
    for(let j=0;j<tile.paths.length;j++) {
      const path=tile.paths[j];
      const matrix=path.getScreenCTM();if(!matrix) continue;
      const local=tile.root.getScreenCTM().inverse().multiply(matrix);
      const d=dFor(path);if(!d) continue;
      let opacity=1;
      for(let p=path;p && p instanceof tile.doc.defaultView.SVGElement;p=p.parentElement)
        opacity*=Number(tile.doc.defaultView.getComputedStyle(p).opacity);
      result.push({key:(i-1)+'/'+j,tile:i,d,visible:visible(path) && opacity>0,
        painted:painted(path,opacity),
        bounds:geometryBounds(path,local),
        matrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f],
        exportMatrix:[local.a,local.b,local.c,local.d,local.e,local.f]});
    }
  }
  return result;
};
window.drawSVGControls=(batches)=>{
  for(const batch of batches) {
    const overlay=tiles[batch.tile].overlay;
    for(const [a,b] of batch.handles) {
      overlay.append(add('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#e38900','stroke-width':.8}));
      overlay.append(add('circle',{cx:b[0],cy:b[1],r:1.5,fill:'#ffab26',stroke:'#6b4300','stroke-width':.35}));
    }
    for(const p of batch.anchors) overlay.append(add('circle',{cx:p[0],cy:p[1],r:2.2,fill:'#00a7d8',stroke:'#00334d','stroke-width':.4}));
  }
};
"""


def svg_element(tag, **attrs):
    return ET.Element(
        f"{{{SVG_NS}}}{tag}", {k.replace("_", "-"): str(v) for k, v in attrs.items()}
    )


def write_svg(root, destination):
    ET.ElementTree(root).write(destination, encoding="utf-8", xml_declaration=True)
    return destination


def save_layer_svg(svg, destination):
    """Save isolated artwork with its original canvas and transparent empty areas."""
    return write_svg(ET.fromstring(svg), destination)


def animate_attribute(element, attribute, values, duration, repeats, discrete=False):
    """Use SMIL so standalone controls follow the sampled artwork without scripts."""
    element.set(attribute, values[0])
    if len(set(values)) <= 1:
        return
    # Chromium stores SMIL keyTimes as floats. Advance interior discrete keys
    # by a tiny fraction of one frame so a sampled boundary selects its new pose.
    key_times = [0.0] + [
        (i - (1e-4 if discrete and i < len(values) - 1 else 0)) / (len(values) - 1)
        for i in range(1, len(values))
    ]
    animation = svg_element(
        "animate",
        attributeName=attribute,
        dur=f"{duration:.9g}s",
        begin="0s",
        fill="freeze",
        repeatCount="indefinite" if repeats else "1",
        calcMode="discrete" if discrete else "linear",
        values=";".join(values),
        keyTimes=";".join(f"{t:.9g}" for t in key_times),
    )
    element.append(animation)


def save_layer_with_controls_svg(svg, destination, samples, duration, repeats):
    """Dim artwork to 45% and add anchors, control points and handle lines.

    Samples include hidden poses, which receive visibility animation along with
    their control geometry. This avoids blank exports for later animation layers.
    """
    root = ET.fromstring(svg)
    _, _, width, height = map(float, root.get("viewBox").split())
    unit = min(width, height) / 320
    artwork = svg_element(
        "g", opacity=CONTROL_ARTWORK_OPACITY, data_export_artwork="true"
    )
    for child in list(root):
        if child.tag.rsplit("}", 1)[-1] not in SVG_RESOURCES:
            root.remove(child)
            artwork.append(child)
    root.append(artwork)
    overlay = svg_element(
        "g",
        data_export_controls="true",
        fill="none",
        pointer_events="none",
        style="opacity:1;visibility:visible;display:inline",
    )
    root.append(overlay)
    keys = sorted({key for sample in samples for key in sample})
    for key in keys:
        poses = [
            sample.get(key, {"anchors": [], "handles": [], "visible": False})
            for sample in samples
        ]
        for kind in ("handles", "anchors"):
            count = max(len(pose[kind]) for pose in poses)
            for index in range(count):
                fallback = next(
                    pose[kind][index] for pose in poses if index < len(pose[kind])
                )
                points = [
                    pose[kind][index] if index < len(pose[kind]) else fallback
                    for pose in poses
                ]
                group = svg_element("g", data_control_kind=kind, data_path_key=key)
                overlay.append(group)
                animate_attribute(
                    group,
                    "visibility",
                    [
                        "visible" if p["visible"] and index < len(p[kind]) else "hidden"
                        for p in poses
                    ],
                    duration,
                    repeats,
                    discrete=True,
                )
                if kind == "handles":
                    line = svg_element(
                        "line",
                        style=f"stroke:#e38900;stroke-width:{.8*unit:.9g};fill:none",
                    )
                    group.append(line)
                    for attribute, endpoint, axis in [
                        ("x1", 0, 0),
                        ("y1", 0, 1),
                        ("x2", 1, 0),
                        ("y2", 1, 1),
                    ]:
                        animate_attribute(
                            line,
                            attribute,
                            [f"{p[endpoint][axis]:.9g}" for p in points],
                            duration,
                            repeats,
                        )
                    points = [p[1] for p in points]
                    radius, fill, stroke, stroke_width = (
                        0.75,
                        "#ffab26",
                        "#6b4300",
                        0.35,
                    )
                else:
                    radius, fill, stroke, stroke_width = 1.0, "#00a7d8", "#00334d", 0.4
                dot = svg_element(
                    "circle",
                    r=f"{radius*unit:.9g}",
                    style=f"fill:{fill};stroke:{stroke};stroke-width:{stroke_width*unit:.9g}",
                )
                group.append(dot)
                for attribute, axis in [("cx", 0), ("cy", 1)]:
                    animate_attribute(
                        dot,
                        attribute,
                        [f"{p[axis]:.9g}" for p in points],
                        duration,
                        repeats,
                    )
    return write_svg(root, destination)


def save_layer_with_text_svg(svg, destination, layer_id):
    """Add editable corner labels, scaled to the original SVG's viewBox.

    At 300 x 300, title/ID/description sizes are 16/12/12 with a 10-unit inset.
    IDs on the text elements make manual editing straightforward.
    """
    root = ET.fromstring(svg)
    x, y, width, height = map(float, root.get("viewBox").split())
    unit = min(width, height) / 300
    margin = 10 * unit
    labels = svg_element("g", data_export_labels="true")
    root.append(labels)
    for identifier, text, tx, ty, font_size, weight, anchor in [
        ("tile-title", "tbd", x + margin, y + margin + 16 * unit, 16, "600", "start"),
        (
            "layer-id",
            str(layer_id),
            x + width - margin,
            y + margin + 16 * unit,
            12,
            "600",
            "end",
        ),
        (
            "tile-description",
            "tbd",
            x + margin,
            y + height - margin,
            12,
            "400",
            "start",
        ),
    ]:
        label = svg_element(
            "text",
            id=identifier,
            x=f"{tx:.9g}",
            y=f"{ty:.9g}",
            style=f"font-family:Arial,sans-serif;font-size:{font_size*unit:.9g}px;"
            f"font-weight:{weight};text-anchor:{anchor};fill:#172333;"
            f"stroke:white;stroke-width:{2*unit:.9g};paint-order:stroke;"
            "opacity:1;visibility:visible;display:inline",
        )
        label.text = text
        labels.append(label)
    return write_svg(root, destination)


def control_data(shape, matrix_key):
    data = path_controls(shape["d"])
    points = data["anchors"] + [h[1] for h in data["handles"]]
    if points and not np.isfinite(np.array(points)).all():
        raise ValueError("Non-finite path coordinates")
    a, b, c, d, e, f = shape[matrix_key]

    def transform(p):
        return [a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f]

    return {
        "anchors": [transform(p) for p in data["anchors"]],
        "handles": [[transform(x), transform(y)] for x, y in data["handles"]],
        "visible": shape["visible"],
        "painted": shape["painted"],
        "bounds": shape["bounds"],
    }


def normalize_layer(svg, samples):
    """Fit the whole sampled motion, including handles, into one centered canvas.

    Use a constant uniform transform for the complete layer, preserving the
    arrangement of its elements and the original animation without scale jitter.
    All variants share the fit; text labels are added afterwards in canvas space.
    """
    root = ET.fromstring(svg)
    _, _, width, height = map(float, root.get("viewBox").split())
    points = []
    for sample in samples:
        for pose in sample.values():
            if not pose["painted"]:
                continue
            left, top, right, bottom = pose["bounds"]
            points.extend([[left, top], [right, bottom]])
            points.extend(pose["anchors"])
            points.extend(handle[1] for handle in pose["handles"])
    coordinates = np.asarray(points)
    if not coordinates.size or not np.isfinite(coordinates).all():
        raise ValueError("Cannot normalize a layer without finite visible geometry")
    low, high = coordinates.min(axis=0), coordinates.max(axis=0)
    extents = high - low
    available = np.array([width, height]) * (1 - 2 * NORMALIZED_PADDING)
    ratios = [available[i] / extents[i] for i in range(2) if extents[i] > 1e-12]
    scale = min(ratios) if ratios else 1.0
    tx, ty = np.array([width, height]) / 2 - scale * (low + high) / 2
    transform = f"matrix({scale:.12g} 0 0 {scale:.12g} {tx:.12g} {ty:.12g})"
    group = svg_element("g", transform=transform, data_export_normalized="true")
    for child in list(root):
        if child.tag.rsplit("}", 1)[-1] not in SVG_RESOURCES:
            root.remove(child)
            group.append(child)
    root.append(group)
    root.set("viewBox", f"0 0 {width:.12g} {height:.12g}")

    def point(p):
        return [scale * p[0] + tx, scale * p[1] + ty]

    normalized_samples = []
    for sample in samples:
        normalized = {}
        for key, pose in sample.items():
            normalized[key] = {
                **pose,
                "anchors": [point(p) for p in pose["anchors"]],
                "handles": [[point(a), point(b)] for a, b in pose["handles"]],
                "bounds": [*point(pose["bounds"][:2]), *point(pose["bounds"][2:])],
            }
        normalized_samples.append(normalized)
    return ET.tostring(root, encoding="unicode"), normalized_samples


def save_all_layer_svgs(source, output, layer_svgs, samples, duration, repeats):
    """Save clean/controls/text variants at original and normalized coordinates."""
    output.mkdir(parents=True, exist_ok=True)
    saved = 0
    for index, svg in enumerate(layer_svgs, 1):
        if not any(
            pose.get("painted", False)
            for sample in samples[index - 1]
            for pose in sample.values()
        ):
            print(f"Skipping empty layer {index}", flush=True)
            continue
        normalized_svg, normalized_samples = normalize_layer(svg, samples[index - 1])
        for suffix, variant, poses in [
            ("", svg, samples[index - 1]),
            ("_normalized", normalized_svg, normalized_samples),
        ]:
            stem = f"{source.stem}_layer{index}{suffix}"
            save_layer_svg(variant, output / (stem + ".svg"))
            save_layer_with_controls_svg(
                variant, output / (stem + "_withCPs.svg"), poses, duration, repeats
            )
            # save_layer_with_text_svg(variant, output / (stem + "_withText.svg"), index)
        saved += 1
    print(
        f"Saved {saved*6} layer SVGs ({saved} non-empty layers) to {output}", flush=True
    )


def render(args):
    source = args.svg.expanduser().resolve()
    svg, metadata, smil_duration, ambiguous = inspect_svg(source)
    output = (
        (args.output or source.with_name(source.stem + "_visualized"))
        .expanduser()
        .resolve()
    )
    if output.exists() and any(output.iterdir()):
        raise ValueError(
            "Output must be absent or empty; choose another --output directory."
        )
    if not args.layers_only and not shutil.which(args.ffmpeg):
        raise ValueError("FFmpeg is not on PATH; install it or pass --ffmpeg.")
    fps = args.fps if args.fps is not None else metadata.get("fps", 30)
    if not isinstance(fps, (int, float)) or not math.isfinite(fps) or fps <= 0:
        raise ValueError("Frame rate must be a finite positive number.")
    if (
        ambiguous
        and args.duration is None
        and not (metadata.get("frames") and metadata.get("fps"))
    ):
        raise ValueError(
            "SVG has event-based/unspecified timing. Supply --duration in seconds."
        )
    with tempfile.TemporaryDirectory(
        prefix="svg-layers-"
    ) as temp, sync_playwright() as playwright:
        chrome = args.chrome
        installed = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        if chrome is None and installed.is_file():
            chrome = installed
        browser = playwright.chromium.launch(
            headless=True, executable_path=str(chrome) if chrome else None
        )
        try:
            context = browser.new_context(device_scale_factor=1)
            context.route("**/*", lambda route: route.abort())
            page = context.new_page()
            page.set_content(
                "<html><head><style>body{margin:0}</style></head><body></body></html>"
            )
            page.add_script_tag(content=RUNTIME)
            info = page.evaluate(
                "loadSVG",
                {
                    "svg": svg,
                    "tileSize": args.tile_size,
                    "selector": args.layer_selector,
                    "metadata": metadata,
                },
            )
            page.set_viewport_size({"width": info["width"], "height": info["height"]})
            embedded_duration = (
                metadata.get("frames", 0) / metadata.get("fps", 1)
                if metadata.get("fps")
                else 0
            )
            duration = (
                args.duration
                if args.duration is not None
                else embedded_duration or max(smil_duration, info["cssDuration"]) or 3.0
            )
            if not math.isfinite(duration) or duration <= 0:
                raise ValueError("Duration must be finite and positive.")
            frames = max(1, math.ceil(duration * fps - 1e-9))
            layer_svgs = page.evaluate("exportLayerSVGs")
            samples = [[] for _ in layer_svgs]
            print(
                f"Layers: {len(info['layers'])}; {frames} frames at {fps:g} fps ({frames/fps:.3f} seconds)",
                flush=True,
            )
            for i, label in enumerate(info["layers"], 1):
                print(f"  Tile {i+1}: {label}")
            work = Path(temp)
            video, log_path = work / "layers.mp4", work / "ffmpeg.log"
            command = [
                args.ffmpeg,
                "-y",
                "-loglevel",
                "error",
                "-f",
                "image2pipe",
                "-vcodec",
                "png",
                "-framerate",
                str(fps),
                "-i",
                "-",
                "-an",
                "-c:v",
                "libx264",
                "-crf",
                "18",
                "-preset",
                "fast",
                "-pix_fmt",
                "yuv420p",
                "-vf",
                "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                "-movflags",
                "+faststart",
                str(video),
            ]
            references, reasons = {}, set()
            with log_path.open("wb") as log:
                process = (
                    None
                    if args.layers_only
                    else subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
                )
                try:
                    # Include the endpoint for native SVG control animations.
                    sample_count = frames + 1 if info["animated"] else 1
                    iterations = (
                        sample_count if args.layers_only else max(frames, sample_count)
                    )
                    for frame in range(iterations):
                        time = (
                            duration * frame / frames
                            if info["animated"]
                            else frame / fps
                        )
                        shapes = page.evaluate("seekSVG", time)
                        overlays = []
                        frame_samples = [{} for _ in layer_svgs]
                        for shape in shapes:
                            if frame < sample_count:
                                frame_samples[shape["tile"] - 1][shape["key"]] = (
                                    control_data(shape, "exportMatrix")
                                )
                            if not shape["visible"]:
                                continue
                            data = path_controls(shape["d"])
                            points = data["anchors"] + [h[1] for h in data["handles"]]
                            if not points:
                                continue
                            if not np.isfinite(np.array(points)).all():
                                raise ValueError("Non-finite path coordinates")
                            current = (data["signature"], points)
                            key = shape["key"]
                            if key not in references:
                                references[key] = current
                            elif deforms(references[key], current, args.tolerance):
                                reasons.add(key)
                            overlays.append(
                                {"tile": shape["tile"], **control_data(shape, "matrix")}
                            )
                        if frame < sample_count:
                            for layer_samples, pose in zip(samples, frame_samples):
                                layer_samples.append(pose)
                        if process is not None and frame < frames:
                            page.evaluate("drawSVGControls", overlays)
                            process.stdin.write(
                                page.locator("#grid").screenshot(
                                    type="png", animations="allow"
                                )
                            )
                        if frame % 60 == 0:
                            print(f"Frame {frame+1}/{frames}", flush=True)
                    if process is not None:
                        process.stdin.close()
                        if process.wait(timeout=120):
                            raise RuntimeError(
                                "FFmpeg failed: " + log_path.read_text()[-2000:]
                            )
                except BaseException:
                    if process is not None and process.poll() is None:
                        process.kill()
                    if process is not None:
                        process.wait()
                    raise
            if not references and not args.layers_only:
                raise ValueError(
                    "No visible measurable geometry appeared during the requested interval."
                )
            save_all_layer_svgs(
                source, output, layer_svgs, samples, duration, info["repeats"]
            )
            if args.layers_only:
                return output
            category = "non_rigid" if reasons else "rigid"
            destination = output / category
            destination.mkdir(parents=True, exist_ok=True)
            final_svg, final_mp4 = destination / source.name, destination / (
                source.stem + ".mp4"
            )
            shutil.copyfile(source, final_svg)
            try:
                shutil.copyfile(video, final_mp4)
            except BaseException:
                final_svg.unlink(missing_ok=True)
                final_mp4.unlink(missing_ok=True)
                raise
            print(
                f"Classification: {category} (scaling allowed); deformed paths: {len(reasons)}"
            )
            print(f"SVG: {final_svg}\nVideo: {final_mp4}")
            return final_svg, final_mp4
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("svg", type=Path, help="input SVG file")
    parser.add_argument(
        "--output",
        type=Path,
        help="empty output folder; default <svg-stem>_visualized beside the input",
    )
    parser.add_argument(
        "--layers-only",
        action="store_true",
        help="save six SVG variants per layer without rendering video",
    )
    parser.add_argument(
        "--duration",
        type=float,
        help="seconds; infer animation duration, or 3 seconds for static SVGs",
    )
    parser.add_argument(
        "--fps", type=float, help="frames/second; use embedded sampler FPS or 30"
    )
    parser.add_argument("--tile-size", type=int, default=320)
    parser.add_argument(
        "--layer-selector",
        help='CSS selector for non-overlapping layer groups/elements, e.g. "g.layer"',
    )
    parser.add_argument("--tolerance", type=float, default=1e-4)
    parser.add_argument(
        "--chrome",
        type=Path,
        help="browser executable; auto-detects macOS Chrome, otherwise Playwright Chromium",
    )
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    args = parser.parse_args()
    if args.tile_size < 96 or not math.isfinite(args.tolerance) or args.tolerance <= 0:
        parser.error("tile-size must be >=96 and tolerance must be finite and positive")
    render(args)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, ET.ParseError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
