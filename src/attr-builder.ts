import type { Framer } from "./framer-client.js";
import { ColorParseError, toFramerRgba } from "./color-parser.js";
import { findColorStyleByName, findTextStyleByName } from "./style-lookup.js";

export class AttrBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttrBuildError";
  }
}

/**
 * A 4-tuple shorthand `{ top, right, bottom, left }` or a 2-tuple
 * `{ vertical, horizontal }` or a single value.
 */
export type FriendlyBox =
  | number
  | string
  | { top?: number | string; right?: number | string; bottom?: number | string; left?: number | string }
  | { vertical?: number | string; horizontal?: number | string };

export type FriendlyBorderRadius =
  | number
  | string
  | { topLeft?: number | string; topRight?: number | string; bottomRight?: number | string; bottomLeft?: number | string };

export type StackDistributionValue =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type StackAlignmentValue = "start" | "center" | "end";

export type FriendlyLayout =
  | "none"
  | "stack"
  | "grid"
  | { type: "none" }
  | {
      type: "stack";
      direction?: "horizontal" | "vertical";
      distribute?: StackDistributionValue;
      align?: StackAlignmentValue;
      wrap?: boolean;
    }
  | { type: "grid"; columns?: number | "auto-fill"; rows?: number };

/** Friendly attribute payload accepted from clients. */
export interface FriendlyFrameAttrs {
  name?: string;
  visible?: boolean;
  opacity?: number;
  rotation?: number;
  width?: number | string;
  height?: number | string;
  aspectRatio?: number;
  backgroundColor?: string | null;
  borderRadius?: FriendlyBorderRadius;
  padding?: FriendlyBox;
  gap?: number | string | { row?: number | string; column?: number | string };
  layout?: FriendlyLayout;
}

export interface FriendlyTextAttrs {
  name?: string;
  visible?: boolean;
  opacity?: number;
  rotation?: number;
  width?: number | string;
  height?: number | string;
}

function toLength(v: number | string): string {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new AttrBuildError(`Invalid length ${v}.`);
    return `${v}px`;
  }
  return v.trim();
}

function buildPadding(input: FriendlyBox): string {
  if (typeof input === "number" || typeof input === "string") return toLength(input);
  if ("top" in input || "right" in input || "bottom" in input || "left" in input) {
    const t = toLength(input.top ?? 0);
    const r = toLength(input.right ?? 0);
    const b = toLength(input.bottom ?? 0);
    const l = toLength(input.left ?? 0);
    return `${t} ${r} ${b} ${l}`;
  }
  if ("vertical" in input || "horizontal" in input) {
    const v = toLength(input.vertical ?? 0);
    const h = toLength(input.horizontal ?? 0);
    return `${v} ${h} ${v} ${h}`;
  }
  throw new AttrBuildError("Padding object must have top/right/bottom/left or vertical/horizontal.");
}

function buildBorderRadius(input: FriendlyBorderRadius): string {
  if (typeof input === "number" || typeof input === "string") return toLength(input);
  const tl = toLength(input.topLeft ?? 0);
  const tr = toLength(input.topRight ?? 0);
  const br = toLength(input.bottomRight ?? 0);
  const bl = toLength(input.bottomLeft ?? 0);
  return `${tl} ${tr} ${br} ${bl}`;
}

function buildGap(input: number | string | { row?: number | string; column?: number | string }): string {
  if (typeof input === "number" || typeof input === "string") return toLength(input);
  if (input.row !== undefined && input.column !== undefined) {
    return `${toLength(input.column)} ${toLength(input.row)}`;
  }
  if (input.row !== undefined) return toLength(input.row);
  if (input.column !== undefined) return toLength(input.column);
  throw new AttrBuildError("Gap object must have `row` and/or `column`.");
}

/**
 * Translate a friendly layout into the *set* of SDK attributes that
 * actually configure it: `layout`, plus stack/grid sub-attributes.
 *
 * Defaults for stack: vertical direction (Framer's default is horizontal,
 * which is rarely what you want for page sections).
 */
