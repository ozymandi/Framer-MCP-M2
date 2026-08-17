import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

export function registerPublish(server: McpServer): void {
  server.registerTool(
    "fd_publish",
    {
      description:
        "Publish the project with a two-step confirmation flow. " +
        "action='preview' returns readiness diagnostics (changes/errors/warnings), URLs, " +
        "and a confirmationHash WITHOUT publishing. " +
        "action='confirm_publish' publishes using the exact hash from the latest preview " +
        "(staging when enabled, otherwise production). " +
        "action='deploy_to_production' promotes a staging version (full version id from " +
        "preview) to the production domain. If the hash is stale, re-run preview.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        action: z
          .enum(["preview", "confirm_publish", "deploy_to_production"])
          .describe("Publish flow step."),
        confirmationHash: z
          .string()
          .optional()
          .describe("Required for confirm_publish — hash from the latest preview."),
        version: z
          .string()
          .optional()
          .describe("Required for deploy_to_production — full version id from preview."),
      },
    },
    async ({ project, action, confirmationHash, version }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);

      if (action === "confirm_publish" && !confirmationHash) {
        return errorResult("confirm_publish requires confirmationHash from a preceding preview.");
      }
      if (action === "deploy_to_production" && !version) {
        return errorResult("deploy_to_production requires a version id from a preceding preview.");
      }

      const input: Record<string, unknown> = { action };
      if (confirmationHash) input.confirmationHash = confirmationHash;
      if (version) input.version = version;

      const agent = (proj.ctx.framer as unknown as {
        agent: { publish: (input: Record<string, unknown>) => Promise<unknown> };
      }).agent;
      try {
        const result = await agent.publish(input);
        return jsonResult(result);
      } catch (err) {
        return errorResult(`publish failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
