# MathJax 4.1.3

Locally hosted browser files from the official npm packages `mathjax@4.1.3`
and `@mathjax/mathjax-stix2-font@4.1.3` (Apache-2.0; see LICENSE).
The original STIX font license is in `mathjax-stix2-font/OFL.txt`.

The `tex-mml-svg-nofont.js` bundle renders TeX as SVG and loads STIX Two from
`mathjax-stix2-font/`. TeX extensions, alternate CHTML output/fonts, and
accessibility speech resources are included for lazy loading locally.
No npm install or CDN connection is needed by the deployed page.

The previous Computer Modern/TeX font package and combined bundle have been
removed. Configuration and the Markdown math extension live in ../../../math.js.
