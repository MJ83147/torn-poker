#!/usr/bin/env bash
# Build, cache-bust, commit, and push to GitHub Pages in one step.
# Usage:  npm run deploy                (auto timestamp commit message)
#         npm run deploy -- "message"   (custom commit message)
set -e
cd "$(dirname "$0")"

echo "▸ Building…"
npm run build

# Bust the browser cache: stamp style.css + app.min.js with a fresh version
# so returning visitors always get the new files.
V=$(date +%s)
sed -i '' -E "s#style\.css\?v=[0-9]+#style.css?v=$V#; s#app\.min\.js\?v=[0-9]+#app.min.js?v=$V#" index.html
echo "▸ Cache-buster bumped to v=$V"

MSG="${1:-Deploy $(date '+%Y-%m-%d %H:%M')}"
git add -A
git commit -m "$MSG" || echo "▸ Nothing new to commit — pushing existing commits."

echo "▸ Pushing to origin/main…"
git push origin main

echo "✅ Deployed. GitHub Pages will refresh in ~1 minute."
