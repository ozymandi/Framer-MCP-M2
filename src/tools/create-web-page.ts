import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerCreateWebPage(server: McpServer): void {
  server.registerTool(
    "fd_create_web_page",
    {
      description:
        "Create a new web page in the project. Path should start with '/' (e.g. '/about'). " +
        "Returns the new page's id and path. Use as the `parent` argument for fd_add_frame / " +
        "fd_add_text to populate it.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        path: z
          .string()
          .min(1)
          .regex(/^\//, "Path must start with '/'.")
          .describe("URL path, e.g. '/about' or '/blog/[slug]' for CMS detail pages."),
      },
    },
    async ({ project, path }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      try {
        const page = await framer.createWebPage(path);
        return jsonResult({
          id: (page as { id: string }).id,
          path: (page as { path: string | null }).path,
        });
      } catch (err) {
        return errorResult(
          `createWebPage failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
