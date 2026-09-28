#!/usr/bin/env bash
#
# Regenerate the launcher and brand assets from their source SVGs.
#
# The PNGs in ../ are build output. Editing them directly is how the app icon and
# the design system drift apart — the blue was already outside the palette once,
# and nothing noticed. So the SVGs are the source of truth and this script is the
# only supported way to change the output.
#
# Requires rsvg-convert (librsvg). Run from anywhere:  ./assets/logo/build.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$(dirname "$here")"          # assets/

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert not found. Install librsvg (apt install librsvg2-bin)." >&2
  exit 1
fi

# Android/iOS app icon: 1024px, full-bleed. These platforms apply their own
# mask, so the background belongs in the image.
rsvg-convert -w 1024 -h 1024 "$here/full.svg" -o "$out/icon.png"

# Android adaptive icon FOREGROUND: 1024px, transparent. The background colour
# comes from `adaptiveIcon.backgroundColor` in app.json; an opaque layer here
# would cover it and defeat the adaptive mask and parallax.
rsvg-convert -w 1024 -h 1024 "$here/mark.svg" -o "$out/adaptive-icon.png"

# Expo splash logo: 1024px, transparent, `resizeMode: contain` over the
# configured splash background. Its own cut — see splash.svg for why the mark
# cannot be the white one.
rsvg-convert -w 1024 -h 1024 "$here/splash.svg" -o "$out/splash-icon.png"

# Favicon: 48px, its own redrawn cut.
rsvg-convert -w 48 -h 48 "$here/favicon.svg" -o "$out/favicon.png"

echo "Rebuilt:"
for f in icon adaptive-icon splash-icon favicon; do
  printf '  %-18s %s\n' "$f.png" "$(du -h "$out/$f.png" | cut -f1)"
done
