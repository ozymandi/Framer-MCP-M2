import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findColorStyleByName } from "../style-lookup.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerRemoveColorStyle(server: McpServer): void {
  server.registerTool(
    "fd_remove_color_style",
    {
      description:
        "Delete a color style from the project. WARNING: removes the token entirely; any " +
        "element still bound to it will fall back to a literal value or default.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z.string().min(1).describe("Color style name or path."),
      },
    },
    async ({ project, name }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const lookup = await findColorStyleByName(framer, name);
      if (!lookup.ok) return errorResult(lookup.error);
      const style = lookup.style;

      try {
        await style.remove();
        return jsonResult({ removed: style.name, path: style.path });
      } catch (err) {
        return errorResult(
          `remove failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
