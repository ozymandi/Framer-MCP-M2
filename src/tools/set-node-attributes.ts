import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AttrBuildError, resolveColorRef } from "../attr-builder.js";
import { findTextStyleByName } from "../style-lookup.js";
import {
  agentPagePathOfNode,
  errorResult,
  findNodeById,
  jsonResult,
  resolveProject,
} from "../helpers.js";

/**
 * String-typed attribute keys we auto-resolve for the caller's convenience:
 *  - `inlineTextStyle: "Headers/H1"` → SDK TextStyle instance
 *  - `backgroundColor: "#ff8800"` / `"Brand/Primary"` → RGBA literal or ColorStyle
 *  - `color: "#fff"` / `"Text/Light"` → RGBA literal or ColorStyle
 *
 * Other keys pass through unchanged.
 */
const REF_KEYS = new Set(["inlineTextStyle", "backgroundColor", "color"]);

/**
 * setAttributes silently returns null for nodes on web pages that are not
 * currently open in anyone's editor. In that case we fall back to the agent
 * DSL (`SET <id> k="v";` via framer.agent.applyChanges), which writes to any
 * page. The fallback carries primitive values verbatim; SDK-only values
 * (TextStyle/ColorStyle instances) are translated or rejected per key.
 */
function buildSetDsl(nodeId: string, attrs: Record<string, unknown>): { ok: true; dsl: string } | { ok: false; error: string } {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null) {
      parts.push(`${k}="null"`);
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      const escaped = String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      parts.push(`${k}="${escaped}"`);
      continue;
    }
    const styleId = (v as { id?: unknown }).id;
    if (typeof styleId === "string") {
      // ColorStyle → DSL token reference.
      parts.push(`${k}="var(--token-${styleId})"`);
      continue;
    }
    return {
      ok: false,
      error:
        `Attribute '${k}': value is not representable in the page-write fallback ` +
        `(node's page is not open; only primitive values and color-style names work there).`,
    };
  }
  return { ok: true, dsl: `SET ${nodeId} ${parts.join(" ")};` };
}

export function registerSetNodeAttributes(server: McpServer): void {
  server.registerTool(
    "fd_set_node_attributes",
    {
      description:
        "Generic setAttributes on any node. Pass `attrs` as a flat record. " +
        "Three keys are auto-resolved for convenience: `inlineTextStyle` (text-style " +
        "name → TextStyle), `backgroundColor`, and `color` (each accepts #hex / rgb(a) / " +
        "color-style name). Everything else passes through verbatim to SDK setAttributes; " +
        "for those, values must match Framer's expected types (padding '10px', etc). " +
        "Works on nodes of any page — pages that are not open are written via the agent DSL.",
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

      const node = await findNodeById(framer, nodeId);
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
        const updated = await (node as unknown as {
          setAttributes: (a: Record<string, unknown>) => Promise<unknown>;
        }).setAttributes(resolved);
        if (updated) return jsonResult({ updated: Object.keys(resolved) });
      } catch (err) {
        return errorResult(
          `setAttributes failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // setAttributes returned null — the node's page is not open. Write via agent DSL.
      const pagePath = await agentPagePathOfNode(framer, node);
      if (!pagePath) {
        return errorResult(
          `setAttributes returned null and no web page containing node '${nodeId}' ` +
            `was found (it may have been removed or live outside web pages).`,
        );
      }

      const dsl = buildSetDsl(nodeId, resolved);
      if (!dsl.ok) return errorResult(dsl.error);

      const agent = (framer as unknown as {
        agent: { applyChanges: (d: string, o?: { pagePath?: string }) => Promise<unknown> };
      }).agent;
      const result = await agent.applyChanges(dsl.dsl, { pagePath });
      return jsonResult({ updated: Object.keys(resolved), via: "agent-dsl", pagePath, result });
    },
  );
}
