(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IVORY37Theme = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const FALLBACK = '#a6d94a';
  const DARK_TEXT = '#06120a';

  function luminance(rgb) {
    const channels = rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrastRatio(left, right) {
    const lighter = Math.max(left, right);
    const darker = Math.min(left, right);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function resolveColor(value) {
    const candidate = String(value == null ? '' : value).trim();
    const color = /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : FALLBACK;
    const rgb = color.slice(1).match(/../g).map((channel) => parseInt(channel, 16));
    const backgroundLuminance = luminance(rgb);
    const darkTextLuminance = luminance([6, 18, 10]);
    const whiteContrast = contrastRatio(backgroundLuminance, 1);
    const darkContrast = contrastRatio(backgroundLuminance, darkTextLuminance);
    return { color, rgb, contrast: darkContrast >= whiteContrast ? DARK_TEXT : '#ffffff' };
  }

  return { resolveColor };
});
