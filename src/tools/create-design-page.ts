import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerCreateDesignPage(server: McpServer): void {
  server.registerTool(
    "fd_create_design_page",
    {
      description:
        "Create a new design page (a free-form canvas for drafts and components). " +
        "Returns the new page's id and name. Use as the `parent` argument for fd_add_frame / " +
        "fd_add_text to populate it.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        name: z.string().min(1).describe("Display name for the new design page."),
      },
    },
    async ({ project, name }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      try {
        const page = await framer.createDesignPage(name);
        return jsonResult({
          id: (page as { id: string }).id,
          name: (page as { name: string | null }).name,
        });
      } catch (err) {
        return errorResult(
          `createDesignPage failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
