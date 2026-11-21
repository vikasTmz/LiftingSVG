// Progressive enhancement of a standalone, editable SVG. All paths follow this module.
const base = new URL('.', import.meta.url);
const url = path => new URL(path, base).href;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export async function mountReconstructionGraphs() {
  const figures = [...document.querySelectorAll('[data-reconstruction-graph="flying-bird"]')];
  if (!figures.length) return [];
  const sheet = el('link');
  sheet.rel = 'stylesheet'; sheet.href = url('reconstruction-graph.css');
  document.head.append(sheet);
  const responses = await Promise.all(['json', 'svg'].map(ext => fetch(url(`assets/diagrams/flying-bird-graph.${ext}`))));
  if (responses.some(response => !response.ok)) throw new Error('Bird graph assets could not be loaded.');
  const [data, svgText] = await Promise.all([responses[0].json(), responses[1].text()]);
  return figures.map(figure => mount(figure, data, svgText));
}

function mount(figure, data, svgText) {
  const content = el('div', 'bird-graph-content');
  const header = el('div', 'bird-graph-header');
  const bird = el('img', 'bird-graph-bird');
  bird.src = url('assets/diagrams/flying-bird-still.svg'); bird.alt = 'The flying bird in the source SVG';
  bird.width = 88; bird.height = 88;
  const heading = el('div');
  heading.append(el('div', 'bird-graph-eyebrow', 'An editable scene memory'));
  heading.append(el('h4', '', 'The flying bird, connected'));
  heading.append(el('p', '', 'Explore how source layers, 3D parts, and evaluation stay linked across revisions.'));
  header.append(bird, heading);
  content.append(header);

  const toolbar = el('div', 'bird-graph-toolbar');
  const filters = el('div', 'bird-graph-filters');
  filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Show graph relations');
  const labels = {all: 'All relations', structure: 'Hierarchy', correspondence: 'Correspondence', evaluation: 'Outputs & feedback'};
  const buttons = new Map();
  Object.entries(labels).forEach(([key, label]) => {
    const button = el('button', '', label); button.type = 'button';
    button.setAttribute('aria-pressed', String(key === 'all'));
    button.addEventListener('click', () => {
      hideTips();
      filter = key;
      buttons.forEach((b, value) => b.setAttribute('aria-pressed', String(value === key)));
      highlight();
    });
    buttons.set(key, button); filters.append(button);
  });
  toolbar.append(filters);
  content.append(toolbar);

  const legend = el('div', 'bird-graph-legend');
  [['structure','contains'],['correspondence','corresponds to'],['dependency','used to produce'],['evaluation','used to assess']].forEach(([kind,label]) => {
    const item = el('span', '', label); item.dataset.kind = kind; legend.append(item);
  });
  content.append(legend);
  content.append(el('p', 'bird-graph-scroll-hint', 'Swipe to explore the graph, or choose a node below.'));
  const layout = el('div', 'bird-graph-layout');
  const scroller = el('div', 'bird-graph-canvas');
  scroller.setAttribute('role', 'region'); scroller.setAttribute('aria-label', 'Flying bird graph; scroll horizontally on small screens');
  scroller.tabIndex = 0;
  const fragment = DOMPurify.sanitize(svgText, {USE_PROFILES: {svg: true, svgFilters: true}, RETURN_DOM_FRAGMENT: true});
  const svg = fragment.querySelector('svg');
  if (!svg) throw new Error('Invalid bird graph SVG.');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Persistent reconstruction graph. Tab to a node, or select a node below.');
  svg.removeAttribute('aria-labelledby');
  scroller.append(fragment); layout.append(scroller);
  content.append(layout);

  const chooser = el('label', 'bird-graph-chooser');
  chooser.append(el('span', '', 'Inspect a node'));
  const select = el('select');
  select.setAttribute('aria-label', 'Inspect a graph node');
  data.nodes.forEach(node => {
    const option = el('option', '', node.label); option.value = node.id; select.append(option);
  });
  chooser.append(select);
  content.append(chooser);
  const details = el('div', 'bird-graph-details');
  const panels = new Map();
  const tips = new Map();
  data.nodes.forEach(node => {
    const tip = el('div', 'bird-graph-tip'); tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');
    tip.append(el('strong', '', node.label), el('div', 'bird-graph-math', `\\[${node.math}\\]`));
    tips.set(node.id, tip); content.append(tip);
    const panel = el('div', 'bird-graph-detail'); panel.hidden = true;
    const intro = el('div', 'bird-graph-detail-intro');
    intro.append(el('div', 'bird-graph-eyebrow', node.kind === 'evaluation' ? 'Evaluation feedback' : 'Persistent record'));
    intro.append(el('h5', '', node.label));
    intro.append(el('p', '', node.description));
    const math = el('div', 'bird-graph-math', `\\[${node.math}\\]`);
    intro.append(math); panel.append(intro);
    const fields = el('dl');
    node.fields.forEach(([name, value]) => fields.append(el('dt', '', name), el('dd', '', value)));
    if (node.svgIds.length) {
      fields.append(el('dt', '', 'Source SVG IDs'), el('dd', 'bird-graph-ids', node.svgIds.map(id => `#${id}`).join(' · ')));
    }
    panel.append(fields); panels.set(node.id, panel); details.append(panel);
  });
  content.append(details);
  const status = el('span', 'bird-graph-sr-only'); status.setAttribute('aria-live', 'polite'); content.append(status);
  const footer = el('div', 'bird-graph-footer');
  footer.append(el('span', '', 'Hover, tap, or focus a node to inspect it.'));
  const downloads = el('span', 'bird-graph-downloads');
  [['svg','Download SVG'], ['json','Graph data']].forEach(([ext,label]) => {
    const link = el('a', '', label); link.href = url(`assets/diagrams/flying-bird-graph.${ext}`); link.download = `flying-bird-graph.${ext}`; downloads.append(link);
  });
  footer.append(downloads); content.append(footer);

  let selected = 'bundle', filter = 'all';
  const nodeElements = [...svg.querySelectorAll('[data-node]')];
  const edgeElements = [...svg.querySelectorAll('.graph-edge')];
  function edgeVisible(edge) {
    return filter === 'all' || edge.dataset.kind === filter || (filter === 'evaluation' && edge.dataset.kind === 'dependency');
  }
  function highlight() {
    const related = new Set([selected]);
    edgeElements.forEach(edge => {
      const visible = edgeVisible(edge);
      const active = visible && (edge.dataset.source === selected || edge.dataset.target === selected);
      edge.classList.toggle('is-filtered', !visible);
      edge.classList.toggle('is-active', active);
      edge.classList.toggle('is-muted', !active && selected !== 'bundle');
      if (active) {related.add(edge.dataset.source); related.add(edge.dataset.target);}
    });
    nodeElements.forEach(node => {
      const active = node.dataset.node === selected;
      node.classList.toggle('is-active', active);
      node.classList.toggle('is-related', !active && related.has(node.dataset.node));
      node.setAttribute('aria-pressed', String(active));
    });
  }
  function inspect(id, announce = false) {
    if (!panels.has(id)) return;
    selected = id; select.value = id;
    panels.forEach((panel, key) => { panel.hidden = key !== id; });
    highlight();
    if (announce) status.textContent = `${data.nodes.find(n => n.id === id).label} details shown below the graph.`;
  }
  function hideTips() { tips.forEach(tip => { tip.hidden = true; }); }
  function showTip(node) {
    hideTips();
    const tip = tips.get(node.dataset.node);
    tip.hidden = false;
    const anchor = node.getBoundingClientRect(), frame = figure.getBoundingClientRect();
    tip.style.left = `${Math.max(12, Math.min(anchor.x - frame.x, frame.width - tip.offsetWidth - 12))}px`;
    const below = anchor.bottom + 10;
    const top = below + tip.offsetHeight > innerHeight && anchor.top > tip.offsetHeight + 10
      ? anchor.top - tip.offsetHeight - 10 : below;
    tip.style.top = `${top - frame.top}px`;
  }
  nodeElements.forEach((node, index) => {
    const record = data.nodes.find(item => item.id === node.dataset.node);
    node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Inspect ${record.label}`);
    node.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') { inspect(record.id); showTip(node); }
    });
    node.addEventListener('pointerleave', hideTips);
    node.addEventListener('focus', () => { inspect(record.id, true); showTip(node); });
    node.addEventListener('blur', hideTips);
    node.addEventListener('click', () => inspect(record.id, true));
    node.addEventListener('keydown', event => {
      if (['Enter', ' '].includes(event.key)) {event.preventDefault(); inspect(record.id, true);}
      if (event.key === 'Escape') {event.preventDefault(); hideTips(); inspect('bundle', true);}
      if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const direction = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1;
        nodeElements[(index + direction + nodeElements.length) % nodeElements.length].focus();
      }
    });
  });
  select.addEventListener('change', () => { hideTips(); inspect(select.value, true); });
  scroller.addEventListener('scroll', hideTips, {passive: true});
  window.addEventListener('scroll', hideTips, {passive: true});
  window.addEventListener('resize', hideTips, {passive: true});
  inspect('bundle');
  // Keep the Markdown caption; replace only the static-image fallback after success.
  figure.querySelector('img')?.remove();
  figure.prepend(content);
  figure.classList.add('is-enhanced');
  return content;
}
