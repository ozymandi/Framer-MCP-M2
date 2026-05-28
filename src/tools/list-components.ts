import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerListComponents(server: McpServer): void {
  server.registerTool(
    "fd_list_components",
    {
      description:
        "List components defined in the project. Each entry has { name, id } and (when " +
        "available) a list of variants. Pair with fd_screenshot or " +
        "fd_inspect_node to look closer.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
      },
    },
    async ({ project }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const components = await framer.getNodesWithType("ComponentNode");
      const out: unknown[] = [];
      for (const c of components) {
        const node = c as { id: string; componentName: string | null };
        const children = await (c as { getChildren: () => Promise<unknown[]> }).getChildren();
        out.push({
          name: node.componentName,
          id: node.id,
          variantCount: children.length,
        });
      }
      return jsonResult(out);
    },
  );
}
