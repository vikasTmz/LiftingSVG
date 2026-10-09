'use strict';

// Protect TeX before Markdown can consume backslashes, underscores or ampersands.
// Code spans and fenced code blocks keep Marked's normal literal rendering.
function escapeMathHTML(text) {
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

marked.use({ extensions: [
  {
    name: 'literalDollar', level: 'inline',
    start(source) { return source.indexOf('\\$'); },
    tokenizer(source) {
      if (source.startsWith('\\$')) return { type: 'literalDollar', raw: '\\$' };
    },
    renderer() { return '<span class="tex2jax_ignore">$</span>'; },
  },
  {
    name: 'displayMath', level: 'block',
    start(source) { return source.match(/^ {0,3}(?:\\\[|\$\$|\\begin\{(?:equation|align|alignat|gather|multline|eqnarray)\*?\})/m)?.index; },
    tokenizer(source) {
      const match = /^(?: {0,3}\\\[[\s\S]*?\\\]| {0,3}\$\$[\s\S]*?\$\$| {0,3}\\begin\{((?:equation|align|alignat|gather|multline|eqnarray)\*?)\}[\s\S]*?\\end\{\1\})[ \t]*(?:\n|$)/.exec(source);
      if (match) return { type: 'displayMath', raw: match[0], text: match[0].trim() };
    },
    renderer(token) { return `<div class="math-display">${escapeMathHTML(token.text)}</div>\n`; },
  },
  {
    name: 'inlineMath', level: 'inline',
    start(source) { return source.match(/\\\(|\$(?!\$)/)?.index; },
    tokenizer(source) {
      const match = /^(?:\\\([\s\S]*?\\\)|\$(?!\$)(?:\\[^\n]|[^\\$\n])+?\$(?!\$))/.exec(source);
      if (match) return { type: 'inlineMath', raw: match[0] };
    },
    renderer(token) { return `<span class="math-inline">${escapeMathHTML(token.raw)}</span>`; },
  },
] });

window.MathJax = {
  startup: { typeset: false }, // app.js inserts fetched Markdown before typesetting.
  loader: { paths: { mathjax: new URL('assets/vendor/mathjax/', document.baseURI).href.replace(/\/$/, '') } },
  tex: {
    inlineMath: [['\\(', '\\)'], ['$', '$']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    processEscapes: true,
  },
  output: {
    font: 'mathjax-tex',
    fontPath: new URL('assets/vendor/mathjax/mathjax-tex-font', document.baseURI).href,
    displayOverflow: 'scroll', // Preserve author-chosen alignment on narrow screens.
  },
  svg: { fontCache: 'local' },
};

async function typesetPageMath() {
  await MathJax.startup.promise;
  // Also supports equations written directly in HTML; ignore inert viewer templates.
  await MathJax.typesetPromise([document.querySelector('main')]);
}
