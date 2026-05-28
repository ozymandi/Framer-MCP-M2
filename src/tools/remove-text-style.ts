import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findTextStyleByName } from "../style-lookup.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerRemoveTextStyle(server: McpServer): void {
  server.registerTool(
    "fd_remove_text_style",
    {
      description:
        "Delete a text style from the project. WARNING: removes the token entirely; any " +
        "text node still bound to it will fall back to a literal style or default.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z.string().min(1).describe("Text style name or path."),
      },
    },
    async ({ project, name }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const lookup = await findTextStyleByName(framer, name);
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
