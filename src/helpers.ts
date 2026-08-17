import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { getFramer, listProjects, lookupProject, type Framer } from "./framer-client.js";

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function imageResult(data: Buffer, mimeType: string, caption?: string): CallToolResult {
  const content: CallToolResult["content"] = [
    {
      type: "image",
      data: data.toString("base64"),
      mimeType,
    },
  ];
  if (caption) content.push({ type: "text", text: caption });
  return { content };
}

export interface ProjectContext {
  alias: string;
  framer: Framer;
  projectName: string;
}

function normAlias(input: string): string {
  return input.toLowerCase().replace(/[\s_-]+/g, "");
}

export async function resolveProject(
  arg: string | undefined,
): Promise<{ ok: true; ctx: ProjectContext } | { ok: false; error: string }> {
  if (!config.multiProject) {
    const single = config.projects[0];
    if (!single) return { ok: false, error: "Server has no projects configured." };
    const framer = await getFramer(single.alias);
    return { ok: true, ctx: { alias: normAlias(single.alias), framer, projectName: single.alias } };
  }

  if (!arg || typeof arg !== "string" || arg.length === 0) {
    const aliases = listProjects().map((p) => p.alias);
    return {
      ok: false,
      error:
        `This server hosts multiple projects. Specify 'project' with one of: ` +
        `${aliases.join(", ")}. Call fd_list_projects to see all.`,
    };
  }

  const proj = lookupProject(arg);
  if (!proj) {
    const aliases = listProjects().map((p) => p.alias);
    const hint = suggestName(arg, aliases);
    return {
      ok: false,
      error:
        `Project '${arg}' is not configured.` +
        (hint ? ` Did you mean '${hint}'?` : "") +
        ` Available: ${aliases.join(", ")}.`,
    };
  }
  const framer = await getFramer(proj.alias);
  return { ok: true, ctx: { alias: normAlias(proj.alias), framer, projectName: proj.alias } };
}

export function suggestName(target: string, candidates: Iterable<string>): string | null {
  const t = target.toLowerCase().replace(/[\s_-]+/g, "");
  let best: { name: string; score: number } | null = null;
  for (const name of candidates) {
    const score = distance(t, name.toLowerCase().replace(/[\s_-]+/g, ""));
    if (best === null || score < best.score) best = { name, score };
  }
  if (!best) return null;
  if (best.score <= Math.max(2, Math.floor(target.length / 3))) return best.name;
  return null;
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[n] ?? 0;
}

interface WalkableNode {
  id: string;
  constructor: { name?: string };
  getChildren: () => Promise<unknown[]>;
}

/**
 * Find a node by raw id anywhere in the project.
 *
 * framer.getNode(id) returns null for child nodes inside web pages, so when it
 * misses we query every node type project-wide (getNodesWithType does descend
 * into pages) and match by id. As a last resort — for node types not covered
 * by the typed queries — walk every page/component tree breadth-first.
 */
export async function findNodeById(framer: Framer, id: string): Promise<WalkableNode | null> {
  const direct = await framer.getNode(id);
  if (direct) return direct as unknown as WalkableNode;

  const typed = (await Promise.all([
    framer.getNodesWithType("FrameNode"),
    framer.getNodesWithType("TextNode"),
    framer.getNodesWithType("SVGNode"),
    framer.getNodesWithType("ComponentInstanceNode"),
    framer.getNodesWithType("WebPageNode"),
    framer.getNodesWithType("DesignPageNode"),
    framer.getNodesWithType("ComponentNode"),
  ])) as unknown as WalkableNode[][];
  for (const nodes of typed) {
    const hit = nodes.find((n) => n.id === id);
    if (hit) return hit;
  }

  let level: WalkableNode[] = [...typed[4]!, ...typed[5]!, ...typed[6]!];
  while (level.length > 0) {
    const childLists = (await Promise.all(level.map((n) => n.getChildren()))) as WalkableNode[][];
    level = childLists.flat();
    const hit = level.find((n) => n.id === id);
    if (hit) return hit;
  }
  return null;
}

interface PageLikeNode extends WalkableNode {
  path?: string | null;
  collectionId?: string | null;
}

/**
 * Climb getParent() from a node up to its containing WebPageNode, or null when
 * the node lives outside a web page (design page, component, detached).
 */
export async function pageOfNode(framer: Framer, node: WalkableNode): Promise<PageLikeNode | null> {
  let current = node as WalkableNode & { getParent?: () => Promise<unknown> };
  for (let i = 0; i < 50; i++) {
    if (current.constructor.name === "WebPageNode") return current as PageLikeNode;
    if (typeof current.getParent !== "function") return null;
    const parent = (await current.getParent()) as (WalkableNode & { getParent?: () => Promise<unknown> }) | null;
    if (!parent) return null;
    current = parent;
  }
  return null;
}

