import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerDuplicateNode(server: McpServer): void {
  server.registerTool(
    "fd_duplicate_node",
    {
      description:
        "Clone a node, creating a duplicate next to it in the canvas tree. Returns the new " +
        "node's id. To place the clone elsewhere, use fd_set_node_attributes on the result " +
        "to reposition it (or — once supported — re-parent it).",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        nodeId: z.string().min(1).describe("Source node id."),
      },
    },
    async ({ project, nodeId }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      try {
        const clone = await framer.cloneNode(nodeId);
        if (!clone) {
          return errorResult(
            `cloneNode returned null. The node may be unknown or its type may not be cloneable.`,
          );
        }
        return jsonResult({
          id: (clone as { id: string }).id,
          source: nodeId,
        });
      } catch (err) {
        return errorResult(
          `cloneNode failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
