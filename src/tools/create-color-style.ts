import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ColorParseError, toFramerRgba } from "../color-parser.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerCreateColorStyle(server: McpServer): void {
  server.registerTool(
    "fd_create_color_style",
    {
      description:
        "Create a new color style (color token) in the project. Accepts hex (#rgb, " +
        "#rrggbb, #rrggbbaa), rgb(...), or rgba(...) — server normalizes to Framer's " +
        "rgba format. Use '/' in `name` to nest into folders (e.g. 'Brand/Primary').",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z.string().min(1).describe("Display name. Use '/' for folder nesting."),
        light: z.string().min(1).describe("Color in #hex or rgb(a) form, used in light theme."),
        dark: z
          .string()
          .optional()
          .describe("Optional color for dark theme. Same input formats as `light`."),
      },
    },
    async ({ project, name, light, dark }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      let lightRgba: string;
      let darkRgba: string | undefined;
      try {
        lightRgba = toFramerRgba(light);
        if (dark) darkRgba = toFramerRgba(dark);
      } catch (err) {
        if (err instanceof ColorParseError) return errorResult(err.message);
        throw err;
      }

      try {
        const style = await framer.createColorStyle({
          name,
          light: lightRgba,
          ...(darkRgba !== undefined ? { dark: darkRgba } : {}),
        });
        return jsonResult({
          name: (style as { name: string }).name,
          path: (style as { path: string }).path,
          light: lightRgba,
          dark: darkRgba ?? null,
          id: (style as { id: string }).id,
        });
      } catch (err) {
        return errorResult(
          `createColorStyle failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