/**
 * Convert a WebPageNode into the pagePath form the framer.agent API expects.
 * Static pages pass through ("/about"). CMS detail pages use the collection
 * NAME as the slug segment ("/news/:News"), while WebPageNode.path reports
 * ":slug" — so we swap the dynamic segment using the page's collectionId.
 */
export async function agentPagePath(framer: Framer, page: PageLikeNode): Promise<string | null> {
  const path = page.path ?? null;
  if (!path) return null;
  if (!path.includes(":")) return path;
  const collectionId = page.collectionId ?? null;
  if (!collectionId) return path;
  const collections = (await framer.getCollections()) as { id: string; name: string }[];
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return path;
  return path.replace(/:[^/]+$/, `:${collection.name}`);
}

/**
 * Find the agent pagePath of the web page containing a node.
 *
 * Fast path climbs getParent() — but as of framer-api 0.1.29 getParent()
 * returns null for nodes on pages that are not open, so we fall back to
 * probing each web page with agent.getNode({id}, {pagePath}).
 */
export async function agentPagePathOfNode(
  framer: Framer,
  node: WalkableNode,
): Promise<string | null> {
  const page = await pageOfNode(framer, node);
  if (page) return agentPagePath(framer, page);

  const agent = (framer as unknown as {
    agent: {
      getNode: (input: { id: string }, o?: { pagePath?: string }) => Promise<unknown>;
    };
  }).agent;
  const pages = (await framer.getNodesWithType("WebPageNode")) as unknown as PageLikeNode[];
  for (const candidate of pages) {
    const pagePath = await agentPagePath(framer, candidate);
    if (!pagePath) continue;
    try {
      if (await agent.getNode({ id: node.id }, { pagePath })) return pagePath;
    } catch {
      // Page not addressable via the agent API — keep scanning.
    }
  }
  return null;
}

/**
 * Resolve a user-facing target string into a node id.
 *
 * Accepted forms:
 *  - Web page path: "/about", "/blog/[post]" (matched against WebPageNode.path)
 *  - Design page name: "Components" (matched against DesignPageNode.name)
 *  - Component name: matched against ComponentNode.componentName
 *  - Raw node id (anything else is looked up via findNodeById)
 */
export async function resolveNodeTarget(
  framer: Framer,
  target: string,
): Promise<
  { ok: true; nodeId: string; kind: string; label: string; node: unknown } | { ok: false; error: string }
> {
  if (target.startsWith("/")) {
    const pages = await framer.getNodesWithType("WebPageNode");
    const found = pages.find((p: { path: string | null }) => p.path === target);
    if (!found) {
      const known = pages.map((p: { path: string | null }) => p.path ?? "(no path)");
      const hint = suggestName(target, known);
      return {
        ok: false,
        error:
          `No web page with path '${target}'.` +
          (hint ? ` Did you mean '${hint}'?` : ` Known: ${known.join(", ")}.`),
      };
    }
    return { ok: true, nodeId: (found as { id: string }).id, kind: "WebPageNode", label: target, node: found };
  }

  // Try design page by name.
  const designPages = await framer.getNodesWithType("DesignPageNode");
  const designHit = designPages.find((p: { name: string | null }) => p.name === target);
  if (designHit) {
    return { ok: true, nodeId: (designHit as { id: string }).id, kind: "DesignPageNode", label: target, node: designHit };
  }

  // Try component by name.
  const components = await framer.getNodesWithType("ComponentNode");
  const compHit = components.find(
    (c: { componentName: string | null }) => c.componentName === target,
  );
  if (compHit) {
    return { ok: true, nodeId: (compHit as { id: string }).id, kind: "ComponentNode", label: target, node: compHit };
  }

  // Fall back: treat as raw node id.
  const node = await findNodeById(framer, target);
  if (node) {
    const kind = node.constructor.name ?? "Node";
    return { ok: true, nodeId: target, kind, label: target, node };
  }

  // No match anywhere — assemble suggestions.
  const allLabels: string[] = [];
  for (const p of designPages) {
    const name = (p as { name: string | null }).name;
    if (name) allLabels.push(name);
  }
  for (const c of components) {
    const cn = (c as { componentName: string | null }).componentName;
    if (cn) allLabels.push(cn);
  }
  const hint = suggestName(target, allLabels);
  return {
    ok: false,
    error:
      `Target '${target}' not found as a web page path, design page name, component name, or node id.` +
      (hint ? ` Did you mean '${hint}'?` : ""),
  };
}
