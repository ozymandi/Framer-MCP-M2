import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, imageResult, resolveNodeTarget, resolveProject } from "../helpers.js";

export function registerScreenshot(server: McpServer): void {
  server.registerTool(
    "fd_screenshot",
    {
      description:
        "Render a page or node as a PNG (or JPEG) image. Returns the image inline as MCP " +
        "image content — multimodal models can view it directly. Useful to verify a design " +
        "or feed a design-review loop.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        target: z
          .string()
          .min(1)
          .describe("Web page path, design page name, component name, or raw node id."),
        format: z.enum(["png", "jpeg"]).optional().describe("Image format. Default png."),
        scale: z
          .union([
            z.literal(0.5),
            z.literal(1),
            z.literal(1.5),
            z.literal(2),
            z.literal(3),
            z.literal(4),
          ])
          .optional()
          .describe("Pixel density (0.5..4). Default 1."),
        quality: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("JPEG quality 1..100 (ignored for png)."),
      },
    },
    async ({ project, target, format, scale, quality }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const resolved = await resolveNodeTarget(framer, target);
      if (!resolved.ok) return errorResult(resolved.error);

      try {
        const opts: Record<string, unknown> = {};
        if (format) opts["format"] = format;
        if (scale) opts["scale"] = scale;
        if (quality) opts["quality"] = quality;
        const result = await framer.screenshot(resolved.nodeId, opts);
        const caption = `Screenshot of '${resolved.label}' (${resolved.kind}), ${result.mimeType}, ${result.data.byteLength} bytes.`;
        return imageResult(result.data, result.mimeType, caption);
      } catch (err) {
        return errorResult(
          `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
