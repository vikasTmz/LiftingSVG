'use strict';

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function loadMarkdown(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const fragment = DOMPurify.sanitize(marked.parse(await response.text()), {
    USE_PROFILES: { html: true }, RETURN_DOM_FRAGMENT: true,
  });
  // Resolve links/images relative to their Markdown file, including on GitHub Pages.
  fragment.querySelectorAll('[href], [src]').forEach(node => {
    ['href', 'src'].forEach(attribute => {
      const value = node.getAttribute(attribute);
      if (value && !value.startsWith('#')) node.setAttribute(attribute, new URL(value, new URL(path, document.baseURI)).href);
    });
  });
  return fragment;
}

function inlineTitle(text) {
  return DOMPurify.sanitize(marked.parseInline(String(text)), {
    ALLOWED_TAGS: ['em', 'i', 'strong', 'b', 'u', 's', 'del', 'code', 'sub', 'sup', 'mark', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    RETURN_DOM_FRAGMENT: true,
  });
}

function takeHeading(fragment, tag, fallback) {
  const heading = document.createElement(tag);
  const first = fragment.firstElementChild;
  if (first && /^H[1-6]$/.test(first.tagName)) {
    heading.append(...first.childNodes); first.remove();
  } else heading.textContent = fallback || '';
  return heading;
}

function setPageMetadata(page) {
  if (page.documentTitle) document.title = page.documentTitle;
  if (page.description) document.querySelector('meta[name="description"]').content = page.description;
  document.getElementById('brand-name').textContent = page.brand?.name || '';
  document.getElementById('brand-note').textContent = page.brand?.note || '';
  document.querySelector('.brand').setAttribute('aria-label', `${page.brand?.name || 'Home'}, back to top`);
  document.getElementById('footer-text').textContent = page.footer || '';
}

const viewerSectionTypes = ['viewer', 'viewer-triple', 'viewers'];

async function renderPageSections(page, examples) {
  if (!Array.isArray(page.sections)) throw new Error('page.json needs a sections array.');
  const sections = page.sections.filter(section => section.enabled !== false);
  const ids = new Set();
  sections.forEach(section => {
    if (!section.id || ids.has(section.id) || document.getElementById(section.id) || examples.some(example => example.id === section.id)) throw new Error('Every page section needs a unique id distinct from viewer/control IDs.');
    ids.add(section.id);
    if (['viewer', 'viewer-triple'].includes(section.type) && typeof section.scene !== 'string') throw new Error(`Viewer section ${section.id} needs a scene ID.`);
    if (!['hero', ...viewerSectionTypes, 'note', 'text'].includes(section.type)) throw new Error(`Unknown section type: ${section.type}`);
    if (section.type === 'viewer-triple' && section.swapViewers) throw new Error('viewer-triple uses the SVG / video / SVG order; use viewer for swapViewers.');
  });
  const markdown = await Promise.all(sections.map(section => viewerSectionTypes.includes(section.type) ? null : loadMarkdown(section.content)));
  const container = document.getElementById('page-sections');
  const orderedExamples = [], usedScenes = new Set();
  sections.forEach((item, index) => {
    const section = document.createElement(item.type === 'hero' ? 'header' : 'section');
    section.id = item.id;
    if (viewerSectionTypes.includes(item.type)) {
      section.className = 'viewer-section';
      const sceneReferences = item.type === 'viewers' ? item.scenes : [item.scene];
      const selected = sceneReferences ? sceneReferences.map(id => {
        const example = examples.find(example => example.sceneId === id);
        if (!example) throw new Error(`Unknown scene id: ${id}`);
        return example;
      }) : examples;
      selected.forEach(example => {
        if (usedScenes.has(example.sceneId)) throw new Error(`Scene appears in more than one viewer section: ${example.sceneId}`);
        if (item.type === 'viewer-triple' && !example.secondarySVG) throw new Error(`Scene ${example.sceneId} needs secondarySVG for viewer-triple.`);
        usedScenes.add(example.sceneId);
        orderedExamples.push({ ...example, layout: item.type, swapViewers: item.swapViewers === true, container: section });
      });
      section.hidden = !selected.length;
    } else {
      const fragment = markdown[index];
      const heading = takeHeading(fragment, item.type === 'hero' ? 'h1' : 'h2', item.title);
      heading.id = `${item.id}-title`;
      section.setAttribute('aria-labelledby', heading.id);
      const title = document.createElement('div');
      if (item.eyebrow) {
        const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = item.eyebrow;
        title.append(eyebrow);
      }
      title.append(heading);
      const body = document.createElement('div'); body.className = 'markdown-body'; body.append(fragment);
      body.querySelectorAll('table').forEach(table => {
        const scroll = document.createElement('div'); scroll.className = 'markdown-table'; table.replaceWith(scroll); scroll.append(table);
      });
      if (item.type === 'hero') {
        section.className = 'hero';
        body.classList.add('hero-description');
        section.append(title);
        if (item.byline !== false && (page.author || page.date)) {
          const byline = document.createElement('div'); byline.className = 'byline';
          if (page.author) { const author = document.createElement('span'); author.textContent = page.author; byline.append(author); }
          if (page.author && page.date) { const dot = document.createElement('span'); dot.className = 'dot'; dot.setAttribute('aria-hidden', 'true'); byline.append(dot); }
          if (page.date) { const date = document.createElement('span'); date.className = 'date'; date.textContent = page.date; byline.append(date); }
          section.append(byline);
        }
        section.append(body);
      } else {
        section.className = item.type === 'note' ? 'article-note' : 'text-section';
        section.append(title, body);
      }
    }
    container.append(section);
  });
  return orderedExamples;
}

function createSectionNavigation(page, examples) {
  const nav = document.getElementById('pnav');
  const entries = page.sections.filter(item => item.enabled !== false).flatMap(item => {
    const section = document.getElementById(item.id);
    if (!section || section.hidden) return [];
    const scene = examples.find(example => example.sceneId === item.scene);
    if (['viewer', 'viewer-triple'].includes(item.type)) return [];
    const label = item.navLabel || (viewerSectionTypes.includes(item.type)
      ? scene?.svg.name || item.title || 'Examples'
      : section.querySelector('h1, h2')?.textContent.trim()) || item.id;
    return [{ section, label }];
  });
  if (!entries.length) return { refresh() {} };
  const track = document.createElement('span'); track.className = 'pnav-track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span'); fill.className = 'pnav-fill'; track.append(fill);
  nav.append(track);
  entries.forEach(entry => {
    const link = document.createElement('a');
    link.href = `#${encodeURIComponent(entry.section.id)}`;
    link.setAttribute('aria-label', entry.label);
    const dot = document.createElement('span'); dot.className = 'pnav-dot'; dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'pnav-label'; label.textContent = entry.label;
    link.append(dot, label); nav.append(link); entry.link = link;
    // Keep native fragment/history behavior, and place keyboard focus at the destination.
    entry.section.tabIndex = -1;
    link.addEventListener('click', event => {
      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        entry.section.focus({ preventScroll: true });
      }
    });
  });
  nav.hidden = false;
  let scheduled = false;
  function update() {
    scheduled = false;
    const anchor = Math.min(160, innerHeight * .25);
    let current = 0;
    entries.forEach((entry, index) => { if (entry.section.getBoundingClientRect().top <= anchor) current = index; });
    const maximum = document.documentElement.scrollHeight - innerHeight;
    if (maximum > 0 && scrollY >= maximum - 2) current = entries.length - 1;
    fill.style.height = `${maximum > 0 ? Math.min(100, Math.max(0, scrollY / maximum * 100)) : 0}%`;
    entries.forEach((entry, index) => {
      entry.link.classList.toggle('is-read', index < current);
      if (index === current) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
    });
  }
  function refresh() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  const observer = new ResizeObserver(refresh);
  observer.observe(document.getElementById('page-sections'));
  window.addEventListener('pagehide', () => {
    observer.disconnect(); window.removeEventListener('scroll', refresh); window.removeEventListener('resize', refresh);
  }, { once: true });
  refresh();
  return { refresh };
}

