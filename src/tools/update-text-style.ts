import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FontResolveError, resolveFont } from "../font-resolver.js";
import { findTextStyleByName } from "../style-lookup.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerUpdateTextStyle(server: McpServer): void {
  server.registerTool(
    "fd_update_text_style",
    {
      description:
        "Update an existing text style. Pass only the attributes you want to change. " +
        "Changing the font requires fontFamily (and optionally fontWeight/fontStyle). " +
        "WARNING: changes cascade to every text bound to this token.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z.string().min(1).describe("Existing text style name or path."),
        tag: z.enum(["h1", "h2", "h3", "h4", "h5", "h6", "p"]).optional(),
        fontFamily: z.string().optional(),
        fontWeight: z.number().int().optional(),
        fontStyle: z.enum(["normal", "italic"]).optional(),
        fontSize: z.string().optional(),
        lineHeight: z.string().optional(),
        letterSpacing: z.string().optional(),
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
    }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const patch: Record<string, unknown> = {};
      if (tag !== undefined) patch["tag"] = tag;
      if (fontSize !== undefined) patch["fontSize"] = fontSize;
      if (lineHeight !== undefined) patch["lineHeight"] = lineHeight;
      if (letterSpacing !== undefined) patch["letterSpacing"] = letterSpacing;

      if (fontFamily) {
        try {
          const fontSpec: { family: string; weight?: number; style?: "normal" | "italic" } = {
            family: fontFamily,
          };
          if (fontWeight !== undefined) fontSpec.weight = fontWeight;
          if (fontStyle !== undefined) fontSpec.style = fontStyle;
          patch["font"] = await resolveFont(framer, fontSpec);
        } catch (err) {
          if (err instanceof FontResolveError) return errorResult(err.message);
          throw err;
        }
      } else if (fontWeight !== undefined || fontStyle !== undefined) {
        return errorResult(
          "`fontWeight` and `fontStyle` only apply when `fontFamily` is also provided.",
        );
      }

      if (Object.keys(patch).length === 0) {
        return errorResult("Nothing to update. Provide at least one attribute.");
      }

      const lookup = await findTextStyleByName(framer, name);
      if (!lookup.ok) return errorResult(lookup.error);
      const style = lookup.style;

      try {
        await style.setAttributes(patch);
        return jsonResult({
          name: style.name,
          path: style.path,
          updated: Object.keys(patch),
        });
      } catch (err) {
        return errorResult(
          `update failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
