/**
 * Brand asset checks.
 *
 * The launcher blue was once specified only in an SVG, outside the design system,
 * and nothing noticed. These assertions are the fix: the icon colour, the
 * adaptive-icon background, and the palette entry must all be the same value, and
 * the two Android layers must have the transparency their roles require.
 *
 * The alpha geometry is decoded in-process from the PNG's own IDAT chunks using
 * `node:zlib`, so nothing outside Node is required and the suite runs in a bare
 * checkout.
 *
 * Run: `bun run scripts/verify-assets.ts`
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

import { LAUNCHER_BLUE } from '#/flux/base/palette';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(
      `FAIL ${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`,
    );
  }
}

// ------------------------------------------------------------------- sources

const appJson = JSON.parse(readFileSync('app.json', 'utf8'));
const adaptive = appJson.expo.android.adaptiveIcon;

/**
 * The one-accent rule has exactly one documented exception, and it is the
 * launcher icon. These assertions are what stop that exception from quietly
 * growing into a second accent used in the UI.
 */
check(
  'adaptive background is the launcher blue',
  adaptive.backgroundColor.toUpperCase(),
  LAUNCHER_BLUE.toUpperCase(),
);
check('icon path', appJson.expo.icon, './assets/icon.png');
check('adaptive foreground path', adaptive.foregroundImage, './assets/adaptive-icon.png');

// The splash logo sits on a configured background, so a full-bleed image would
// paint over it. Both must be present and distinct from the icon's blue.
check('splash image is configured', typeof appJson.expo.plugins?.[1]?.[1]?.ios?.image, 'string');
check(
  'splash background is not the launcher blue',
  appJson.expo.plugins?.[1]?.[1]?.ios?.backgroundColor?.toUpperCase?.() !==
    LAUNCHER_BLUE.toUpperCase(),
  true,
);

// ------------------------------------------------------------- png structure

type Png = { width: number; height: number; colorType: number };

function readPngHeader(path: string): Png {
  const buffer = readFileSync(path);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    // 2 = truecolour (no alpha), 6 = truecolour with alpha.
    colorType: buffer[25],
  };
}

const icon = readPngHeader('assets/icon.png');
const adaptivePng = readPngHeader('assets/adaptive-icon.png');
const splash = readPngHeader('assets/splash-icon.png');
const favicon = readPngHeader('assets/favicon.png');

check('icon is 1024', [icon.width, icon.height], [1024, 1024]);
check('adaptive foreground is 1024', [adaptivePng.width, adaptivePng.height], [1024, 1024]);
check('splash is 1024', [splash.width, splash.height], [1024, 1024]);
check('favicon is 48', [favicon.width, favicon.height], [48, 48]);

/**
 * The asymmetry that matters: iOS applies its own mask, so the square icon must
 * be opaque; Android composites the foreground over `backgroundColor`, so the
 * adaptive foreground must carry alpha. Getting either wrong is invisible until
 * the icon is installed on a device.
 */
check('square icon is opaque (RGB)', icon.colorType, 2);
check('adaptive foreground has an alpha channel', adaptivePng.colorType, 6);
check('splash mark has an alpha channel', splash.colorType, 6);
check('favicon has an alpha channel', favicon.colorType, 6);

// ------------------------------------------------------------------- geometry

/**
 * The alpha channel of a non-interlaced 8-bit RGBA PNG, plus the bounding box
 * of its non-zero pixels.
 *
 * Decoded here rather than through an image library so the check has no
 * dependency the project does not already have. PNG scanlines are
 * filter-prefixed, so each row is unfiltered before the alpha is read.
 */
