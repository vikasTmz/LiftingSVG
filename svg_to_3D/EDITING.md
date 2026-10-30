# Editing this page

You can edit all project copy and section order without changing `index.html`.
The page reads these files on load; text/layout edits require no build command.

| File | What to edit |
| --- | --- |
| `content/introduction.md` | Main title and project description. |
| `content/notes.md` | Notes title and body. |
| `page.json` | Section order, layout styles, author/date, browser title, and header/footer. |
| `scenes.json` | Each viewer pair: IDs, titles, prompts, labels, SVG/layer paths, and videos. |
| `styles.css` | Appearance and animation styles. |
| `app.js` | Page rendering and viewer behavior. |
| `theme.js` | Saved theme, applied before the first paint. |

## Writing text

The first Markdown heading becomes the section title. Everything below it is
rendered as the body. For example, `content/introduction.md` can contain:

```markdown
# Lifting SVGs to *3D*

Write your project description here. Use **bold**, *italic*, and
[links](https://example.com) when needed.

- A first point
- A second point
```

Headings, paragraphs, lists, links, images, code, blockquotes, and tables work.
Image and link paths are relative to the Markdown file; for example, an image
in `assets/` is `![Caption](../assets/image.jpg)` from `content/notes.md`.
A link starting with `#` refers to a section on this page.

## Writing LaTeX equations

All Markdown sections support MathJax equations. No HTML or build command is
needed. Use `\( ... \)` for inline math, and `\[ ... \]` for centered display
equations. `$ ... $` (inline) and `$$ ... $$` (display) also work. Put display
delimiters on their own lines with a blank line before and after the block.

```markdown
The observed curve is \(c(t)\in\mathbb R^2\).

\[
\begin{aligned}
c(t) &= \pi_\theta(C(t)) + \delta(t) \\
\delta(t) &= 0
\end{aligned}
\]
```

In multiline equations, `&` marks the alignment point and `\\` starts the
next row. `aligned`, `cases`, matrices, fractions, sums, Greek letters and
`\boxed{...}` are supported. Standard display environments such as
`\begin{align*} ... \end{align*}` can also appear without delimiters.
Equations that are wider than a mobile screen scroll within their own block.

Use Markdown `**bold**` and `-` lists for prose instead of LaTeX `\textbf`
or `itemize`. MathJax renders mathematical expressions, not full LaTeX
documents. Inside code spans or fenced code blocks, equations stay literal.
Escape ordinary dollar signs as `\$`, or use the unambiguous `\( ... \)`
syntax when writing about prices.

Equations can also be written directly in HTML inside `<main>` using the
same delimiters. `math.js` protects TeX from Markdown parsing and configures
the locally hosted MathJax 4.1.3 library in `assets/vendor/mathjax/`.

## Reordering or hiding sections

The left-margin navigation is generated from the enabled sections in
`page.json`, in their page order. It appears on desktop screens at least
1360 pixels wide; smaller screens keep the full content width. Hover over
the dots, or focus a link with the keyboard, to reveal the section names.
The highlighted dot tracks the current section as you scroll.

Use an optional `navLabel` on each section to give it a short navigation name:

```json
{ "id": "formulation", "type": "note", "content": "content/problem_formulation.md", "navLabel": "Formulation" }
```

Without `navLabel`, text sections use their Markdown heading and individual
viewer sections use the scene's readable SVG name. Disabled or empty sections
do not appear in the navigation. Links use the section ID, so they can also be
bookmarked or shared.

Move objects in the `sections` array in `page.json`. Their array order is their
page order. For viewers first, followed by the introduction and notes:

```json
"sections": [
  { "id": "bird-example", "type": "viewer", "scene": "bird_flying" },
  { "id": "introduction", "type": "hero", "content": "content/introduction.md" },
  { "id": "about", "type": "note", "eyebrow": "Behind the scenes", "content": "content/notes.md" }
]
```

Use `"enabled": false` on a section to hide it, or remove its object. Each
section needs a unique `id` (letters, numbers and hyphens are a good choice).
Keep JSON strings in double quotes and avoid trailing commas.

The available section types are:

- `hero`: large centered title, author/date, and description. Set `"byline": false` to hide author/date.
- `viewer`: one side-by-side SVG/video pair, selected by its `scene` ID.
- `viewer-triple`: SVG, wand, video, wand, and a second SVG in one row; selected by its `scene` ID.
- `viewers`: optional group using a `scenes` list; older configurations still work.
- `note`: title at left, body at right; stacks on small screens.
- `text`: a single column for longer text.

To add a text section, create `content/method.md` with a heading and body, then
add this object anywhere in `sections`:

```json
{ "id": "method", "type": "text", "content": "content/method.md" }
```

An optional `eyebrow` supplies a small label above a text section's title.

## Calling individual viewers

Each scene in `scenes.json` describes one complete SVG/video viewer pair.
Use its `id` in a `viewer` section in `page.json`. Move that section object to
place the viewer anywhere among your Markdown sections:

