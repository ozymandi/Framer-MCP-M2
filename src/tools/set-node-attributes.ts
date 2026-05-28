import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AttrBuildError, resolveColorRef } from "../attr-builder.js";
import { findTextStyleByName } from "../style-lookup.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

/**
 * String-typed attribute keys we auto-resolve for the caller's convenience:
 *  - `inlineTextStyle: "Headers/H1"` → SDK TextStyle instance
 *  - `backgroundColor: "#ff8800"` / `"Brand/Primary"` → RGBA literal or ColorStyle
 *  - `color: "#fff"` / `"Text/Light"` → RGBA literal or ColorStyle
 *
 * Other keys pass through unchanged.
 */
const REF_KEYS = new Set(["inlineTextStyle", "backgroundColor", "color"]);

export function registerSetNodeAttributes(server: McpServer): void {
  server.registerTool(
    "fd_set_node_attributes",
    {
      description:
        "Generic setAttributes on any node. Pass `attrs` as a flat record. " +
        "Three keys are auto-resolved for convenience: `inlineTextStyle` (text-style " +
        "name → TextStyle), `backgroundColor`, and `color` (each accepts #hex / rgb(a) / " +
        "color-style name). Everything else passes through verbatim to SDK setAttributes; " +
        "for those, values must match Framer's expected types (padding '10px', etc).",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        nodeId: z.string().min(1).describe("Target node id (from fd_inspect_node)."),
        attrs: z.record(z.unknown()).describe("Attributes to merge."),
      },
    },
    async ({ project, nodeId, attrs }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const node = await framer.getNode(nodeId);
      if (!node) return errorResult(`Node '${nodeId}' not found.`);

      const resolved: Record<string, unknown> = {};
      try {
        for (const [k, v] of Object.entries(attrs as Record<string, unknown>)) {
          if (REF_KEYS.has(k) && typeof v === "string") {
            if (k === "inlineTextStyle") {
              const lookup = await findTextStyleByName(framer, v);
              if (!lookup.ok) {
                return errorResult(`${k}: ${lookup.error}`);
              }
              resolved[k] = lookup.style;
            } else {
              // backgroundColor / color
              resolved[k] = await resolveColorRef(framer, v);
            }
          } else {
            resolved[k] = v;
          }
        }
      } catch (err) {
        if (err instanceof AttrBuildError) return errorResult(err.message);
        throw err;
      }

      try {
        const updated = await (node as {
          setAttributes: (a: Record<string, unknown>) => Promise<unknown>;
        }).setAttributes(resolved);
        if (!updated) return errorResult(`setAttributes returned null (node may have been removed).`);
        return jsonResult({ updated: Object.keys(resolved) });
      } catch (err) {
        return errorResult(
          `setAttributes failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
