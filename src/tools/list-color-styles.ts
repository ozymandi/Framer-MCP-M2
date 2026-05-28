import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerListColorStyles(server: McpServer): void {
  server.registerTool(
    "fd_list_color_styles",
    {
      description:
        "List color style tokens defined in the project. Each entry: { name, path, light, " +
        "dark }. `light` and `dark` are RGBA strings.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
      },
    },
    async ({ project }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const styles = await framer.getColorStyles();
      const out = (styles as ReadonlyArray<{
        name: string;
        path: string;
        light: string;
        dark: string | null;
      }>).map((s) => ({
        name: s.name,
        path: s.path,
        light: s.light,
        dark: s.dark,
      }));
      return jsonResult(out);
    },
  );
}