```json
"sections": [
  { "id": "bird-example", "type": "viewer", "scene": "bird_flying" },
  { "id": "about", "type": "text", "content": "content/notes.md" },
  { "id": "splash-example", "type": "viewer", "scene": "pingpong_ball_cup_splash" }
]
```

Viewer text and assets belong to the scene. Placement and layout options
belong to its section in `page.json`:

```json
{
  "id": "bird_flying",
  "title": "Flying bird",
  "svgSource": "inputs/bird_flying.svg",
  "videoTitle": "Video viewer",
  "prompt": "What does this SVG look like from another angle?",
  "wandLabel": "Generate 3D",
  "aside": "Animated example",
  "numbering": true,
  "svg": "inputs/bird_flying.svg",
  "layers": "inputs/bird_flying",
  "videos": [
    { "src": "outputs/bird_flying_turntable.mp4", "title": "Novel View Synthesis", "subtitle": "Full Render" }
  ]
}
```

- `title`: heading above this viewer pair.
- `svgSource`: URL of the original SVG source, displayed as an “SVG source” link below the SVG viewer at the bottom right. Use an external URL or a path relative to this page; an empty string hides the link.
- `videoTitle`: label above the video canvas.
- `prompt`: question displayed inside this scene's video canvas before playback.
- `wandLabel`: the wand button's tooltip and accessible label.
- `aside`: small caption at the right of the scene heading; use `""` to hide it.
- `numbering`: use `false` to hide this scene's sequence number.

These properties are independent for every scene. Missing properties use
built-in defaults; an empty text string intentionally leaves that label blank.
Video entry titles/subtitles and optional playback rate/poster stay in `videos`.

Scene headings (`title`) and the video canvas label (`videoTitle`) support
inline Markdown and basic HTML formatting. For example, either of these works:

```json
"title": "On the left is a flying bird. *What if we view it from another angle?*"
```

```json
"title": "On the left is a flying bird. <i>What if we view it from another angle?</i>"
```

Use `**bold**` or `<strong>bold</strong>` for bold text. Formatting is sanitized;
scripts, event handlers, and inline CSS are removed. Prompts and other labels
remain plain text.

Use a unique scene `id` so references remain stable when you change an SVG
filename. If omitted, the ID defaults to the SVG filename without `.svg`;
repeated filenames automatically receive `-2`, `-3`, etc.

List a scene only once in the page. A grouped `viewers` section can still use
`"scenes": ["bird_flying", "pingpong_ball_cup_splash"]`, or omit `scenes` to
include all configured scenes. The group's viewers each use their own scene
properties; there is no shared `page.json.viewers` settings block.

## Adding a second SVG beside the video

The bird example uses `"type": "viewer-triple"` in `page.json`. This keeps the
same page width and divides the row among three square viewers, with a wand
button in each of the two equally spaced gaps.
Other examples retain `"type": "viewer"`. On small screens, the triple layout
stacks in the same reading order.

Configure the extra viewer and its wand on the scene in `scenes.json`:

```json
"secondarySVG": {
  "svg": "inputs/bird_flying_hero.svg",
  "layers": "inputs/bird_flying_hero",
  "svgSource": "",
  "wandLabel": "Vectorize",
  "prompt": "Click the magic wand to vectorize this view"
}
```

The second viewer has independent layer, variant, animation, and zoom controls.
The first SVG loads when the example approaches the viewport. The first wand
reveals and plays the video; the second wand loads the second SVG and its layer
index. Both use the same two-second glow effect. Until the second wand is
clicked, the second SVG's `prompt` appears and its files are not fetched.
`secondarySVG.wandLabel` sets that button's tooltip and accessible label.
`secondarySVG.svgSource` and `secondarySVG.animationDuration` work like the
primary viewer's fields. Omit `secondarySVG.layers` if only the composite is
available. After changing either viewer's assets, run
`python3 prepare_viewer_assets.py` to update the layer indexes. To return to the
original pair, change this section's type back to `viewer`.

## Swapping the SVG and video viewers

Set `"swapViewers": true` on a viewer section in `page.json`:

```json
{
  "id": "leaking-wine-animated-example",
  "type": "viewer",
  "scene": "leaking_wine_animated",
  "swapViewers": true
}
```

The video appears on the left and the SVG on the right. The first video loads
paused when the example approaches the viewport, with its title and previews
visible. The SVG and its layers load only after clicking the wand: the glow
sweeps across the SVG viewer for two seconds, then the artwork appears. The
scene's `prompt` appears in the waiting SVG viewer. The default `Generate 3D`
wand label becomes `View SVG`; a custom `wandLabel` is kept.

Video previews stay below the video, and the source link stays below the SVG. On small screens,
the video comes first, followed by the wand and SVG viewer. Set it to `false`
or omit it to keep the usual SVG-first layout. It also works on grouped
`viewers` sections, applying to each scene in that group.

## Changing assets and previewing

Animated SVGs have a slim play/pause button and timeline above the View SVG /
View Layers buttons. Dragging the timeline pauses at the selected pose; press
play to continue. Paused time is retained when changing layers, variants, or
coordinate space. Static artwork has no playback controls.

