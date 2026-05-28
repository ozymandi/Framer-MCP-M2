import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AttrBuildError,
  buildFrameAttributes,
  type FriendlyBorderRadius,
  type FriendlyBox,
  type FriendlyFrameAttrs,
  type FriendlyLayout,
} from "../attr-builder.js";
import { errorResult, jsonResult, resolveNodeTarget, resolveProject } from "../helpers.js";

const lengthSchema = z.union([z.number(), z.string()]);

const paddingSchema: z.ZodType<FriendlyBox> = z.union([
  lengthSchema,
  z.object({
    top: lengthSchema.optional(),
    right: lengthSchema.optional(),
    bottom: lengthSchema.optional(),
    left: lengthSchema.optional(),
    vertical: lengthSchema.optional(),
    horizontal: lengthSchema.optional(),
  }) as z.ZodType<FriendlyBox>,
]);

const borderRadiusSchema: z.ZodType<FriendlyBorderRadius> = z.union([
  lengthSchema,
  z.object({
    topLeft: lengthSchema.optional(),
    topRight: lengthSchema.optional(),
    bottomRight: lengthSchema.optional(),
    bottomLeft: lengthSchema.optional(),
  }),
]);

const layoutSchema: z.ZodType<FriendlyLayout> = z.union([
  z.enum(["none", "stack", "grid"]),
  z.object({
    type: z.enum(["none", "stack", "grid"]),
    direction: z.enum(["horizontal", "vertical"]).optional(),
    distribute: z
      .enum(["start", "center", "end", "space-between", "space-around", "space-evenly"])
      .optional(),
    align: z.enum(["start", "center", "end"]).optional(),
    wrap: z.boolean().optional(),
    columns: z.union([z.number().int().min(1), z.literal("auto-fill")]).optional(),
    rows: z.number().int().min(1).optional(),
  }) as z.ZodType<FriendlyLayout>,
]);

export function registerAddFrame(server: McpServer): void {
  server.registerTool(
    "fd_add_frame",
    {
      description:
        "Add a new Frame (container) under a parent. Parent can be a node id, a web page " +
        "path ('/about'), or a design page name. Attribute values are designed to be flat and " +
        "friendly: width/height accept numbers (treated as pixels) or strings ('100%', '1fr', " +
        "'fit-content'); padding/borderRadius accept a single value or per-side object; " +
        "backgroundColor accepts hex/rgba OR the name of an existing color style.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        parent: z.string().min(1).describe("Parent node id, web page path, or design page name."),
        name: z.string().optional().describe("Display name for the new frame."),
        visible: z.boolean().optional(),
        opacity: z.number().min(0).max(1).optional(),
        rotation: z.number().optional().describe("Degrees."),
        width: lengthSchema.optional(),
        height: lengthSchema.optional(),
        aspectRatio: z.number().optional(),
        backgroundColor: z
          .string()
          .nullable()
          .optional()
          .describe(
            "#hex, rgb(...), rgba(...), or the name of an existing color style. " +
              "Pass null to remove background.",
          ),
        borderRadius: borderRadiusSchema.optional(),
        padding: paddingSchema.optional(),
        gap: z
          .union([
            lengthSchema,
            z.object({ row: lengthSchema.optional(), column: lengthSchema.optional() }),
          ])
          .optional(),
        layout: layoutSchema
          .optional()
          .describe(
            "Either 'none' | 'stack' | 'grid', or an object. Stack object: " +
              "{ type: 'stack', direction: 'horizontal'|'vertical' (default 'vertical'), " +
              "distribute: 'start'|'center'|'end'|'space-between'|..., align: 'start'|'center'|'end' }. " +
              "Grid object: { type: 'grid', columns: number|'auto-fill', rows?: number }. " +
              "IMPORTANT: Framer's raw default stack direction is horizontal; this builder defaults to vertical " +
              "because that's what you usually want for page sections. Override with `direction: 'horizontal'`.",
          ),
      },
    },
    async ({ project, parent, ...rest }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const resolved = await resolveNodeTarget(framer, parent);
      if (!resolved.ok) return errorResult(`Parent: ${resolved.error}`);

      let attrs;
      try {
        attrs = await buildFrameAttributes(framer, rest as FriendlyFrameAttrs);
      } catch (err) {
        if (err instanceof AttrBuildError) return errorResult(err.message);
        throw err;
      }

      try {
        const node = await framer.createFrameNode(attrs, resolved.nodeId);
        if (!node) {
          return errorResult(
            `createFrameNode returned null. Parent node may not accept children, or attributes may be invalid.`,
          );
        }
        return jsonResult({
          id: (node as { id: string }).id,
          name: (node as { name: string | null }).name,
          parent: resolved.label,
        });
      } catch (err) {
        return errorResult(
          `createFrameNode failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