async function initializePage() {
  const filenameStem = path => decodeURIComponent(new URL(path, document.baseURI).pathname.split('/').pop()).replace(/\.[^.]+$/, '');
  const readableName = value => value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
  const formatDuration = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '';
  const [page, SCENES] = await Promise.all([loadJSON('page.json'), loadJSON('scenes.json')]);
  if (!Array.isArray(SCENES)) throw new Error('scenes.json must contain an array.');
  const sceneIds = new Set();
  const EXAMPLES = SCENES.map((scene, index) => {
    const stem = filenameStem(scene.svg);
    let sceneId = scene.id || stem, ordinal = 2;
    while (sceneIds.has(sceneId)) {
      if (scene.id) throw new Error(`Duplicate scene id: ${scene.id}`);
      sceneId = `${stem}-${ordinal++}`;
    }
    sceneIds.add(sceneId);
    return {
      id: index === 0 ? 'side-by-side' : `example-${String(index + 1).padStart(2, '0')}`,
      sceneId,
      title: scene.title ?? readableName(stem),
      svgSource: scene.svgSource ?? '',
      svgFallbackVideo: scene.svgFallbackVideo || '',
      preferSVG: scene.preferSVG === true,
      videoTitle: scene.videoTitle ?? 'Video viewer',
      prompt: scene.prompt,
      wandLabel: scene.wandLabel ?? 'Generate 3D',
      aside: scene.aside ?? '',
      numbering: scene.numbering ?? true,
      svg: { svg: scene.svg, layerDirectory: scene.layers, name: readableName(stem), animationDuration: scene.animationDuration },
      secondarySVG: scene.secondarySVG?.svg ? {
        svg: scene.secondarySVG.svg,
        layerDirectory: scene.secondarySVG.layers,
        name: readableName(filenameStem(scene.secondarySVG.svg)),
        animationDuration: scene.secondarySVG.animationDuration,
        wandLabel: scene.secondarySVG.wandLabel ?? 'View SVG',
        prompt: scene.secondarySVG.prompt ?? 'Click the magic wand to view this as an SVG',
      } : null,
      secondarySVGSource: scene.secondarySVG?.svgSource ?? '',
      videos: (scene.videos || []).map(video => {
        const item = typeof video === 'string' ? { src: video } : video;
        return { title: readableName(filenameStem(item.src)), subtitle: '', duration: '', rate: 1, ...item };
      }),
    };
  });
  const layerCatalogs = new Map();
  function getLayerCatalog(directory) {
    if (!directory) return Promise.reject(new Error('No layer directory configured.'));
    const url = `${directory.replace(/\/$/, '')}/layers.json`;
    if (!layerCatalogs.has(url)) layerCatalogs.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error('Layer index unavailable. Run python3 prepare_viewer_assets.py and publish layers.json.');
      return response.json();
    }));
    return layerCatalogs.get(url);
  }
  // Small shared metadata index; this never loads a video or a layer SVG.
  const mediaMetadata = fetch('assets/viewer-media.json').then(response => response.ok ? response.json() : {}).catch(() => ({}));
  const variantInfo = key => ({
    key,
    name: ({ artwork: 'Artwork', _withCPs: 'Controls' })[key] || readableName(key.replace(/^_with/, '')),
    description: '',
    icon: ({ artwork: 'i-scene', _withCPs: 'i-controls' })[key] || 'i-layers',
  });
  const $ = id => document.getElementById(id);
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function syncTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
    $('theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#161c19' : '#fffefa';
  }
  $('theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('svg-scenes-theme', theme); } catch (_) { }
    syncTheme();
  });
  syncTheme();

  // Each viewer keeps its own selection, fetch cancellation, and media state.
  function createSVGViewer(root, prefix, config) {
    const $ = id => root.querySelector(`#${prefix}${id}`);
    let layers = [], layerIDs = [], variants = [];
    let mode = 'svg', variant = 0, normalized = true, layerIndex = 0, disposed = false;
    $('view-layers').disabled = true;
    $('view-layers').title = 'Loading layer index…';
    let svgController = null, svgGeneration = 0, pendingFrame = null, layerTimer;
    const playback = createSVGPlayback(root, prefix, config.animationDuration);
    let zoom = 1;
    const zoomControls = document.createElement('div');
    zoomControls.className = 'svg-zoom glass';
    zoomControls.setAttribute('role', 'group');
    zoomControls.setAttribute('aria-label', 'SVG zoom');
    zoomControls.innerHTML = `<button id="${prefix}zoom-in" type="button" aria-label="Zoom in" title="Zoom in">${icon('i-zoom-in')}</button><button id="${prefix}zoom-out" type="button" aria-label="Zoom out" title="Zoom out">${icon('i-zoom-out')}</button>`;
    $('svg-stage').append(zoomControls);
    function applyZoom() {
      if (disposed) return;
      const stage = $('svg-stage'), mount = $('svg-mount');
      // Scale around the canvas center, including when the mount has unequal margins.
      mount.style.transformOrigin = `${stage.clientWidth / 2 - mount.offsetLeft}px ${stage.clientHeight / 2 - mount.offsetTop}px`;
      mount.style.transform = `scale(${zoom})`;
      stage.dataset.zoom = zoom;
      $('zoom-in').disabled = zoom >= 4;
      $('zoom-out').disabled = zoom <= .5;
      zoomControls.title = `Zoom: ${Math.round(zoom * 100)}%`;
    }
    $('zoom-in').addEventListener('click', () => { zoom = Math.min(4, zoom * 1.25); applyZoom(); });
    $('zoom-out').addEventListener('click', () => { zoom = Math.max(.5, zoom / 1.25); applyZoom(); });
    const zoomObserver = new ResizeObserver(applyZoom);
    zoomObserver.observe($('svg-stage'));
    applyZoom();


    function availableFiles(index = variant) { return layers[layerIndex]?.files[variants[index]?.key] || {}; }
    function fitSelection() {
      if (!variants.length || !layers.length) return;
      if (!Object.keys(availableFiles()).length) variant = variants.findIndex((_, index) => Object.keys(availableFiles(index)).length);
      const files = availableFiles();
      if (!files[normalized ? 'canonical' : 'default']) normalized = Boolean(files.canonical);
    }
    function layerPath() {
      const file = availableFiles()[normalized ? 'canonical' : 'default'];
      return new URL(encodeURIComponent(file), new URL(`${config.layerDirectory.replace(/\/$/, '')}/`, document.baseURI)).href;
    }
    function updateViewerControls() {
      const layered = mode === 'layers';
      fitSelection();
      $('svg-stage').dataset.mode = mode;
      $('layer-rail').hidden = !layered;
      $('variant-panel').hidden = !layered;
      $('view-svg').setAttribute('aria-pressed', String(!layered));
      $('view-layers').setAttribute('aria-pressed', String(layered));
      $('layer-slider').max = Math.max(0, layerIDs.length - 1);
      $('layer-slider').value = layerIndex;
      $('layer-slider').setAttribute('aria-valuetext', layerIDs.length ? `Layer ${layerIDs[layerIndex]}, ${layerIndex + 1} of ${layerIDs.length}` : 'No layers available');
      $('layer-current').textContent = layerIDs.length ? `${String(layerIndex + 1).padStart(2, '0')} / ${layerIDs.length}` : '—';
      $('layer-current').title = layerIDs.length ? `Layer ID: ${layerIDs[layerIndex]}` : '';
      $('layer-first').textContent = layerIDs[0] ?? '—';
      $('layer-limit').textContent = layerIDs.at(-1) ?? '—';
      $('previous-layer').disabled = layerIndex === 0;
      $('next-layer').disabled = layerIndex === layerIDs.length - 1;
      $('stage-badge').textContent = layered ? `Layer ${String(layerIDs[layerIndex]).padStart(2, '0')} · ${layerIndex + 1} of ${layerIDs.length}` : 'Full composite';
      $('svg-description').replaceChildren();
      const title = document.createElement('strong'); title.textContent = config.name;
      $('svg-description').append(title, document.createTextNode(layered ? ` · Layer ${layerIDs[layerIndex]} · ${variants[variant].description || variants[variant].name}` : ' · Full composite'));
      $('svg-hint').textContent = layered ? 'Drag the slider or use ↑ / ↓ to explore' : 'Switch to layers to look closer';
      root.querySelectorAll('.variant-button').forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === variant));
        button.disabled = !Object.keys(availableFiles(index)).length;
      });
      $('scene-coordinates').disabled = !availableFiles().default;
      $('fitted-coordinates').disabled = !availableFiles().canonical;
      $('scene-coordinates').setAttribute('aria-pressed', String(!normalized));
      $('fitted-coordinates').setAttribute('aria-pressed', String(normalized));
    }
    async function loadSVG(path) {
      if (disposed) return;
      const generation = ++svgGeneration;
      if (svgController) svgController.abort();
      if (pendingFrame) { pendingFrame.onload = null; pendingFrame.remove(); pendingFrame = null; }
      playback.detach();
      const controller = svgController = new AbortController();
      $('svg-status').classList.remove('error');
      $('svg-status').textContent = 'Loading artwork…';
      $('svg-status').hidden = false;
      $('svg-mount').setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(path, { signal: controller.signal });
        if (!response.ok) throw new Error(`Artwork returned ${response.status}`);
        const text = await response.text();
        if (generation !== svgGeneration) return;
        const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
        if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') throw new Error('The file is not a valid SVG.');
        const element = xml.documentElement;
        element.querySelectorAll('script').forEach(node => node.remove());
        [element, ...element.querySelectorAll('*')].forEach(node => {
          [...node.attributes].filter(attribute => /^on/i.test(attribute.name)).forEach(attribute => node.removeAttribute(attribute.name));
        });
        if (!element.hasAttribute('viewBox')) {
          const width = parseFloat(element.getAttribute('width')), height = parseFloat(element.getAttribute('height'));
          if (width > 0 && height > 0) element.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        element.style.width = '100%'; element.style.height = '100%';
        const frame = pendingFrame = document.createElement('iframe');
        frame.className = 'svg-artwork'; frame.tabIndex = -1;
        frame.title = mode === 'svg' ? `${config.name}, full SVG scene` : `${config.name}, layer ${layerIDs[layerIndex]}, ${variants[variant].description || variants[variant].name}`;
        // Isolate SVG styles/IDs while keeping its timeline accessible to the parent.
        // Firefox disables SMIL as well as scripts in a script-sandboxed frame.
        // Permit its animation engine, then block scripts with CSP instead.
        // Keep stripping script elements and event handlers above as well.
        frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        const base = new URL(path, document.baseURI).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><base href="${base}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body>svg{display:block}</style></head><body>${new XMLSerializer().serializeToString(element)}</body></html>`;
        await new Promise((resolve, reject) => {
          controller.signal.addEventListener('abort', () => reject(new DOMException('SVG load cancelled', 'AbortError')), { once: true });
          frame.onload = () => { if (frame.contentDocument?.querySelector('svg')) resolve(); };
          $('svg-mount').replaceChildren(frame);
        });
        if (generation !== svgGeneration) return;
        pendingFrame = null;
        playback.attach(frame.contentDocument, mode === 'svg');
        applyZoom();
        $('svg-status').hidden = true;
      } catch (error) {
        if (error.name === 'AbortError' || generation !== svgGeneration) return;
        $('svg-mount').replaceChildren();
        pendingFrame = null; playback.detach();
        $('svg-status').classList.add('error');
        $('svg-status').textContent = mode === 'layers' ? 'This layer is unavailable. Try another layer or variant.' : 'The artwork could not be loaded. Please try again.';
      } finally {
        if (generation === svgGeneration) $('svg-mount').setAttribute('aria-busy', 'false');
      }
    }
    function showViewer() { clearTimeout(layerTimer); updateViewerControls(); applyZoom(); return loadSVG(mode === 'svg' ? config.svg : layerPath()); }
    function setLayer(index, debounce = false) {
      const next = Math.max(0, Math.min(layerIDs.length - 1, index));
      if (next === layerIndex) return;
      layerIndex = next; updateViewerControls(); clearTimeout(layerTimer);
      if (debounce) layerTimer = setTimeout(showViewer, 90); else showViewer();
    }
    $('view-svg').addEventListener('click', () => { mode = 'svg'; showViewer(); });
    $('view-layers').addEventListener('click', () => { if (!layerIDs.length) return; mode = 'layers'; showViewer(); });
    $('layer-slider').addEventListener('input', event => setLayer(Number(event.target.value), true));
    $('layer-slider').addEventListener('change', showViewer);
    $('previous-layer').addEventListener('click', () => setLayer(layerIndex - 1));
    $('next-layer').addEventListener('click', () => setLayer(layerIndex + 1));
    $('svg-stage').addEventListener('keydown', event => {
      if (mode !== 'layers' || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || event.target === $('layer-slider')) return;
      event.preventDefault();
      setLayer(event.key === 'Home' ? 0 : event.key === 'End' ? layerIDs.length - 1 : layerIndex + (event.key === 'ArrowUp' ? -1 : 1));
    });
    let lastWheel = 0;
    $('svg-stage').addEventListener('wheel', event => {
      if (mode !== 'layers' || Math.abs(event.deltaY) < Math.abs(event.deltaX) || event.ctrlKey || Math.abs(event.deltaY) < 4) return;
      const next = layerIndex + Math.sign(event.deltaY);
      if (next < 0 || next >= layerIDs.length) return; // Let the page scroll at either end.
      event.preventDefault();
      if (performance.now() - lastWheel > 180) { lastWheel = performance.now(); setLayer(next, true); }
    }, { passive: false });
    function buildVariants() {
      $('variant-options').replaceChildren();
      variants.forEach((item, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'variant-button';
        button.innerHTML = `${icon(item.icon)}<span><b></b><small></small></span>`;
        button.querySelector('b').textContent = item.name; button.querySelector('small').textContent = item.description;
        button.setAttribute('aria-label', item.name); button.title = item.description ? `${item.name} · ${item.description}` : item.name;
        button.addEventListener('click', () => { variant = index; showViewer(); });
        $('variant-options').append(button);
      });
    }
    async function initializeLayers() {
      if (!config.layerDirectory) {
        $('view-layers').title = 'No layer directory configured.';
        return;
      }
      try {
        const catalog = await getLayerCatalog(config.layerDirectory);
        if (disposed) return;
        const sets = catalog.sets || {};
        const stem = filenameStem(config.svg);
        const set = sets[stem] || (Object.keys(sets).length === 1 ? Object.values(sets)[0] : null);
        if (!set) throw new Error(`No matching layers for ${stem}. Check the layer directory and regenerate layers.json.`);
        layers = set.layers.filter(layer => Object.values(layer.files).some(files => Object.keys(files).length)).sort((a, b) => a.id - b.id);
        layerIDs = layers.map(layer => layer.id);
        variants = set.variants.filter(key => layers.some(layer => layer.files[key])).map(variantInfo);
        buildVariants();
        $('view-layers').disabled = !layers.length;
        $('view-layers').title = layers.length ? 'View individual layers' : 'No layers found in this directory.';
        updateViewerControls();
      } catch (error) {
        if (disposed) return;
        $('view-layers').disabled = true;
        $('view-layers').title = error.message;
        console.warn(error.message);
      }
    }
    if (root.closest('.comparison')) {
      [['scene-coordinates', 'i-default-space'], ['fitted-coordinates', 'i-canonical-space']].forEach(([id, symbol]) => {
        const button = $(id), label = button.textContent.trim();
        button.setAttribute('aria-label', label); button.title = label;
        button.innerHTML = icon(symbol);
      });
    }
    $('scene-coordinates').addEventListener('click', () => { normalized = false; showViewer(); });
    $('fitted-coordinates').addEventListener('click', () => { normalized = true; showViewer(); });
    $('scene-name').textContent = config.name;
    const ready = showViewer();
    initializeLayers();
    function destroy() {
      if (disposed) return;
      disposed = true; ++svgGeneration;
      clearTimeout(layerTimer); zoomObserver.disconnect(); playback.destroy();
      if (svgController) svgController.abort();
      if (pendingFrame) pendingFrame.remove();
      $('svg-mount').replaceChildren();
      window.removeEventListener('pagehide', destroy);
    }
    window.addEventListener('pagehide', destroy);
    return { ready, destroy, showComposite() { mode = 'svg'; return showViewer(); } };
  }

  function createVideoViewer(root, prefix, videos) {
    const $ = id => root.querySelector(`#${prefix}${id}`);
    let activeVideo = 0, hoveredPreview = null, started = false, menuBuilt = false;
    let generating = false, magicTimer = null, magicButton = null;
    const frame = root.querySelector('.video-frame');
    const heading = root.querySelector('.video-heading');
    const hasPreviews = videos.some(item => item.showPreview !== false);
    mediaMetadata.then(metadata => {
      videos.forEach(item => {
        const data = metadata[item.src] || {};
        if (!item.poster && data.poster) item.poster = data.poster;
        if (!item.duration && data.seconds !== undefined) item.duration = formatDuration(data.seconds);
      });
      root.querySelectorAll('.video-card').forEach(card => {
        const item = videos[Number(card.dataset.videoIndex)];
        if (item.poster) { card.querySelector('img').src = item.poster; card.querySelector('img').hidden = false; }
      });
    });
    function releaseMagic() {
      clearTimeout(magicTimer); magicTimer = null; generating = false;
      frame.classList.remove('is-generating'); frame.removeAttribute('aria-busy');
      if (magicButton) { magicButton.disabled = !videos.length; magicButton.removeAttribute('aria-busy'); magicButton = null; }
    }
    function stopPreview() {
      if (!hoveredPreview) return;
      hoveredPreview.pause(); hoveredPreview.classList.remove('is-playing');
      hoveredPreview.removeAttribute('src'); hoveredPreview.load(); hoveredPreview = null;
    }
    function startPreview(video, item) {
      if (!started || reducedMotion.matches) return;
      stopPreview(); hoveredPreview = video;
      video.src = item.src; video.playbackRate = item.rate || 1;
      video.play().then(() => { if (hoveredPreview === video) video.classList.add('is-playing'); }).catch(() => { });
    }
    function selectVideo(index, play = false) {
      const item = videos[index]; if (!item) return;
      activeVideo = index; stopPreview();
      $('main-video').controls = true;
      const player = $('main-video'); player.pause(); player.poster = item.poster || '';
      $('video-error').hidden = true;
      $('video-poster').hidden = Boolean(root.closest('.comparison')) || !item.poster;
      $('video-poster-image').hidden = !item.poster;
      if (item.poster) $('video-poster-image').src = item.poster; else $('video-poster-image').removeAttribute('src');
      $('play-video').setAttribute('aria-label', `Play ${item.title}`);
      player.src = item.src; player.load(); player.playbackRate = item.rate || 1;
      $('video-title').textContent = item.title;
      $('video-detail').textContent = [item.subtitle, item.duration].filter(Boolean).join(' · ');
      $('main-video').setAttribute('aria-label', `${item.title}, result video`);
      root.querySelectorAll('.video-card').forEach(card => card.setAttribute('aria-pressed', String(Number(card.dataset.videoIndex) === index)));
      if (play) player.play().catch(() => {
        releaseMagic();
        // Native/poster playback remains available if delayed autoplay is blocked.
        frame.dataset.state = 'paused';
        $('video-idle').hidden = true;
      });
    }
    function buildMenu() {
      if (menuBuilt) return;
      menuBuilt = true;
      videos.forEach((item, index) => {
        if (item.showPreview === false) return;
        const card = document.createElement('button'); card.type = 'button'; card.className = 'video-card';
        card.dataset.videoIndex = index;
        card.setAttribute('aria-label', `Play ${item.title}`);
        card.setAttribute('aria-pressed', String(index === activeVideo));
        card.innerHTML = `<div class="video-thumbnail"><img loading="lazy" alt=""><video muted playsinline loop preload="none" aria-hidden="true"></video></div><div class="card-copy"><span><b></b><small></small></span><span class="card-index"></span></div>`;
        const poster = card.querySelector('img'); poster.hidden = !item.poster; if (item.poster) poster.src = item.poster;
        card.querySelector('b').textContent = item.title; card.querySelector('small').textContent = item.subtitle;
        card.querySelector('.card-index').textContent = String(index + 1).padStart(2, '0');
        const preview = card.querySelector('video'); preview.muted = true;
        card.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') startPreview(preview, item); });
        card.addEventListener('pointerleave', () => { if (hoveredPreview === preview) stopPreview(); });
        card.addEventListener('focus', () => startPreview(preview, item));
        card.addEventListener('blur', () => { if (hoveredPreview === preview) stopPreview(); });
        card.addEventListener('click', () => selectVideo(index, true));
        $('video-menu').append(card);
      });
    }
    function playFirst(button = null) {
      if (generating || !videos.length) return;
      generating = true; magicButton = button;
      $('main-video').pause(); stopPreview();
      heading.hidden = true; $('video-menu').hidden = true;
      $('video-error').hidden = true;
      frame.dataset.state = 'generating'; frame.setAttribute('aria-busy', 'true');
      if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
      frame.classList.add('is-generating');
      // Start the CSS effect now so its two-second fade and this timer agree.
      void getComputedStyle(frame).animationName;
      magicTimer = setTimeout(() => {
        magicTimer = null;
        frame.classList.remove('is-generating');
        frame.dataset.state = 'loading';
        selectVideo(0, true);
      }, 2000);
    }
    function loadFirstPaused() {
      if (!videos.length) return;
      // Swapped examples begin with the video; only this clip is loaded.
      started = true;
      $('main-video').preload = 'auto';
      buildMenu();
      heading.hidden = false; $('video-menu').hidden = !hasPreviews;
      $('video-idle').hidden = true;
      frame.dataset.state = 'paused';
      selectVideo(0);
    }
    $('play-video').addEventListener('click', () => {
      if (!$('main-video').hasAttribute('src')) playFirst($('play-video')); else $('main-video').play().catch(() => { });
    });
    $('video-poster-image').addEventListener('error', () => { $('video-poster').hidden = true; });
    $('main-video').addEventListener('playing', () => {
      releaseMagic(); started = true; buildMenu();
      frame.dataset.state = 'playing'; heading.hidden = false;
      $('video-idle').hidden = true; $('video-menu').hidden = !hasPreviews;
      $('video-poster').hidden = true;
      // Only the video the visitor is using should keep playing.
      document.querySelectorAll('.main-video').forEach(player => {
        if (player !== $('main-video')) player.pause();
      });
    });
    $('main-video').addEventListener('pause', () => { if (started && !generating) frame.dataset.state = 'paused'; });
    $('main-video').addEventListener('timeupdate', () => { if ($('main-video').currentTime > 0) $('video-poster').hidden = true; });
    $('main-video').addEventListener('loadedmetadata', () => {
      const item = videos[activeVideo];
      $('main-video').playbackRate = item.rate || 1;
      if (!item.duration) item.duration = formatDuration($('main-video').duration);
      $('video-detail').textContent = [item.subtitle, item.duration].filter(Boolean).join(' · ');
    });
    $('main-video').addEventListener('error', () => { releaseMagic(); $('video-idle').hidden = true; $('video-error').textContent = 'This video could not be played. Try another preview, or use an MP4 with a supported codec.'; $('video-error').hidden = false; $('video-poster').hidden = true; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        $('main-video').pause(); stopPreview(); releaseMagic();
        heading.hidden = !started; $('video-menu').hidden = !started || !hasPreviews;
        frame.dataset.state = started ? 'paused' : 'idle';
      }
    });
    window.addEventListener('pagehide', () => { stopPreview(); releaseMagic(); });
    $('main-video').preload = 'none';
    $('main-video').controls = false;
    $('main-video').removeAttribute('poster');
    $('video-menu').hidden = true;
    $('video-poster-image').hidden = true;
    $('video-poster').hidden = Boolean(root.closest('.comparison')) || !videos.length;
    $('play-video').disabled = !videos.length;
    $('video-title').textContent = videos[0]?.title || 'Video result';
    $('video-detail').textContent = '';
    heading.hidden = true; frame.dataset.state = 'idle';
    return { playFirst, loadFirstPaused };
  }

  // Clone the inert templates, prefixing IDs to keep every viewer independent.
  function cloneViewer(element, prefix) {
    const clone = element.cloneNode(true);
    const elements = [clone, ...clone.querySelectorAll('*')];
    const ids = new Map();
    elements.forEach(node => {
      if (node.id) { ids.set(node.id, prefix + node.id); node.id = prefix + node.id; }
    });
    elements.forEach(node => {
      ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls'].forEach(attribute => {
        if (!node.hasAttribute(attribute)) return;
        node.setAttribute(attribute, node.getAttribute(attribute).split(/\s+/).map(id => ids.get(id) || id).join(' '));
      });
    });
    return clone;
  }
  function appendSVGSource(panel, sourceURL) {
    if (!sourceURL) return;
    try {
      const url = new URL(sourceURL, document.baseURI);
      if (['http:', 'https:'].includes(url.protocol)) {
        const source = document.createElement('p'); source.className = 'svg-source';
        const link = document.createElement('a');
        link.href = url.href; link.textContent = 'SVG source ↗';
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        source.append(link); panel.append(source);
      }
    } catch (_) {
      // An unset or invalid source must not prevent the viewer from loading.
    }
  }
  setPageMetadata(page);
  const orderedExamples = await renderPageSections(page, EXAMPLES);
  const comparisonTemplate = $('comparison-template').content.querySelector('.comparison');
  const svgTemplate = $('svg-viewer-template').content.querySelector('.viewer');
  const videoTemplate = $('video-viewer-template').content.querySelector('.video-frame');
  const menuTemplate = $('video-viewer-template').content.querySelector('.video-menu');
  const pendingExamples = new Map();
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      pendingExamples.get(entry.target)?.();
      pendingExamples.delete(entry.target);
    });
  }, { rootMargin: '200px' }) : null;

  orderedExamples.forEach((example, index) => {
    const prefix = index === 0 ? 'side-' : `${example.id}-`;
    const section = cloneViewer(comparisonTemplate, index === 0 ? '' : `${example.id}-`);
    section.id = example.id;
    section.classList.toggle('is-swapped', example.swapViewers);
    section.classList.toggle('comparison-triple', example.layout === 'viewer-triple');
    const heading = section.querySelector('h2');
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 1).padStart(2, '0');
    number.hidden = example.numbering === false;
    // Keep formatted text inside one flex item so emphasis wraps naturally.
    const titleText = document.createElement('span');
    titleText.className = 'scene-title';
    titleText.append(inlineTitle(example.title));
    heading.replaceChildren(number, titleText);
    section.querySelector('.aside').textContent = example.aside;
    section.querySelector('.comparison-video > h3').replaceChildren(inlineTitle(example.videoTitle));
    example.container.append(section);
    const svgPanel = section.querySelector('.comparison-svg');
    const videoPanel = section.querySelector('.comparison-video');
    const svgViewer = cloneViewer(svgTemplate, prefix);
    svgPanel.append(svgViewer);
    appendSVGSource(svgPanel, example.svgSource);
    let secondaryPanel = null, secondaryButton = null;
    const secondaryPrefix = `${prefix}secondary-`;
    if (example.layout === 'viewer-triple') {
      secondaryButton = section.querySelector('.comparison-play').cloneNode(true);
      secondaryButton.id = `${secondaryPrefix}reveal-svg`;
      secondaryButton.classList.add('comparison-reveal');
      secondaryButton.title = example.secondarySVG.wandLabel;
      secondaryButton.setAttribute('aria-label', `${example.secondarySVG.wandLabel}: ${example.secondarySVG.name}`);
      secondaryButton.setAttribute('aria-controls', `${secondaryPrefix}svg-stage`);
      secondaryPanel = document.createElement('section');
      secondaryPanel.className = 'comparison-column comparison-svg comparison-svg-secondary';
      secondaryPanel.id = `${secondaryPrefix}svg-panel`;
      secondaryPanel.setAttribute('aria-label', `${example.secondarySVG.name}, second SVG viewer`);
      secondaryPanel.append(cloneViewer(svgTemplate, secondaryPrefix));
      appendSVGSource(secondaryPanel, example.secondarySVGSource);
      section.querySelector('.comparison-grid').append(secondaryButton, secondaryPanel);
    }
    const videoFrame = cloneViewer(videoTemplate, prefix);
    videoFrame.append(videoFrame.querySelector('.video-heading'));
    videoFrame.querySelector('video').preload = 'none';
    const prompt = example.prompt ?? (example.swapViewers ? 'What does this look like as an SVG?' : 'What does this SVG look like in 3D?');
    videoFrame.querySelector('.video-idle p').textContent = prompt;
    videoPanel.append(videoFrame, cloneViewer(menuTemplate, prefix));
    const playButton = section.querySelector('.comparison-play');
    if (example.swapViewers) {
      // Keep keyboard/reading order aligned with the visual order.
      section.querySelector('.comparison-grid').replaceChildren(videoPanel, playButton, svgPanel);
    }
    playButton.setAttribute('aria-controls', `${prefix}${example.swapViewers ? 'svg-stage' : 'main-video'}`);
    playButton.title = example.swapViewers && example.wandLabel === 'Generate 3D' ? 'View SVG' : example.wandLabel;
    playButton.setAttribute('aria-label', `${playButton.title} for ${titleText.textContent}`);
    playButton.disabled = !example.swapViewers && !example.videos.length;
    let videoViewer = null, revealedSVG = null, resultVideo = null, revealTimer = null, revealing = false, revealGeneration = 0;
    // The swapped layout and the triple layout both reveal an SVG on demand.
    const revealPanel = example.swapViewers ? svgPanel : secondaryPanel;
    const revealViewer = revealPanel?.querySelector('.viewer');
    const revealButton = example.swapViewers ? playButton : secondaryButton;
    const revealPrefix = example.swapViewers ? prefix : secondaryPrefix;
    const revealConfig = example.swapViewers ? example.svg : example.secondarySVG;
    const hasVideoFallback = example.swapViewers && Boolean(example.svgFallbackVideo);
    let useSVG = !hasVideoFallback || example.preferSVG;
    const svgIdle = document.createElement('div');
    let formatSwitch = null;
    if (hasVideoFallback) {
      revealViewer.id = `${revealPrefix}result`;
      const action = document.createElement('div'); action.className = 'comparison-action';
      const label = document.createElement('label'); label.className = 'result-format-toggle';
      label.title = 'On: load SVG. Off: load video.';
      const name = document.createElement('span'); name.textContent = 'SVG';
      formatSwitch = document.createElement('input'); formatSwitch.type = 'checkbox';
      formatSwitch.id = `${revealPrefix}use-svg`; formatSwitch.checked = useSVG;
      formatSwitch.setAttribute('role', 'switch');
      formatSwitch.setAttribute('aria-label', `${revealConfig.name}: use SVG instead of video`);
      formatSwitch.setAttribute('aria-controls', revealViewer.id);
      const track = document.createElement('span'); track.className = 'result-format-track';
      track.setAttribute('aria-hidden', 'true');
      label.append(name, formatSwitch, track);
      revealButton.replaceWith(action); action.append(label, revealButton);
      function updateFormat() {
        revealViewer.dataset.resultMode = useSVG ? 'svg' : 'video';
        revealButton.setAttribute('aria-controls', revealViewer.id);
        revealButton.title = example.wandLabel === 'Generate 3D' ? (useSVG ? 'View SVG' : 'View video') : example.wandLabel;
        revealButton.setAttribute('aria-label', `${revealButton.title} for ${titleText.textContent || revealConfig.name}`);
      }
      updateFormat();
      formatSwitch.addEventListener('change', () => {
        const wasRevealed = revealing || Boolean(revealedSVG || resultVideo);
        ++revealGeneration; finishReveal(); releaseResult();
        useSVG = formatSwitch.checked; updateFormat();
        const shell = cloneViewer(svgTemplate, revealPrefix);
        revealViewer.replaceChildren(...shell.childNodes);
        svgIdle.hidden = false; revealViewer.querySelector('.svg-stage').append(svgIdle);
        revealViewer.dataset.reveal = 'waiting';
        if (wasRevealed) revealResult(0);
      });
    }
    if (revealViewer) {
      revealViewer.dataset.reveal = 'waiting';
      svgIdle.className = 'svg-idle';
      const question = document.createElement('p'); question.textContent = example.swapViewers ? prompt : example.secondarySVG.prompt;
      svgIdle.append(question); revealViewer.querySelector('.svg-stage').append(svgIdle);
    }
    function initialize() {
      if (videoViewer) return;
      videoViewer = createVideoViewer(videoPanel, prefix, example.videos);
      if (example.swapViewers) videoViewer.loadFirstPaused();
      else createSVGViewer(svgPanel, prefix, example.svg);
    }
    function releaseResult() {
      if (revealedSVG) { revealedSVG.destroy(); revealedSVG = null; }
      if (resultVideo) {
        resultVideo.pause(); resultVideo.removeAttribute('src'); resultVideo.load();
        resultVideo.remove(); resultVideo = null;
      }
    }
    function showFallbackVideo() {
      if (!resultVideo) {
        const stage = document.createElement('div');
        stage.className = 'svg-stage result-video-stage';
        stage.setAttribute('aria-label', `${revealConfig.name}, video preview`);
        const video = resultVideo = document.createElement('video');
        video.className = 'result-video'; video.controls = true;
        video.muted = true; video.playsInline = true; video.loop = true; video.preload = 'none';
        video.setAttribute('aria-label', `${revealConfig.name}, SVG video preview`);
        const error = document.createElement('p'); error.className = 'stage-status error';
        error.setAttribute('role', 'status'); error.hidden = true;
        error.textContent = 'The video preview could not be loaded. Try switching SVG on.';
        video.addEventListener('error', () => { error.hidden = false; });
        const footer = document.createElement('div'); footer.className = 'viewer-footer';
        footer.textContent = 'Video preview';
        stage.append(video, error); revealViewer.replaceChildren(stage, footer);
        video.src = example.svgFallbackVideo;
      } else resultVideo.currentTime = 0;
      resultVideo.play().catch(() => { /* Native controls allow manual playback. */ });
    }
    function finishReveal() {
      clearTimeout(revealTimer); revealTimer = null; revealing = false;
      revealViewer.classList.remove('is-generating'); revealViewer.removeAttribute('aria-busy');
      revealViewer.dataset.reveal = revealedSVG || resultVideo ? 'ready' : 'waiting';
      revealButton.disabled = false; revealButton.removeAttribute('aria-busy');
    }
    function revealResult(delay = 2000) {
      if (revealing) return;
      const generation = ++revealGeneration;
      revealing = true; revealButton.disabled = true; revealButton.setAttribute('aria-busy', 'true');
      revealViewer.dataset.reveal = 'generating'; revealViewer.setAttribute('aria-busy', 'true');
      revealViewer.classList.add('is-generating');
      void getComputedStyle(revealViewer).animationName;
      revealTimer = setTimeout(async () => {
        revealTimer = null;
        revealViewer.classList.remove('is-generating'); revealViewer.dataset.reveal = 'loading';
        svgIdle.hidden = true;
        try {
          if (!useSVG) showFallbackVideo();
          else if (revealedSVG) await revealedSVG.showComposite();
          else {
            revealedSVG = createSVGViewer(revealPanel, revealPrefix, revealConfig);
            await revealedSVG.ready;
          }
        } finally { if (generation === revealGeneration) finishReveal(); }
      }, delay);
    }
    playButton.addEventListener('click', () => {
      initialize();
      if (example.swapViewers) revealResult();
      else videoViewer.playFirst(playButton);
    });
    if (secondaryButton) secondaryButton.addEventListener('click', () => { initialize(); revealResult(); });
    if (revealViewer) {
      // Stop hidden videos and release iframe clocks, fetches and decoders.
      const resultObserver = hasVideoFallback ? new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) resultVideo?.pause();
      }) : null;
      resultObserver?.observe(revealViewer);
      function onVisibilityChange() {
        if (!document.hidden) return;
        if (revealTimer !== null) finishReveal();
        resultVideo?.pause();
      }
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', () => {
        ++revealGeneration; finishReveal(); releaseResult(); resultObserver?.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }, { once: true });
    }
    if (observer) { pendingExamples.set(section, initialize); observer.observe(section); }
    else initialize();
  });
  const firstViewer = document.querySelector('.comparison');
  const skip = document.querySelector('.skip-link');
  skip.href = `#${firstViewer?.id || 'page-sections'}`;
  skip.textContent = firstViewer ? 'Skip to interactive viewer' : 'Skip to page content';
  const navigation = createSectionNavigation(page, EXAMPLES);
  $('page-status').hidden = true;
  // Math is a separate async pass so equations cannot delay viewer setup.
  typesetPageMath().then(() => {
    // A bookmarked section only exists after fetched Markdown has been inserted.
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && target.parentElement === $('page-sections')) target.scrollIntoView();
    navigation.refresh();
  }).catch(error => console.warn('Equations could not be typeset:', error));
}

initializePage().catch(error => {
  console.error(error);
  const status = document.getElementById('page-status');
  status.hidden = false;
  status.textContent = 'The page content could not be loaded. Please try refreshing the page.';
  status.classList.add('error');
});
