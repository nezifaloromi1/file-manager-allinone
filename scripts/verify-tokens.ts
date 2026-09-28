/**
 * Contrast and design-token checks (plan.md §40).
 *
 * A palette mistake is invisible in code review and obvious to a user with
 * low vision. Nothing in the project would have caught a contrast regression,
 * so this does: every foreground/background pair the app actually renders is
 * measured in all three themes against WCAG AA.
 *
 * Run: `bun run scripts/verify-tokens.ts`
 */

import { themes } from '#/flux/base/themes';
import { type Theme } from '#/flux/base/themes';
import {
  byteUnitLabels,
  byteUnits,
  duration,
  fileTypeTint,
  layer,
  scrim,
  storageFill,
  storageFillLevel,
  touchTarget,
} from '#/flux/base/tokens';
import { formatBytes } from '#/core/utils/format';

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

// ------------------------------------------------------------------ contrast

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const rgb = toRgb(hex);
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * The pairs the app actually renders.
 *
 * Named for where they appear, not for what they are: "row name" is a fact
 * about the UI that can be audited, whereas "text vs background" is a restatement
 * of the tokens.
 */
const PAIRS: { name: string; fg: (t: Theme) => string; bg: (t: Theme) => string; min: number }[] = [
  {
    name: 'primary text on canvas',
    fg: (t) => t.atoms.text.color,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
  {
    name: 'body text on canvas',
    fg: (t) => t.atoms.text_contrast_medium.color,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
  {
    name: 'caption text on canvas',
    fg: (t) => t.atoms.text_contrast_low.color,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 3,
  },
  {
    name: 'primary text on card',
    fg: (t) => t.atoms.text.color,
    bg: (t) => t.atoms.bg_card.backgroundColor,
    min: 4.5,
  },
  {
    name: 'body text on card',
    fg: (t) => t.atoms.text_contrast_medium.color,
    bg: (t) => t.atoms.bg_card.backgroundColor,
    min: 4.5,
  },
  {
    name: 'caption text on card',
    fg: (t) => t.atoms.text_contrast_low.color,
    bg: (t) => t.atoms.bg_card.backgroundColor,
    min: 3,
  },
  {
    name: 'label on accent button',
    fg: (t) => t.atoms.text_on_accent.color,
    bg: (t) => t.atoms.bg_accent.backgroundColor,
    min: 4.5,
  },
  {
    name: 'label on destructive button',
    fg: (t) => t.atoms.text_inverted.color,
    bg: (t) => t.atoms.bg_destructive.backgroundColor,
    min: 4.5,
  },
  {
    name: 'link text on canvas',
    fg: (t) => t.atoms.text_link.color,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
  {
    name: 'success text on canvas',
    fg: (t) => t.atoms.text_success.color,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
  {
    name: 'error text on canvas',
    fg: (t) => t.atoms.text_error.color,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
  {
    name: 'success text on success surface',
    fg: (t) => t.atoms.text_success_strong.color,
    bg: (t) => t.atoms.bg_success.backgroundColor,
    min: 4.5,
  },
  {
    name: 'error text on error surface',
    fg: (t) => t.atoms.text_error_strong.color,
    bg: (t) => t.atoms.bg_error.backgroundColor,
    min: 4.5,
  },
  {
    name: 'accent on canvas (selection ring)',
    fg: (t) => t.palette.primary_500,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 3,
  },
  {
    name: 'warning text on canvas',
    fg: (t) => t.palette.semantic_warning,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
  {
    name: 'info text on canvas',
    fg: (t) => t.palette.semantic_info,
    bg: (t) => t.atoms.bg.backgroundColor,
    min: 4.5,
  },
];

for (const themeName of ['light', 'dark', 'dim'] as const) {
  const t = themes[themeName];

  for (const pair of PAIRS) {
    checks += 1;
    const ratio = contrast(pair.fg(t), pair.bg(t));
    if (ratio < pair.min) {
      failures += 1;
      console.log(
        `FAIL ${themeName}: ${pair.name} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1 ` +
          `(${pair.fg(t)} on ${pair.bg(t)})`,
      );
    }
  }
}

// A theme that inverts lightness must actually change the contrast, or one of
// them is measuring the wrong pair.
check(
  'dark canvas is darker than light',
  luminance(themes.dark.atoms.bg.backgroundColor) <
    luminance(themes.light.atoms.bg.backgroundColor),
  true,
);
check(
  'dark text is lighter than light text',
  luminance(themes.dark.atoms.text.color) > luminance(themes.light.atoms.text.color),
  true,
);

/**
 * Status colours are authored as light/dark *pairs*, because no single value can
 * reach 4.5:1 on both canvases. The invariant is that the **hue** holds — a green
 * must stay green — not that the exact hex is shared.
 */
function hue(hex: string): number {
  const [r, g, b] = toRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

for (const key of [
  'semantic_success',
  'semantic_error',
  'semantic_warning',
  'semantic_info',
] as const) {
  const lightHue = hue(themes.light.palette[key]);
  const darkHue = hue(themes.dark.palette[key]);
  // Generous: the pairs were hand-authored, so exact hue equality is not the
  // claim. What must not happen is a green becoming a blue between themes.
  const drift = Math.min(Math.abs(lightHue - darkHue), 360 - Math.abs(lightHue - darkHue));
  checks += 1;
  if (drift > 20) {
    failures += 1;
    console.log(
      `FAIL ${key} hue drifts ${drift.toFixed(0)}deg between themes (${lightHue.toFixed(0)} -> ${darkHue.toFixed(0)})`,
    );
  }
}

// --------------------------------------------------------------- token rules

// Touch targets: `accessible` is the AAA floor, nothing interactive may be below
// the AA floor, and the scale must be ordered.
check('target scale is ordered', touchTarget.compact < touchTarget.comfortable, true);
check('comfortable meets AA', touchTarget.comfortable >= 44, true);
check('accessible exceeds AA', touchTarget.accessible >= touchTarget.comfortable, true);
check('row is tall enough to tap', touchTarget.row >= touchTarget.compact, true);

// Layers must be strictly increasing, or "above" and "below" become ambiguous.
const layerValues = Object.values(layer);
check(
  'layers are ordered',
  layerValues.every((v, i) => i === 0 || v > layerValues[i - 1]),
  true,
);
check('tab bar is above sticky', layer.tabBar > layer.sticky, true);
check('sheet is above the tab bar', layer.sheet > layer.tabBar, true);
check('modal is above a sheet', layer.modal > layer.sheet, true);
check('toast outranks a modal', layer.toast > layer.modal, true);

// Durations must be ordered, and a "quick" state change must actually be quick.
check('duration scale is ordered', duration.quick < duration.base, true);
check('quick is under 200ms', duration.quick <= 200, true);
check('loop duration is the slowest', duration.slow > duration.base, true);

// Byte units must be a consistent binary ladder.
check('byte base', byteUnits.kilo, 1024);
check('byte mega', byteUnits.mega, 1024 ** 2);
check('byte giga', byteUnits.giga, 1024 ** 3);
check('byte tera', byteUnits.tera, 1024 ** 4);
check('unit labels start at B', byteUnitLabels[0], 'B');
check('unit labels end at PB', byteUnitLabels[byteUnitLabels.length - 1], 'PB');

// `formatBytes` must still agree with the tokens it now reads from.
check('formatBytes uses the token base', formatBytes(byteUnits.kilo), '1.0 KB');
check('formatBytes giga boundary', formatBytes(byteUnits.giga), '1.0 GB');
check('formatBytes below base', formatBytes(byteUnits.kilo - 1), '1023 B');

// Storage fill: a bar must be classified, never colour-only, and the
// thresholds must be ordered so `critical` is reachable.
check('fill thresholds are ordered', storageFill.low < storageFill.nominal, true);
check('fill thresholds ordered 2', storageFill.nominal < storageFill.high, true);
check('fill is a 0-1 ratio', storageFillLevel(0.5), 'ok');
check('fill warns at nominal', storageFillLevel(storageFill.nominal), 'warn');
check('fill critical at high', storageFillLevel(storageFill.high), 'critical');
check('fill clamps above 1', storageFillLevel(2), 'critical');
check('fill clamps below 0', storageFillLevel(-1), 'ok');

// File-type tint: every type must be classified exactly once, or a type either
// gets an accent it should not have or is missed entirely.
const allTypes = [
  'DIRECTORY',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'ARCHIVE',
  'APK',
  'TEXT',
  'CODE',
  'FONT',
  'UNKNOWN',
];
const classified = [...fileTypeTint.tinted, ...fileTypeTint.plain];
check(
  'tint sets do not overlap',
  fileTypeTint.tinted.filter((t) => fileTypeTint.plain.includes(t as never)),
  [],
);
check('every type is classified', classified.slice().sort(), allTypes.slice().sort());
check('no type is classified twice', classified.length, allTypes.length);

// Scrim must be a real overlay: present, and not so opaque that content behind
// it is invisible (which would make it a solid panel, not a scrim).
check('scrim is defined', typeof scrim.background, 'string');
check('scrim is translucent', scrim.background.startsWith('rgba'), true);

console.log(`${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
if (failures > 0) process.exit(1);
