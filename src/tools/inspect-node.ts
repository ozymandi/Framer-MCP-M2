import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Framer } from "../framer-client.js";
import { errorResult, jsonResult, resolveNodeTarget, resolveProject } from "../helpers.js";

const MAX_CHILDREN_PER_LEVEL = 50;

interface NodeView {
  id: string;
  type: string;
  name?: string | null;
  path?: string | null;
  text?: string | null;
  childCount?: number;
  childrenShown?: number;
  children?: NodeView[];
  truncated?: boolean;
}

async function walk(node: unknown, depth: number, framer: Framer): Promise<NodeView> {
  const n = node as {
    id: string;
    constructor: { name?: string };
    name?: string | null;
    path?: string | null;
    getChildren: () => Promise<unknown[]>;
    getText?: () => Promise<string | null>;
  };
  const view: NodeView = {
    id: n.id,
    type: n.constructor.name ?? "Node",
  };
  if (typeof n.name === "string" || n.name === null) view.name = n.name;
  if (typeof n.path === "string" || n.path === null) view.path = n.path;

  if (view.type === "TextNode" && typeof n.getText === "function") {
    try {
      view.text = await n.getText();
    } catch {
      view.text = null;
    }
  }

  if (depth <= 0) return view;

  const children = await n.getChildren();
  view.childCount = children.length;

  const shown = children.slice(0, MAX_CHILDREN_PER_LEVEL);
  view.childrenShown = shown.length;
  if (children.length > MAX_CHILDREN_PER_LEVEL) view.truncated = true;

  const childViews: NodeView[] = [];
  for (const child of shown) {
    childViews.push(await walk(child, depth - 1, framer));
  }
  view.children = childViews;
  return view;
}

export function registerInspectNode(server: McpServer): void {
  server.registerTool(
    "fd_inspect_node",
    {
      description:
        "Return a tree view of a node (page or any child node), truncated for token budget. " +
        "Each entry shows { id, type, name?, text?, childCount, children }. Use to discover " +
        "structure before screenshotting or to find specific text/components.",
      inputSchema: {
        project: z.string().optional().describe("Project alias. Required in multi-project mode."),
        target: z
          .string()
          .min(1)
          .describe(
            "What to inspect: a web page path ('/about'), a design page name " +
              "('Components'), a component name, or a raw node id.",
          ),
        depth: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("How deep to walk (default 2, max 5). Each level lists up to 50 children."),
      },
    },
    async ({ project, target, depth }) => {
      const proj = await resolveProject(project);
      if (!proj.ok) return errorResult(proj.error);
      const { framer } = proj.ctx;

      const resolved = await resolveNodeTarget(framer, target);
      if (!resolved.ok) return errorResult(resolved.error);

      const tree = await walk(resolved.node, depth ?? 2, framer);
      return jsonResult({
        target: resolved.label,
        kind: resolved.kind,
        rootId: resolved.nodeId,
        tree,
      });
    },
  );
}
