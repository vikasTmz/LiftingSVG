'use strict';

// Basic Pandoc-style citations and LaTeX \cite work in Markdown prose.
// Marked handles code spans/fences separately, leaving their contents literal.
const citationKeyPattern = /^[A-Za-z0-9_][A-Za-z0-9_:.+/-]*$/;
marked.use({ extensions: [{
  name: 'bibliographyCitation', level: 'inline',
  start(source) { return source.search(/\[@|\\cite\{/); },
  tokenizer(source) {
    const match = /^(?:\[(@[^\]\n]+)\]|\\cite\{([^}\n]+)\})/.exec(source);
    if (!match) return;
    const keys = (match[1] || match[2]).split(/[;,]/).map(key => key.trim().replace(/^@/, ''));
    if (keys.length && keys.every(key => citationKeyPattern.test(key))) {
      return { type: 'bibliographyCitation', raw: match[0], keys };
    }
  },
  renderer(token) {
    const links = token.keys.map(key => `<a class="citation" data-cite-key="${key}" href="#references">@${key}</a>`);
    return `<span class="citation-group">[${links.join(', ')}]</span>`;
  },
}] });

function createReferencesSection(section, config) {
  section.className = 'references-section';
  const title = document.createElement('h2');
  title.id = `${config.id}-title`; title.textContent = config.title || 'References';
  section.setAttribute('aria-labelledby', title.id);
  const status = document.createElement('p'); status.className = 'references-status';
  status.setAttribute('role', 'status'); status.textContent = 'Loading references…';
  const list = document.createElement('ol'); list.className = 'reference-list';
  const download = document.createElement('p'); download.className = 'references-download';
  download.hidden = true;
  section.append(title, status, list, download);
}

function referenceURL(entry) {
  const value = entry.DOI ? `https://doi.org/${entry.DOI}` : entry.URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch (_) { return null; }
}

function linkReferenceURL(fragment, url) {
  if (!url) return;
  // citeproc emits plain URL text. Link the exact metadata URL rather than
  // guessing punctuation boundaries or interpreting any bibliography HTML.
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (node.parentElement?.closest('a') || !node.textContent.includes(url)) return;
    const parts = node.textContent.split(url), replacement = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (index) {
        const link = document.createElement('a'); link.href = url; link.textContent = url;
        replacement.append(link);
      }
      replacement.append(document.createTextNode(part));
    });
    node.replaceWith(replacement);
  });
  if (![...fragment.querySelectorAll('a')].some(link => link.href === url)) {
    const link = document.createElement('a'); link.href = url; link.textContent = 'Source';
    fragment.append(document.createTextNode(' '), link);
  }
}

async function renderReferences(page, container, resolveURL) {
  const config = page.sections.find(item => item.type === 'references' && item.enabled !== false);
  if (!config) return;
  const section = document.getElementById(config.id);
  const status = section.querySelector('.references-status');
  const list = section.querySelector('.reference-list');
  const links = [...container.querySelectorAll('a[data-cite-key]')];
  const markMissing = link => {
    link.textContent = `?${link.dataset.citeKey}`;
    link.classList.add('citation-missing');
    link.href = `#${encodeURIComponent(config.id)}`;
    link.title = `Missing bibliography entry: ${link.dataset.citeKey}`;
  };
  try {
    const bibURL = resolveURL(config.bibliography || 'references.bib');
    const response = await fetch(bibURL);
    if (!response.ok) throw new Error(`Bibliography returned ${response.status}`);
    const Cite = window.BibliographyCite;
    if (!Cite) throw new Error('The bibliography parser could not be loaded.');
    // Ignore full-line TeX comments, including any example @citation markers.
    const input = (await response.text()).replace(/^\s*%[^\n]*(?:\n|$)/gm, '');
    const entries = new Cite(input, { forceType: '@biblatex/text' }).data;
    const byKey = new Map();
    entries.forEach(({ _graph, ...entry }) => {
      const key = String(entry['citation-key'] || entry.id);
      if (byKey.has(key)) throw new Error(`Duplicate bibliography key: ${key}`);
      byKey.set(key, entry);
    });
    const ordered = [], occurrences = new Map(), missing = new Set();
    links.forEach((link, index) => {
      const key = link.dataset.citeKey;
      if (!byKey.has(key)) { missing.add(key); markMissing(link); return; }
      if (!occurrences.has(key)) { ordered.push(key); occurrences.set(key, []); }
      link.id = `${config.id}-citation-${index + 1}`;
      occurrences.get(key).push(link);
    });
    ordered.forEach((key, index) => {
      const entry = byKey.get(key), number = index + 1;
      const item = document.createElement('li');
      item.id = `${config.id}-entry-${key}`; item.tabIndex = -1;
      const text = document.createElement('div'); text.className = 'reference-text';
      const html = new Cite([entry]).format('bibliography', { format: 'html', template: 'apa', lang: 'en-US' });
      const fragment = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, RETURN_DOM_FRAGMENT: true });
      const formatted = fragment.querySelector('.csl-entry');
      if (formatted) text.append(...formatted.childNodes); else text.append(fragment);
      linkReferenceURL(text, referenceURL(entry));
      const backlinks = document.createElement('span'); backlinks.className = 'reference-backlinks';
      occurrences.get(key).forEach((link, occurrence) => {
        link.textContent = number;
        link.href = `#${encodeURIComponent(item.id)}`;
        link.title = text.textContent.trim();
        link.setAttribute('role', 'doc-biblioref');
        link.setAttribute('aria-label', `Reference ${number}: ${entry.title || key}`);
        link.addEventListener('click', event => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) item.focus({ preventScroll: true });
        });
        const back = document.createElement('a'); back.href = `#${link.id}`;
        back.textContent = occurrences.get(key).length === 1 ? '↩' : `↩${occurrence + 1}`;
        back.setAttribute('aria-label', `Return to citation ${occurrence + 1} of reference ${number}`);
        backlinks.append(back);
      });
      item.append(text, backlinks); list.append(item);
    });
    status.hidden = ordered.length > 0 && missing.size === 0;
    status.textContent = missing.size ? `Missing bibliography entries: ${[...missing].join(', ')}.` : 'No references cited yet.';
    status.classList.toggle('error', missing.size > 0);
    if (missing.size) console.warn(status.textContent);
    const download = section.querySelector('.references-download');
    const source = document.createElement('a'); source.href = bibURL;
    source.setAttribute('download', 'references.bib'); source.textContent = 'Download BibTeX';
    download.append(source); download.hidden = false;
  } catch (error) {
    list.replaceChildren();
    links.forEach(markMissing);
    status.hidden = false; status.classList.add('error');
    status.textContent = `References could not be loaded: ${error.message}`;
    console.warn(status.textContent);
  }
}
