import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerSetNodeAttributes(server: McpServer): void {
  server.registerTool(
    "fd_set_node_attributes",
    {
      description:
        "Generic setAttributes on any node. Pass `attrs` as a flat record. Use for Tier 2/3 " +
        "attributes not covered by the typed tools — opacity, rotation, border (border, " +
        "borderColor, borderWidth, borderStyle), overflow, z-index, position, etc. " +
        "Values must match Framer's expected types verbatim; for example padding takes " +
        "'10px' (not 10), border takes a Border object. See the framer-api docs for shapes. " +
        "Use this carefully; bad values may be silently ignored or throw.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        nodeId: z.string().min(1).describe("Target node id (from fd_inspect_node)."),
        attrs: z.record(z.unknown()).describe("Attributes to merge, in SDK shape."),
      },
    },
    async ({ project, nodeId, attrs }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const node = await framer.getNode(nodeId);
      if (!node) return errorResult(`Node '${nodeId}' not found.`);

      try {
        const updated = await (node as {
          setAttributes: (a: Record<string, unknown>) => Promise<unknown>;
        }).setAttributes(attrs as Record<string, unknown>);
        if (!updated) return errorResult(`setAttributes returned null (node may have been removed).`);
        return jsonResult({ updated: Object.keys(attrs as Record<string, unknown>) });
      } catch (err) {
        return errorResult(
          `setAttributes failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