function buildLayout(input: FriendlyLayout): Record<string, unknown> {
  if (typeof input === "string") {
    if (input === "none") return { layout: null };
    if (input === "stack") {
      return { layout: "stack", stackDirection: "vertical" };
    }
    if (input === "grid") return { layout: "grid" };
    throw new AttrBuildError(`Unknown layout '${input}'.`);
  }
  if (input.type === "none") return { layout: null };
  if (input.type === "stack") {
    const out: Record<string, unknown> = {
      layout: "stack",
      stackDirection: input.direction ?? "vertical",
    };
    if (input.distribute !== undefined) out["stackDistribution"] = input.distribute;
    if (input.align !== undefined) out["stackAlignment"] = input.align;
    if (input.wrap !== undefined) out["stackWrapEnabled"] = input.wrap;
    return out;
  }
  if (input.type === "grid") {
    const out: Record<string, unknown> = { layout: "grid" };
    if (input.columns !== undefined) out["gridColumnCount"] = input.columns;
    if (input.rows !== undefined) out["gridRowCount"] = input.rows;
    return out;
  }
  throw new AttrBuildError(`Unknown layout type.`);
}

/**
 * Resolve a backgroundColor friendly input to the form Framer expects:
 * either an RGBA string or a ColorStyle instance.
 *
 * Accepts hex / rgb / rgba strings, or a color-style name / path.
 */
async function resolveBackgroundColor(
  framer: Framer,
  value: string,
): Promise<unknown> {
  const trimmed = value.trim();
  // Likely raw color literal.
  if (trimmed.startsWith("#") || /^rgba?\s*\(/i.test(trimmed)) {
    try {
      return toFramerRgba(trimmed);
    } catch (err) {
      if (err instanceof ColorParseError) throw new AttrBuildError(err.message);
      throw err;
    }
  }
  // Otherwise treat as color-style name/path.
  const lookup = await findColorStyleByName(framer, trimmed);
  if (!lookup.ok) {
    throw new AttrBuildError(
      `backgroundColor: ${lookup.error} ` +
        `(If you meant a literal color, prefix it with '#' or use rgb()/rgba().)`,
    );
  }
  return lookup.style;
}

export async function buildFrameAttributes(
  framer: Framer,
  input: FriendlyFrameAttrs,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out["name"] = input.name;
  if (input.visible !== undefined) out["visible"] = input.visible;
  if (input.opacity !== undefined) out["opacity"] = input.opacity;
  if (input.rotation !== undefined) out["rotation"] = input.rotation;
  if (input.width !== undefined) out["width"] = toLength(input.width);
  if (input.height !== undefined) out["height"] = toLength(input.height);
  if (input.aspectRatio !== undefined) out["aspectRatio"] = input.aspectRatio;
  if (input.backgroundColor !== undefined) {
    out["backgroundColor"] =
      input.backgroundColor === null
        ? null
        : await resolveBackgroundColor(framer, input.backgroundColor);
  }
  if (input.borderRadius !== undefined) out["borderRadius"] = buildBorderRadius(input.borderRadius);
  if (input.padding !== undefined) out["padding"] = buildPadding(input.padding);
  if (input.gap !== undefined) out["gap"] = buildGap(input.gap);
  if (input.layout !== undefined) {
    Object.assign(out, buildLayout(input.layout));
  }
  return out;
}

export async function buildTextAttributes(
  _framer: Framer,
  input: FriendlyTextAttrs,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out["name"] = input.name;
  if (input.visible !== undefined) out["visible"] = input.visible;
  if (input.opacity !== undefined) out["opacity"] = input.opacity;
  if (input.rotation !== undefined) out["rotation"] = input.rotation;
  if (input.width !== undefined) out["width"] = toLength(input.width);
  if (input.height !== undefined) out["height"] = toLength(input.height);
  return out;
}

/**
 * Resolve a textStyle reference (name or path) into the SDK TextStyle instance.
 */
export async function resolveTextStyleRef(
  framer: Framer,
  name: string,
): Promise<unknown> {
  const lookup = await findTextStyleByName(framer, name);
  if (!lookup.ok) throw new AttrBuildError(lookup.error);
  return lookup.style;
}
