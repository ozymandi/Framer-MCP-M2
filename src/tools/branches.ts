import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errorResult, jsonResult, resolveProject } from "../helpers.js";

interface BranchAgent {
  getBranches: () => Promise<unknown[]>;
  getActiveBranch: () => Promise<unknown>;
  createBranch: (title?: string) => Promise<unknown>;
  switchBranch: (branchId: string) => Promise<void>;
  mergeBranch: (targetBranchId?: string) => Promise<void>;
  deleteBranch: (branchId: string) => Promise<void>;
}

async function withAgent(
  project: string | undefined,
  fn: (agent: BranchAgent) => Promise<unknown>,
) {
  const proj = await resolveProject(project);
  if (!proj.ok) return errorResult(proj.error);
  const agent = (proj.ctx.framer as unknown as { agent: BranchAgent }).agent;
  try {
    return jsonResult(await fn(agent));
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

const projectParam = z
  .string()
  .optional()
  .describe("Project alias. Required in multi-project mode.");

export function registerBranches(server: McpServer): void {
  server.registerTool(
    "fd_list_branches",
    {
      description: "List project branches and mark the active one. 'main' is the main branch.",
      inputSchema: { project: projectParam },
    },
    async ({ project }) =>
      withAgent(project, async (agent) => {
        const [branches, active] = await Promise.all([
          agent.getBranches(),
          agent.getActiveBranch(),
        ]);
        return { branches, active };
      }),
  );

  server.registerTool(
    "fd_create_branch",
    {
      description:
        "Create a branch from the active branch and switch to it. Later edits land on " +
        "the new branch until fd_switch_branch / fd_merge_branch.",
      inputSchema: {
        project: projectParam,
        title: z.string().optional().describe("Branch title."),
      },
    },
    async ({ project, title }) => withAgent(project, (agent) => agent.createBranch(title)),
  );

  server.registerTool(
    "fd_switch_branch",
    {
      description: "Switch the active project branch. Use branchId 'main' for the main branch.",
      inputSchema: {
        project: projectParam,
        branchId: z.string().min(1).describe("Branch id ('main' for the main branch)."),
      },
    },
    async ({ project, branchId }) =>
      withAgent(project, async (agent) => {
        await agent.switchBranch(branchId);
        return { switched: branchId };
      }),
  );

  server.registerTool(
    "fd_merge_branch",
    {
      description:
        "Merge the ACTIVE branch into its base (or the given target) and switch to the target.",
      inputSchema: {
        project: projectParam,
        targetBranchId: z
          .string()
          .optional()
          .describe("Target branch id ('main' for the main branch). Defaults to the base."),
      },
    },
    async ({ project, targetBranchId }) =>
      withAgent(project, async (agent) => {
        await agent.mergeBranch(targetBranchId);
        return { merged: true, target: targetBranchId ?? "base" };
      }),
  );

  server.registerTool(
    "fd_delete_branch",
    {
      description: "Delete a branch by id. The main branch cannot be deleted.",
      inputSchema: {
        project: projectParam,
        branchId: z.string().min(1).describe("Branch id to delete."),
      },
    },
    async ({ project, branchId }) =>
      withAgent(project, async (agent) => {
        await agent.deleteBranch(branchId);
        return { deleted: branchId };
      }),
  );
}
