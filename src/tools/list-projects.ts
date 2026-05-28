import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "../config.js";
import { jsonResult } from "../helpers.js";

export function registerListProjects(server: McpServer): void {
  server.registerTool(
    "fd_list_projects",
    {
      description:
        "List Framer projects this M2 design server can access. Returns { projectMode, " +
        "projects }. In single-project mode the `project` argument is optional on other tools; " +
        "in multi-project mode it is required.",
      inputSchema: {},
    },
    async () => {
      return jsonResult({
        projectMode: config.multiProject ? "multi" : "single",
        projects: config.projects.map((p) => ({ alias: p.alias })),
      });
    },
  );
}
