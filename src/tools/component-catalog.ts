import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerComponentCatalog(server: McpServer): void {
  server.registerTool(
    "fd_component_catalog",
    {
      description:
        "Full component catalog via the agent API — canvas components, code components " +
        "and overrides grouped by file, external components, and additional insertable " +
        "components (richer than fd_list_components, which only sees canvas ComponentNodes). " +
        "Pass componentIds to fetch control definitions for specific components instead " +
        "(needed to set $control__* attributes when inserting instances via fd_apply_changes).",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        componentIds: z
          .array(z.string().min(1))
          .optional()
          .describe("Component ids from the catalog — returns their control definitions."),
      },
    },
    async ({ project, componentIds }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const agent = (proj.ctx.framer as unknown as {
        agent: {
          listComponents: () => Promise<unknown>;
          readComponentControls: (input: { componentIds: readonly string[] }) => Promise<unknown>;
        };
      }).agent;
      try {
        if (componentIds && componentIds.length > 0) {
          return jsonResult(await agent.readComponentControls({ componentIds }));
        }
        return jsonResult(await agent.listComponents());
      } catch (err) {
        return errorResult(
          `component catalog failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
