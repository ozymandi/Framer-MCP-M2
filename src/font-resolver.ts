import type { Framer } from "./framer-client.js";
import { suggestName } from "./helpers.js";

export class FontResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FontResolveError";
  }
}

export interface FriendlyFontSpec {
  family: string;
  weight?: number;
  style?: "normal" | "italic";
}

export async function resolveFont(
  framer: Framer,
  spec: FriendlyFontSpec,
): Promise<unknown> {
  if (!spec.family) {
    throw new FontResolveError("Font family is required.");
  }

  const attrs: Record<string, unknown> = {};
  if (spec.weight !== undefined) attrs["weight"] = spec.weight;
  if (spec.style !== undefined) attrs["style"] = spec.style;

  const font = await framer.getFont(spec.family, attrs);
  if (font) return font;

  // Build a friendly error with similar family suggestions.
  const all = (await framer.getFonts()) as ReadonlyArray<{ family: string }>;
  const families = [...new Set(all.map((f) => f.family))];
  const hint = suggestName(spec.family, families);

  const tail = hint
    ? ` Did you mean '${hint}'?`
    : ` (~${families.length} font families available; call fd_list_fonts includeAll:true to browse.)`;

  throw new FontResolveError(
    `Font '${spec.family}'${spec.weight ? ` weight ${spec.weight}` : ""}${
      spec.style ? ` ${spec.style}` : ""
    } not found.${tail}`,
  );
}
