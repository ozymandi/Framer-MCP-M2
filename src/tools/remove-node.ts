import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerRemoveNode(server: McpServer): void {
  server.registerTool(
    "fd_remove_node",
    {
      description:
        "Remove one or more nodes from the canvas by id. WARNING: destructive. Removing a " +
        "page wipes its entire content. Removing a parent frame removes all its descendants.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        nodeIds: z.array(z.string().min(1)).min(1).max(100).describe("Node ids to remove."),
      },
    },
    async ({ project, nodeIds }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      try {
        await framer.removeNodes(nodeIds);
        return jsonResult({ removed: nodeIds });
      } catch (err) {
        return errorResult(
          `removeNodes failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
