import type { Framer } from "./framer-client.js";
import { suggestName } from "./helpers.js";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, "");
}

export interface ColorStyleRef {
  id: string;
  name: string;
  path: string;
  setAttributes: (a: { light?: string; dark?: string | null }) => Promise<unknown>;
  remove: () => Promise<void>;
}

export interface TextStyleRef {
  id: string;
  name: string;
  path: string;
  setAttributes: (a: Record<string, unknown>) => Promise<unknown>;
  remove: () => Promise<void>;
}

/**
 * Find a color style by name (or `path/name`) with tolerant matching.
 * Matches against both name and full path.
 */
export async function findColorStyleByName(
  framer: Framer,
  target: string,
): Promise<{ ok: true; style: ColorStyleRef } | { ok: false; error: string }> {
  const all = (await framer.getColorStyles()) as ReadonlyArray<ColorStyleRef>;
  const t = normalize(target);
  const hit = all.find((s) => normalize(s.name) === t || normalize(s.path) === t);
  if (hit) return { ok: true, style: hit };

  const known = all.map((s) => s.path || s.name);
  const hint = suggestName(target, known);
  return {
    ok: false,
    error:
      `Color style '${target}' not found.` +
      (hint ? ` Did you mean '${hint}'?` : ` Known: ${known.slice(0, 20).join(", ")}.`),
  };
}

export async function findTextStyleByName(
  framer: Framer,
  target: string,
): Promise<{ ok: true; style: TextStyleRef } | { ok: false; error: string }> {
  const all = (await framer.getTextStyles()) as ReadonlyArray<TextStyleRef>;
  const t = normalize(target);
  const hit = all.find((s) => normalize(s.name) === t || normalize(s.path) === t);
  if (hit) return { ok: true, style: hit };

  const known = all.map((s) => s.path || s.name);
  const hint = suggestName(target, known);
  return {
    ok: false,
    error:
      `Text style '${target}' not found.` +
      (hint ? ` Did you mean '${hint}'?` : ` Known: ${known.slice(0, 20).join(", ")}.`),
  };
}
