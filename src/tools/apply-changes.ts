import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerApplyChanges(server: McpServer): void {
  server.registerTool(
    "fd_apply_changes",
    {
      description:
        "Low-level page editing via the Framer agent DSL — works on ANY page, open or not. " +
        "Pass a `;`-terminated command string: `SET <id> attr=\"value\" ...;` updates nodes, " +
        "`DEL <id>;` removes, `MOVE <id> parent=<id> position=<n>;` reparents, " +
        "`DUPE <id>;` duplicates, `+FrameNode <tempId> parent=<id> ...;` creates. " +
        "CMS detail pages use the collection NAME as slug segment (e.g. '/news/:News'). " +
        "Failed commands are reported in the result's errors without blocking the rest.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        dsl: z.string().min(1).describe("Commands separated by ';'. Every command must end with ';'."),
        pagePath: z
          .string()
          .optional()
          .describe(
            "Target page path (e.g. '/about', '/news/:News'). Defaults to the active page.",
          ),
      },
    },
    async ({ project, dsl, pagePath }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const agent = (proj.ctx.framer as unknown as {
        agent: { applyChanges: (d: string, o?: { pagePath?: string }) => Promise<unknown> };
      }).agent;
      try {
        const result = await agent.applyChanges(dsl, pagePath ? { pagePath } : undefined);
        return jsonResult(result);
      } catch (err) {
        return errorResult(
          `applyChanges failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
