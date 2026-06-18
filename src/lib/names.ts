/**
 * Simple string normalization utility for Satisfactory class names.
 *
 * Strips the `Build_` prefix and `_C` suffix from Unreal Engine class
 * names and replaces remaining underscores with spaces, producing a
 * human-readable label.
 */

/**
 * Converts a Satisfactory class name into a clean display label.
 *
 * @example
 * cleanName('Build_TrainStation_C')    // "Train Station"
 * cleanName('Build_ConstructorMk1_C')   // "Constructor Mk1"
 *
 * @param name - A raw Unreal class name with optional Build_ prefix and _C suffix.
 * @returns A human-readable display string.
 */
export function cleanName(name: string): string {
  return name.replace(/^Build_/, '').replace(/_C$/, '').replace(/_/g, ' ');
}
