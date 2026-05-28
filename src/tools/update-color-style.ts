import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ColorParseError, toFramerRgba } from "../color-parser.js";
import { findColorStyleByName } from "../style-lookup.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerUpdateColorStyle(server: McpServer): void {
  server.registerTool(
    "fd_update_color_style",
    {
      description:
        "Update an existing color style's values. Pass `light` and/or `dark`. " +
        "WARNING: changing a color cascades to every element that uses this token.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z
          .string()
          .min(1)
          .describe("Existing color style name or path (case-insensitive, ignores spaces)."),
        light: z.string().optional().describe("New light-theme color (#hex or rgb[a])."),
        dark: z
          .string()
          .optional()
          .describe("New dark-theme color, or empty string to clear it."),
      },
    },
    async ({ project, name, light, dark }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      if (light === undefined && dark === undefined) {
        return errorResult("Provide at least one of `light` or `dark`.");
      }

      const lookup = await findColorStyleByName(framer, name);
      if (!lookup.ok) return errorResult(lookup.error);
      const style = lookup.style;

      const patch: { light?: string; dark?: string | null } = {};
      try {
        if (light !== undefined) patch.light = toFramerRgba(light);
        if (dark !== undefined) {
          patch.dark = dark === "" ? null : toFramerRgba(dark);
        }
      } catch (err) {
        if (err instanceof ColorParseError) return errorResult(err.message);
        throw err;
      }

      try {
        await style.setAttributes(patch);
        return jsonResult({
          name: style.name,
          path: style.path,
          light: patch.light ?? "(unchanged)",
          dark: patch.dark === undefined ? "(unchanged)" : patch.dark,
        });
      } catch (err) {
        return errorResult(
          `update failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
