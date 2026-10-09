#!/usr/bin/env python3
"""Index scenes configured in scenes.json for a static GitHub Pages website.

Run: python3 prepare_viewer_assets.py
After changing scene paths or re-exporting layers, run this again and publish
the generated layers.json files and assets/viewer-media.json with the website.
ffmpeg/ffprobe are optional: they supply actual video thumbnails and durations.
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class SceneConfigParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("id") == "scene-config":
            self.active = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)


def local_path(root, url):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        return None  # Remote media stays usable, but cannot be indexed locally.
    path = (root / unquote(parts.path)).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f"Use a website-relative path inside {root}: {url}")
    return path


def write_json(path, value):
    contents = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    if not path.exists() or path.read_text() != contents:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents)


def index_layers(directory):
    sets = {}
    for path in sorted(directory.glob("*.svg")):
        match = re.fullmatch(r"(.+)_layer(\d+)(.*?)\.svg", path.name)
        if not match:
            continue
        stem, layer_id, suffix = match.groups()
        canonical = "_normalized" in suffix
        suffix = suffix.replace("_normalized", "")
        variant = suffix or "artwork"
        layers = sets.setdefault(stem, {})
        files = layers.setdefault(int(layer_id), {})
        files.setdefault(variant, {})[
            "canonical" if canonical else "default"
        ] = path.name
    catalog = {"version": 1, "sets": {}}
    for stem, layers in sets.items():
        keys = {key for files in layers.values() for key in files}
        preferred = ["artwork", "_withCPs"]
        keys = sorted(
            keys,
            key=lambda key: (
                preferred.index(key) if key in preferred else len(preferred),
                key,
            ),
        )
        catalog["sets"][stem] = {
            "variants": keys,
            "layers": [
                {"id": layer_id, "files": files}
                for layer_id, files in sorted(layers.items())
            ],
        }
    write_json(directory / "layers.json", catalog)
    return sum(len(layers) for layers in sets.values())


def index_video(root, src, previous, ffmpeg, ffprobe):
    path = local_path(root, src)
    if path is None:
        return {}
    if not path.is_file():
        print(f"Warning: video does not exist yet: {src}")
        return {}
    stamp = f"{src}:{path.stat().st_mtime_ns}:{path.stat().st_size}"
    fingerprint = hashlib.sha256(stamp.encode()).hexdigest()[:16]
    if (
        previous.get("fingerprint") == fingerprint
        and (not ffmpeg or previous.get("poster"))
        and (not ffprobe or previous.get("seconds") is not None)
    ):
        poster = previous.get("poster")
        if not poster or (root / poster).is_file():
            return previous
    result = {"fingerprint": fingerprint}
    if ffprobe:
        probe = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
        )
        try:
            result["seconds"] = float(json.loads(probe.stdout)["format"]["duration"])
        except (ValueError, KeyError):
            print(f"Warning: could not read duration: {src}")
    if ffmpeg:
        poster = root / "assets" / "viewer-previews" / f"{fingerprint}.jpg"
        poster.parent.mkdir(parents=True, exist_ok=True)
        command = [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-ss",
            "0",
            "-i",
            str(path),
            "-frames:v",
            "1",
            "-vf",
            "scale=360:360:force_original_aspect_ratio=decrease",
            str(poster),
        ]
        thumbnail = subprocess.run(command, capture_output=True, text=True)
        if thumbnail.returncode == 0 and poster.is_file():
            result["poster"] = poster.relative_to(root).as_posix()
        else:
            print(f"Warning: could not create thumbnail: {src}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenes", type=Path, help="Scene configuration JSON (defaults to scenes.json beside index.html).")
    parser.add_argument("--html", type=Path, default=Path(__file__).with_name("index.html"), help="Website entry point; also supports older inline scene-config files.")
    args = parser.parse_args()
    html = args.html.resolve()
    root = html.parent
    scenes_path = args.scenes.resolve() if args.scenes else root / "scenes.json"
    if scenes_path.exists() or args.scenes:
        scenes = json.loads(scenes_path.read_text())
    else:
        config = SceneConfigParser()
        config.feed(html.read_text())
        scenes = json.loads("".join(config.parts))
    if not isinstance(scenes, list):
        raise ValueError("Scene configuration must contain an array.")
    directories = set()
    video_sources = set()
    for scene in scenes:
        viewers = [scene]
        if scene.get("secondarySVG"):
            viewers.append(scene["secondarySVG"])
        for viewer in viewers:
            svg = local_path(root, viewer["svg"])
            if svg is not None and not svg.is_file():
                print(f'Warning: SVG does not exist yet: {viewer["svg"]}')
            if viewer.get("layers"):
                directory = local_path(root, viewer["layers"])
                if directory is not None:
                    directories.add(directory)
        for video in scene.get("videos", []):
            video_sources.add(video if isinstance(video, str) else video["src"])
    for directory in sorted(directories):
        if not directory.is_dir():
            print(f"Warning: layer directory does not exist yet: {directory}")
            continue
        count = index_layers(directory)
        print(f"Indexed {count} layers: {directory.relative_to(root)}/layers.json")
    metadata_path = root / "assets" / "viewer-media.json"
    previous = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    media = {
        src: index_video(root, src, previous.get(src, {}), ffmpeg, ffprobe)
        for src in sorted(video_sources)
    }
    write_json(metadata_path, media)
    print(f"Indexed {len(media)} videos: assets/viewer-media.json")
    if not ffmpeg:
        print(
            "ffmpeg unavailable; preview videos still work on hover, without generated posters."
        )


if __name__ == "__main__":
    main()
