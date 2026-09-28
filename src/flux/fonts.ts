import { type TextStyle } from 'react-native';

import { IS_WEB } from '#/env';
import { type Device, device } from '#/storage';

const WEB_FONT_FAMILIES = `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;

const factor = 0.0625; // 1 - (15/16)
const fontScaleMultipliers: Record<Device['fontScale'], number> = {
  '-2': 1 - factor * 1, // unused
  '-1': 1 - factor * 1,
  '0': 1, // default
  '1': 1 + factor * 1,
  '2': 1 + factor * 1, // unused
};

export function computeFontScaleMultiplier(scale: Device['fontScale']) {
  return fontScaleMultipliers[scale];
}

export function getFontScale() {
  return device.get(['fontScale']) ?? '0';
}

export function setFontScale(fontScale: Device['fontScale']) {
  device.set(['fontScale'], fontScale);
}

export function getFontFamily() {
  return device.get(['fontFamily']) || 'system';
}

export function setFontFamily(fontFamily: Device['fontFamily']) {
  device.set(['fontFamily'], fontFamily);
}

export function applyFonts(style: TextStyle, _fontFamily: 'system' | 'theme') {
  if (IS_WEB) {
    style.fontFamily = style.fontFamily || WEB_FONT_FAMILIES;
  }

  style.letterSpacing = 0.25;
}

/**
 * Here only for bundling purposes, not actually used.
 */
export { DO_NOT_USE } from '#/flux/util/unusedUseFonts';
