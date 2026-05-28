import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerListTextStyles(server: McpServer): void {
  server.registerTool(
    "fd_list_text_styles",
    {
      description:
        "List text style tokens defined in the project. Each entry: { name, path, tag, " +
        "fontFamily, fontWeight, fontStyle }.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
      },
    },
    async ({ project }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const styles = await framer.getTextStyles();
      const out = (styles as ReadonlyArray<{
        name: string;
        path: string;
        tag: string;
        font: { family: string; weight: unknown; style: unknown } | null;
      }>).map((s) => ({
        name: s.name,
        path: s.path,
        tag: s.tag,
        fontFamily: s.font?.family ?? null,
        fontWeight: s.font?.weight ?? null,
        fontStyle: s.font?.style ?? null,
      }));
      return jsonResult(out);
    },
  );
}
