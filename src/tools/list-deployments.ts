import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerListDeployments(server: McpServer): void {
  server.registerTool(
    "fd_list_deployments",
    {
      description:
        "List recent deployments of the project (id, status, timestamps, hostnames), " +
        "newest first. Use fd_publish for the publish flow itself.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        limit: z.number().int().min(1).max(50).optional().describe("Max deployments (default 10)."),
      },
    },
    async ({ project, limit }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const framer = proj.ctx.framer as unknown as {
        listDeployments: (limit?: number) => AsyncIterable<unknown>;
      };
      const max = limit ?? 10;
      try {
        const deployments: unknown[] = [];
        for await (const d of framer.listDeployments(max)) {
          deployments.push(d);
          if (deployments.length >= max) break;
        }
        return jsonResult({ deployments });
      } catch (err) {
        return errorResult(
          `listDeployments failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
