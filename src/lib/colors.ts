/**
 * Deterministic color generation from a string, used for fallback item
 * icons and badges when the PNG icon cannot be loaded.
 *
 * The hash produces an HSL color with fixed saturation and lightness,
 * varying only the hue based on the input string.
 */

/**
 * Generates a deterministic HSL color string from a string name.
 * The hue is derived from a simple hash of the input, ensuring the
 * same name always maps to the same color.
 *
 * @param name - An item name or class name (e.g. "IronPlate").
 * @returns An HSL color string like "hsl(210, 45%, 38%)".
 */
export function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(h) % 360}, 45%, 38%)`;
}
