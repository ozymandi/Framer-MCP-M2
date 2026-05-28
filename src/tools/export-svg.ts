import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, resolveNodeTarget, resolveProject, textResult } from "../helpers.js";

export function registerExportSvg(server: McpServer): void {
  server.registerTool(
    "fd_export_svg",
    {
      description:
        "Export a node as SVG markup. Returns the raw SVG as text. Useful for components, " +
        "icons, or vector elements; less suitable for full pages with raster content.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        target: z
          .string()
          .min(1)
          .describe("Web page path, design page name, component name, or raw node id."),
      },
    },
    async ({ project, target }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const resolved = await resolveNodeTarget(framer, target);
      if (!resolved.ok) return errorResult(resolved.error);

      try {
        const svg = await framer.exportSVG(resolved.nodeId);
        return textResult(svg);
      } catch (err) {
        return errorResult(
          `exportSVG failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
