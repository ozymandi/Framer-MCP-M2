import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, resolveProject, textResult } from "../helpers.js";

export function registerStatus(server: McpServer): void {
  server.registerTool(
    "fd_status",
    {
      description:
        "Connection check and brief summary of a Framer project: name, number of web pages, " +
        "number of design pages, components count.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
      },
    },
    async ({ project }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const info = await framer.getProjectInfo();
      const webPages = await framer.getNodesWithType("WebPageNode");
      const designPages = await framer.getNodesWithType("DesignPageNode");
      const components = await framer.getNodesWithType("ComponentNode");

      const lines = [
        `Project: ${(info as { name?: string }).name ?? "(unknown)"}`,
        `Alias: ${proj.ctx.projectName}`,
        `Web pages: ${webPages.length}`,
        `Design pages: ${designPages.length}`,
        `Components: ${components.length}`,
      ];
      return textResult(lines.join("\n"));
    },
  );
}
