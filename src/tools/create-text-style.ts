import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AttrBuildError, resolveColorRef } from "../attr-builder.js";
import { FontResolveError, resolveFont } from "../font-resolver.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerCreateTextStyle(server: McpServer): void {
  server.registerTool(
    "fd_create_text_style",
    {
      description:
        "Create a new text style (typography token). Optionally bind a font via " +
        "fontFamily/fontWeight/fontStyle — server looks up the matching Font. " +
        "Optionally bind a color via hex/rgba string or an existing color-style name. " +
        "Use '/' in `name` to nest into folders (e.g. 'Headers/H1').",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z.string().min(1).describe("Display name. Use '/' for folder nesting."),
        tag: z.enum(["h1", "h2", "h3", "h4", "h5", "h6", "p"]).optional().describe("HTML tag."),
        fontFamily: z.string().optional().describe("Font family, e.g. 'Inter' or 'Erode'."),
        fontWeight: z.number().int().optional().describe("Font weight, e.g. 400, 600, 700."),
        fontStyle: z.enum(["normal", "italic"]).optional().describe("Font style."),
        fontSize: z.string().optional().describe("Font size with unit, e.g. '32px' or '2rem'."),
        lineHeight: z.string().optional().describe("Line height, e.g. '1.4' or '40px'."),
        letterSpacing: z.string().optional().describe("Letter spacing, e.g. '-0.02em'."),
        color: z
          .string()
          .optional()
          .describe(
            "Optional text color: #hex, rgb(...), rgba(...), OR the name of an " +
              "existing color style.",
          ),
      },
    },
    async ({
      project,
      name,
      tag,
      fontFamily,
      fontWeight,
      fontStyle,
      fontSize,
      lineHeight,
      letterSpacing,
      color,
    }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const attrs: Record<string, unknown> = { name };
      if (tag) attrs["tag"] = tag;
      if (fontSize) attrs["fontSize"] = fontSize;
      if (lineHeight) attrs["lineHeight"] = lineHeight;
      if (letterSpacing) attrs["letterSpacing"] = letterSpacing;

      if (fontFamily) {
        try {
          const fontSpec: { family: string; weight?: number; style?: "normal" | "italic" } = {
            family: fontFamily,
          };
          if (fontWeight !== undefined) fontSpec.weight = fontWeight;
          if (fontStyle !== undefined) fontSpec.style = fontStyle;
          attrs["font"] = await resolveFont(framer, fontSpec);
        } catch (err) {
          if (err instanceof FontResolveError) return errorResult(err.message);
          throw err;
        }
      } else if (fontWeight !== undefined || fontStyle !== undefined) {
        return errorResult(
          "`fontWeight` and `fontStyle` only apply when `fontFamily` is provided.",
        );
      }

      if (color) {
        try {
          attrs["color"] = await resolveColorRef(framer, color);
        } catch (err) {
          if (err instanceof AttrBuildError) return errorResult(`color: ${err.message}`);
          throw err;
        }
      }

      try {
        const style = await framer.createTextStyle(attrs);
        return jsonResult({
          name: (style as { name: string }).name,
          path: (style as { path: string }).path,
          id: (style as { id: string }).id,
        });
      } catch (err) {
        return errorResult(
          `createTextStyle failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
