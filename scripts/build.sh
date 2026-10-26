#!/usr/bin/env bash
set -e

HEADER_CODE="© Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización."
HEADER_JS="/* $HEADER_CODE */"
HEADER_HTML="<!-- $HEADER_CODE -->"

echo "→ Minificando JS (excluyendo sw.js, workers y assets)..."
find . -type f -name "*.js" \
  -not -path "./node_modules/*" \
  -not -path "./.github/*" \
  -not -path "./assets/*" \
  -not -name "sw.js" \
  -not -name "bump-sw.js" \
  -not -name "copia-worker.js" \
  -not -name "copia-zip.js" \
  | while read -r f; do
    npx terser "$f" -o "$f" -c -m --comments false --preamble "$HEADER_JS"
    node -c "$f" || { echo "❌ Error de sintaxis en $f"; exit 1; }
  done

echo "→ Minificando CSS (excluyendo assets)..."
find . -type f -name "*.css" \
  -not -path "./node_modules/*" \
  -not -path "./.github/*" \
  -not -path "./assets/*" \
  | while read -r f; do
    npx cleancss -o "$f" "$f"
    printf "%s\n%s" "$HEADER_JS" "$(cat "$f")" > "$f.tmp" && mv "$f.tmp" "$f"
  done

echo "→ Minificando HTML (sin tocar JS/CSS inline)..."
find . -type f -name "*.html" \
  -not -path "./node_modules/*" \
  -not -path "./.github/*" \
  | while read -r f; do
    npx html-minifier-terser "$f" -o "$f" \
      --collapse-whitespace \
      --remove-comments \
      --remove-attribute-quotes \
      --use-short-doctype \
      --minify-js false \
      --minify-css false
    printf "%s\n%s" "$HEADER_HTML" "$(cat "$f")" > "$f.tmp" && mv "$f.tmp" "$f"
  done

echo "→ Regenerando versión del Service Worker..."
node bump-sw.js