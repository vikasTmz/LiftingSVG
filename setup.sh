#!/usr/bin/env bash
set -euo pipefail

# Resolve paths from this script so it also works from a different directory.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

usage() {
  cat <<'HELP'
Usage: ./setup.sh [serve|build|install|help] [additional options]

  serve    Install missing dependencies, build, and serve with live reload.
           Default: http://127.0.0.1:4000/ (temporary landing page: /coming_soon.html)
  build    Install missing dependencies and generate the site in _site/.
  install  Install the Ruby dependencies listed in Gemfile.
  help     Show this help.

Examples:
  ./setup.sh
  ./setup.sh build
  ./setup.sh serve --port 4001

Requires Ruby 3.2 or later (below 4.0) and Bundler. This script only builds
and serves locally; it does not publish the site or change GitHub settings.
HELP
}

ACTION="${1:-serve}"
if (( $# > 0 )); then shift; fi
case "$ACTION" in
  help|-h|--help) usage; exit 0 ;;
  serve|build|install) ;;
  *) usage >&2; exit 2 ;;
esac

if ! command -v ruby >/dev/null 2>&1; then
  printf '%s\n' 'Ruby is missing. Install Ruby 3.2+ and add it to your PATH.' >&2
  exit 1
fi
if ! ruby -e 'v = Gem::Version.new(RUBY_VERSION); exit(v >= Gem::Version.new("3.2") && v < Gem::Version.new("4.0") ? 0 : 1)'; then
  printf '%s\n' 'Use Ruby 3.2+ (below 4.0), rather than macOS system Ruby.' >&2
  ruby -v >&2
  exit 1
fi
if ! command -v bundle >/dev/null 2>&1; then
  printf '%s\n' 'Bundler is missing. With your chosen Ruby active, run: gem install bundler' >&2
  exit 1
fi

if [[ "$ACTION" == install ]]; then
  exec bundle install "$@"
fi

if ! bundle check >/dev/null 2>&1; then
  bundle install
fi

if [[ "$ACTION" == build ]]; then
  exec bundle exec jekyll build "$@"
fi

printf '%s\n' 'Viewer site: http://127.0.0.1:4000/' 'Temporary landing page: http://127.0.0.1:4000/coming_soon.html' 'Use Ctrl+C to stop. A custom --port changes these URLs.'
exec bundle exec jekyll serve --host 127.0.0.1 --port 4000 --baseurl "" --livereload "$@"

