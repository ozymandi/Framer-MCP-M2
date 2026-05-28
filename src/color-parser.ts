export class ColorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ColorParseError";
  }
}

/**
 * Convert a friendly color string into Framer's canonical
 * `rgba(R, G, B, A)` form.
 *
 * Accepts:
 *  - "#rgb"          ("#f80")
 *  - "#rrggbb"       ("#ff8800")
 *  - "#rrggbbaa"     ("#ff8800cc")
 *  - "rgb(r, g, b)"
 *  - "rgba(r, g, b, a)"
 */
export function toFramerRgba(input: string): string {
  const trimmed = input.trim();

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      if (!validRgb(r, g, b)) throw new ColorParseError(`Invalid hex '${input}'.`);
      return formatRgba(r, g, b, 1);
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!validRgb(r, g, b)) throw new ColorParseError(`Invalid hex '${input}'.`);
      return formatRgba(r, g, b, 1);
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16);
      if (!validRgb(r, g, b) || Number.isNaN(a)) {
        throw new ColorParseError(`Invalid hex '${input}'.`);
      }
      return formatRgba(r, g, b, +(a / 255).toFixed(3));
    }
    throw new ColorParseError(
      `Hex color '${input}' must be #rgb, #rrggbb, or #rrggbbaa.`,
    );
  }

  const rgbaMatch = /^rgba?\s*\(\s*([^\s,]+)\s*,\s*([^\s,]+)\s*,\s*([^\s,]+)\s*(?:,\s*([^\s)]+)\s*)?\)$/i.exec(
    trimmed,
  );
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);
    if (!validRgb(r, g, b) || Number.isNaN(a) || a < 0 || a > 1) {
      throw new ColorParseError(`Invalid rgb/rgba '${input}'.`);
    }
    return formatRgba(r, g, b, a);
  }

  throw new ColorParseError(
    `Unrecognized color '${input}'. Use #rgb, #rrggbb, #rrggbbaa, rgb(...), or rgba(...).`,
  );
}

function formatRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function validRgb(r: number, g: number, b: number): boolean {
  return (
    Number.isFinite(r) &&
    Number.isFinite(g) &&
    Number.isFinite(b) &&
    r >= 0 &&
    r <= 255 &&
    g >= 0 &&
    g <= 255 &&
    b >= 0 &&
    b <= 255
  );
}