function readAlpha(path: string): {
  alphaAt: (x: number, y: number) => number;
  bbox: [number, number, number, number] | null;
} {
  const buffer = readFileSync(path);
  let offset = 8; // skip the PNG signature
  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  let colorType = 0;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (colorType !== 6) {
    // No alpha channel to inspect; report an opaque image.
    return { alphaAt: () => 255, bbox: [0, 0, width, height] };
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);

  // PNG filters, per the spec: each row encodes a delta from the row above.
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= 4 ? pixels[y * stride + i - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= 4 ? pixels[(y - 1) * stride + i - 4] : 0;
      let value = line[i];
      switch (filter) {
        case 0:
          break;
        case 1:
          value = (value + left) & 0xff;
          break;
        case 2:
          value = (value + up) & 0xff;
          break;
        case 3:
          value = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          value = (value + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          break;
      }
      pixels[y * stride + i] = value;
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[y * stride + x * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return {
    alphaAt: (x, y) => pixels[y * stride + x * 4 + 3],
    bbox: maxX < 0 ? null : [minX, minY, maxX + 1, maxY + 1],
  };
}

// Transparent corners prove the adaptive foreground really is a foreground.
const adaptiveImage = readAlpha('assets/adaptive-icon.png');
check('adaptive foreground has transparent corners', adaptiveImage.alphaAt(0, 0), 0);
check('adaptive foreground corner is transparent (far)', adaptiveImage.alphaAt(1023, 1023), 0);

// Android guarantees only the central 72/108 of the foreground is visible, so
// content outside it is cropped by whichever mask the device applies.
const bbox = adaptiveImage.bbox;
if (bbox) {
  const [x0, y0, x1, y1] = bbox;
  const side = 1024;
  const inset = (side * 18) / 108;
  check(
    'adaptive content sits inside the 72/108 safe zone',
    x0 >= inset && y0 >= inset && x1 <= side - inset && y1 <= side - inset,
    true,
  );
  // A folder is not vertically symmetric, so only the horizontal axis is
  // asserted — that is the axis an off-by-one in the path actually shows on.
  check('adaptive content is horizontally centred', Math.abs((x0 + x1) / 2 - side / 2) <= 2, true);
  // And it should fill a useful share of the safe zone, not sit tiny in it.
  check('adaptive content fills the safe zone', x1 - x0 > side * 0.6, true);
} else {
  checks += 1;
  failures += 1;
  console.log('FAIL adaptive foreground is empty');
}

const iconImage = readAlpha('assets/icon.png');
check('square icon is fully opaque', iconImage.alphaAt(0, 0), 255);

/**
 * The splash mark against the splash background.
 *
 * The first version of this mark was white, on a #f7f7f4 background: 1.07:1.
 * It rendered perfectly and was invisible. Nothing about the pipeline can catch
 * that, so it is measured here.
 */
function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The dominant opaque colour of a rendered asset, as `#rrggbb`. */
function dominantColour(path: string): string {
  const buffer = readFileSync(path);
  let offset = 8;
  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  let colorType = 0;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (colorType !== 6) return '#000000';

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= 4 ? pixels[y * stride + i - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= 4 ? pixels[(y - 1) * stride + i - 4] : 0;
      let v = line[i];
      switch (filter) {
        case 0:
          break;
        case 1:
          v = (v + left) & 0xff;
          break;
        case 2:
          v = (v + up) & 0xff;
          break;
        case 3:
          v = (v + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          v = (v + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          break;
      }
      pixels[y * stride + i] = v;
    }
  }

  // Sample on a grid; the mark is a single flat colour on transparency.
  const counts = new Map<string, number>();
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const i = y * stride + x * 4;
      if (pixels[i + 3] < 200) continue;
      const hex = `#${[pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  let best = '#000000';
  let bestCount = -1;
  for (const [hex, count] of counts) {
    if (count > bestCount) {
      best = hex;
      bestCount = count;
    }
  }
  return best;
}

const splashPlugin = appJson.expo.plugins.find(
  (entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-splash-screen',
) as
  | [string, { ios?: { backgroundColor?: string }; android?: { backgroundColor?: string } }]
  | undefined;

const splashBackground = splashPlugin?.[1]?.ios?.backgroundColor;
check('splash background is configured', typeof splashBackground, 'string');

if (splashBackground) {
  const markColour = dominantColour('assets/splash-icon.png');
  const ratio = contrastRatio(markColour, splashBackground);
  // 3:1 is the WCAG floor for a graphic. The mark is large, but a splash is the
  // first thing a user sees and 1.07:1 is not a splash at all.
  checks += 1;
  if (ratio < 3) {
    failures += 1;
    console.log(
      `FAIL splash mark ${markColour} on ${splashBackground} is ${ratio.toFixed(2)}:1, needs 3:1`,
    );
  } else {
    console.log(`ok   splash mark ${markColour} on ${splashBackground} = ${ratio.toFixed(2)}:1`);
  }
}

/** White sits on the launcher blue at 5.17:1, so the mark is legible at 16px. */
const launcherRatio = contrastRatio('#FFFFFF', LAUNCHER_BLUE);
checks += 1;
if (launcherRatio < 4.5) {
  failures += 1;
  console.log(`FAIL white folder on ${LAUNCHER_BLUE} is ${launcherRatio.toFixed(2)}:1`);
}

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
