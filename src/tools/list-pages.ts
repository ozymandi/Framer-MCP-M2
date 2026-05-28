import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerListPages(server: McpServer): void {
  server.registerTool(
    "fd_list_pages",
    {
      description:
        "List all pages in the project. Web pages have a `path` (e.g. '/about'); design pages " +
        "have a `name`. Use either to target subsequent tools like fd_screenshot " +
        "or fd_inspect_node.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
      },
    },
    async ({ project }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const webPages = await framer.getNodesWithType("WebPageNode");
      const designPages = await framer.getNodesWithType("DesignPageNode");

      const out: unknown[] = [];

      for (const p of webPages) {
        const node = p as { id: string; path: string | null; collectionId: string | null };
        const children = await (p as { getChildren: () => Promise<unknown[]> }).getChildren();
        out.push({
          type: "Web",
          path: node.path,
          isCmsDetail: node.collectionId !== null,
          childCount: children.length,
          id: node.id,
        });
      }

      for (const p of designPages) {
        const node = p as { id: string; name: string | null };
        const children = await (p as { getChildren: () => Promise<unknown[]> }).getChildren();
        out.push({
          type: "Design",
          name: node.name,
          childCount: children.length,
          id: node.id,
        });
      }

      return jsonResult(out);
    },
  );
}
