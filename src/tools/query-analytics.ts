import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject, textResult } from "../helpers.js";

export function registerQueryAnalytics(server: McpServer): void {
  server.registerTool(
    "fd_query_analytics",
    {
      description:
        "Run a read-only ClickHouse SQL query against the site's analytics data. " +
        "Set guide=true (no query needed) to fetch the Analytics implementation guide " +
        "first — it documents the schema, rules, and example queries.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        query: z.string().optional().describe("ClickHouse SQL query."),
        from: z
          .string()
          .optional()
          .describe("Start date/datetime (e.g. '2026-07-01' or full ISO). Date-only is expanded to 00:00 UTC."),
        to: z
          .string()
          .optional()
          .describe("End date/datetime. Date-only is expanded to end of day UTC. Defaults to now."),
        guide: z.boolean().optional().describe("Return the Analytics guide instead of querying."),
      },
    },
    async ({ project, query, from, to, guide }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const agent = (proj.ctx.framer as unknown as {
        agent: {
          queryAnalytics: (input: { query: string; from: string; to?: string }) => Promise<unknown[]>;
          readProject: (queries: Record<string, unknown>[]) => Promise<{ results: unknown[] }>;
        };
      }).agent;

      try {
        if (guide) {
          const { results } = await agent.readProject([
            { type: "implementation-guide-from-index", name: "Analytics" },
          ]);
          const first = results[0] as { guide?: unknown } | string | undefined;
          const doc =
            typeof first === "string"
              ? first
              : typeof first?.guide === "string"
                ? first.guide
                : JSON.stringify(first);
          return textResult(doc);
        }
        if (!query || !from) {
          return errorResult("query and from are required (or pass guide=true for the schema doc).");
        }
        // The API validates a full ISO datetime; expand bare dates for convenience.
        const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00.000Z` : from;
        const toIso = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
        const rows = await agent.queryAnalytics({ query, from: fromIso, ...(toIso ? { to: toIso } : {}) });
        return jsonResult({ rows });
      } catch (err) {
        return errorResult(
          `queryAnalytics failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
