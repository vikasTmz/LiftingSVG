# Lifting SVGs to 3D

This repository contains a temporary root landing page (`index.html`) and
the interactive research website in `svg_to_3D/`.

## Local setup

Use Ruby 3.2 or later, below 4.0, and Bundler. On macOS, use a Ruby version
manager or Homebrew Ruby rather than the old system Ruby. Check with
`ruby -v` and `bundle --version`; if Bundler is missing, run
`gem install bundler` with your chosen Ruby active.

From the repository root:

```sh
./setup.sh
```

The script installs any missing gems, builds the website, and starts Jekyll
with live reload. It binds to `127.0.0.1` for local development.

- Temporary landing page: <http://127.0.0.1:4000/>
- Interactive website: <http://127.0.0.1:4000/svg_to_3D/>

Press **Ctrl+C** to stop. To use another port:

```sh
./setup.sh serve --port 4001
```

To install dependencies separately, or build without starting a server:

```sh
./setup.sh install
./setup.sh build
```

The generated website is in `_site/`, which is ignored by Git. Commit
`Gemfile.lock` alongside `Gemfile` so collaborators use the same dependency
versions. The setup uses Jekyll 3.10 and explicitly includes WEBrick for
Ruby's local web server.

## Editing the site

The root `index.html` stays independent of the viewer website. Edit text in
`svg_to_3D/sections/*.md`, sections in `svg_to_3D/page.json`, and scene assets
and labels in `svg_to_3D/scenes.json`. See `svg_to_3D/EDITING.md` for details.
After changing paths or exporting layers, refresh the viewer metadata:

```sh
python3 svg_to_3D/prepare_viewer_assets.py
```

Jekyll copies the existing HTML, JSON, raw Markdown, SVGs, videos and client
libraries into the build. Keep client-rendered Markdown files free of YAML
front matter so Jekyll does not turn them into HTML. `_config.yml` explicitly
includes `svg_to_3D/assets/vendor` for the bundled MathJax and Markdown tools.
Development scripts and documentation are excluded from the generated site.

## Hosting later

This setup only runs locally and does not enable GitHub Pages, push changes,
or change repository/site visibility. Leave Pages disabled until you choose
to publish. Set `_config.yml`'s `url` and `baseurl` to match the eventual
hosting address if you later add Jekyll layouts or absolute URL helpers.

References: [GitHub Pages dependency versions](https://pages.github.com/versions/),
[Jekyll configuration](https://jekyllrb.com/docs/configuration/options/), and
[local previews with Bundler](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/testing-your-github-pages-site-locally-with-jekyll).
