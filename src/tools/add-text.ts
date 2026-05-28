import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AttrBuildError,
  buildTextAttributes,
  resolveTextStyleRef,
  type FriendlyTextAttrs,
} from "../attr-builder.js";
import { errorResult, jsonResult, resolveNodeTarget, resolveProject } from "../helpers.js";

const lengthSchema = z.union([z.number(), z.string()]);

export function registerAddText(server: McpServer): void {
  server.registerTool(
    "fd_add_text",
    {
      description:
        "Add a new Text node under a parent and set its plain-text content. Parent can be a " +
        "node id, web page path, or design page name. Optional textStyle binds the new node to " +
        "an existing text style (e.g. 'Headers/H1'). For raw font control without a style, use " +
        "fd_set_node_attributes after creation.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        parent: z.string().min(1).describe("Parent node id, web page path, or design page name."),
        text: z.string().describe("Plain-text content (not HTML)."),
        name: z.string().optional().describe("Display name for the layer."),
        textStyle: z
          .string()
          .optional()
          .describe("Name or path of an existing text style to bind to this node."),
        visible: z.boolean().optional(),
        opacity: z.number().min(0).max(1).optional(),
        rotation: z.number().optional(),
        width: lengthSchema.optional(),
        height: lengthSchema.optional(),
      },
    },
    async ({ project, parent, text, textStyle, ...rest }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const resolved = await resolveNodeTarget(framer, parent);
      if (!resolved.ok) return errorResult(`Parent: ${resolved.error}`);

      let attrs;
      try {
        attrs = await buildTextAttributes(framer, rest as FriendlyTextAttrs);
        if (textStyle) {
          attrs["inlineTextStyle"] = await resolveTextStyleRef(framer, textStyle);
        }
      } catch (err) {
        if (err instanceof AttrBuildError) return errorResult(err.message);
        throw err;
      }

      try {
        const node = await framer.createTextNode(attrs, resolved.nodeId);
        if (!node) {
          return errorResult(
            `createTextNode returned null. Parent may not accept text children, or attributes may be invalid.`,
          );
        }
        await (node as { setText: (t: string) => Promise<void> }).setText(text);
        return jsonResult({
          id: (node as { id: string }).id,
          name: (node as { name: string | null }).name,
          parent: resolved.label,
        });
      } catch (err) {
        return errorResult(
          `createTextNode failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
