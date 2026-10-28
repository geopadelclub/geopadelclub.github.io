#!/usr/bin/env bash
set -euo pipefail

HEADER_CODE="© Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización."
HEADER_JS="/* $HEADER_CODE */"
HEADER_CSS="/* $HEADER_CODE */"
HEADER_HTML="<!-- $HEADER_CODE -->"

BIN="./node_modules/.bin"
for t in terser cleancss html-minifier-terser; do
  if [[ ! -x "$BIN/$t" ]]; then
    echo "❌ Error: No se encuentra $BIN/$t"
    echo "👉 Ejecuta 'npm install' para instalar las dependencias"
    exit 1
  fi
done

EXCLUDE_PATTERN='^(assets|node_modules|\.git|\.github)/|^(sw|bump-sw|copia-worker|copia-zip)\.js$|\.min\.(js|css)$'

echo "→ Minificando JS..."
git ls-files -z '*.js' \
  | grep -zvE "$EXCLUDE_PATTERN" \
  | while IFS= read -r -d '' f; do
      "$BIN/terser" "$f" -o "$f" -c -m --comments false --preamble "$HEADER_JS"
      node -c "$f" || { echo "❌ Error de sintaxis en $f"; exit 1; }
      echo "  ✓ $f"
    done

echo "→ Minificando CSS..."
git ls-files -z '*.css' \
  | grep -zvE "$EXCLUDE_PATTERN" \
  | while IFS= read -r -d '' f; do
      "$BIN/cleancss" -o "$f" "$f"
      { printf '%s\n' "$HEADER_CSS"; cat "$f"; } > "$f.tmp" && mv "$f.tmp" "$f"
      echo "  ✓ $f"
    done

echo "→ Minificando HTML..."
git ls-files -z '*.html' \
  | grep -zvE "$EXCLUDE_PATTERN" \
  | while IFS= read -r -d '' f; do
      "$BIN/html-minifier-terser" "$f" -o "$f" \
        --collapse-whitespace \
        --remove-comments \
        --remove-attribute-quotes \
        --use-short-doctype \
        --minify-js false \
        --minify-css false
      
      if head -n1 "$f" | grep -qi '^<!doctype'; then
        { head -n1 "$f"; printf '%s\n' "$HEADER_HTML"; tail -n +2 "$f"; } > "$f.tmp" && mv "$f.tmp" "$f"
      else
        { printf '%s\n' "$HEADER_HTML"; cat "$f"; } > "$f.tmp" && mv "$f.tmp" "$f"
      fi
      echo "  ✓ $f"
    done

echo "→ Regenerando versión del Service Worker..."
node bump-sw.js

echo "✅ Build completado con éxito."