Duration is inferred from SVG/SMIL timing or CSS keyframes. Indefinite animations
starting at time zero loop; finite animations stop at the end and can be replayed.
For SVGs with complex timing, set an optional `animationDuration` (in seconds)
on the scene in `scenes.json`, for example `"animationDuration": 6`. Animated
layers share the composite's timeline. Reduced-motion visitors start paused.
SVG scripts remain disabled through content security policy and removal of
scripts/event handlers; declarative SMIL and CSS animations are supported.
The viewer permits the iframe animation engine because Firefox also disables
SMIL when the iframe's script sandbox is enabled.

After changing `scenes.json` paths or re-exporting layers, run:

```sh
python3 prepare_viewer_assets.py
```

This reads `scenes.json`, indexes existing layer IDs/variants, and generates
video thumbnails/durations if ffmpeg/ffprobe are installed. Export filenames
remain `<stem>_layer<ID>[_normalized][variant suffix].svg`.

Preview through a web server rather than opening `index.html` as a `file://` URL:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. If that server is already running, just refresh.
Publish the HTML, CSS, JavaScript, JSON, Markdown, `assets/`, and media files
together to GitHub Pages. Text/layout changes need only a refresh locally and
publishing the edited files for the live site.

Markdown rendering uses locally bundled [Marked](https://github.com/markedjs/marked)
and [DOMPurify](https://github.com/cure53/DOMPurify); visitors need no CDN access.
Versions and license notices are retained in `assets/vendor/`.

## Resizing the ChatGPT buttons

In `styles.css`, edit these variables in `.comparison-play`:

```css
--button-radius: 24px; /* circle diameter = 48px */
--logo-size: 24px;    /* logo width and height */
```

Both buttons in the triple layout use these values. Keep `border-radius: 50%`
to retain the circular shape. The viewer gaps stay equally spaced when the
buttons shrink. The logo asset is `assets/chatgpt-logo.svg`; its vector path
comes from [ChatGPT's official favicon](https://cdn.oaistatic.com/assets/favicon-o20kmmos.svg).

## Hiding individual video preview cards

Set `"showPreview": false` on any entry in a scene's `videos` array in
`scenes.json`:

```json
{
  "src": "assets/gpt6_results/bird_flying_renderpass_view1.mp4",
  "title": "Cam 01",
  "showPreview": false
}
```

Omit the field or set it to `true` to show the thumbnail card. This affects
only the preview menu; the first video in the array still plays when the
main button is clicked, even if its preview card is hidden. A hidden card
cannot be clicked to select that clip. If every video has `showPreview` set
to `false`, the preview menu stays hidden.

## SVG or video results in swapped viewers

For a scene used with `swapViewers: true`, add a video file path alongside its
`svg` field in `scenes.json`:

```json
"svgFallbackVideo": "assets/gpt6_results/my-svg-preview.mp4",
"preferSVG": false
```

A small SVG toggle appears above the GPT button. On selects the real SVG;
off selects the video backup. Configured scenes default to video. Set
`preferSVG` to `true` if you want their toggle to start on.

The GPT button reveals the chosen result after its usual two-second effect.
Changing the toggle after a reveal immediately loads the other format.
The right-hand video has native play/pause, timeline and fullscreen controls,
and loops muted. Switching formats releases the old SVG or video, including
any pending SVG fetch, so the large SVG is loaded only when selected.

An empty or omitted `svgFallbackVideo` keeps the existing SVG-only behavior
and hides the toggle. Wine's path is empty for now; fill it in when ready.
The whisk and belt scenes use their existing decomposed SVG preview videos.
This setting does not affect the left-hand input videos or the bird layout.

## BibTeX references and citations

Add standard BibTeX entries to `references.bib` beside `page.json`. Each entry
needs a unique citation key. In Markdown prose, cite it with:

```markdown
Trellis2.0 [@trellis2], Sparc3D [@sparc3d], and Tripo [@tripo].
Several works [@trellis2; @sparc3d].
LaTeX-style citations also work: \cite{trellis2,sparc3d}.
```

Both syntaxes produce numbered links. Numbers follow the first appearance
of each citation in page order. Repeated keys reuse their number. Only cited
entries appear in the bibliography. Citations inside code spans/fences stay
literal; put citations outside math expressions.

The final section in `page.json` controls the bibliography:

```json
{
  "id": "references",
  "type": "references",
  "title": "References",
  "bibliography": "references.bib",
  "navLabel": "References"
}
```

Move this object to reorder the section, or change `bibliography` to another
file path relative to `svg_to_3D/`. Use one references section per page.
Citation links jump to their numbered entries; the return arrows jump back
to the citing paragraph. The section also offers the original BibTeX file.

Unknown keys display a visible missing-reference marker and message. A
missing or invalid `.bib` file reports an error in the References section
while the rest of the page remains usable. Entry titles, authors, dates,
publication details and DOI/URL links are formatted with bundled Citation.js.
No collaborator needs to install an editor extension, npm package or LaTeX.

The initial entries cite the TRELLIS.2 and Sparc3D preprints and the Tripo
platform website. Tripo's entry is a website citation because the original
link did not identify a particular research paper.
