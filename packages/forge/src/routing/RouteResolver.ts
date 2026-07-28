// packages/forge/src/routing/RouteResolver.ts
// ─────────────────────────────────────────────────────────────────────
// Radix-tree route resolver for O(1) route matching.
//
// PERFORMANCE: This is the hottest path in the framework. Every single
// HTTP request passes through resolve(). We use a custom radix trie
// instead of a linear scan to ensure matching scales with route count.
//
// For v0.1, we use a simple trie with support for:
// - Static segments:  /users/profile
// - Dynamic params:   /users/:id
// - Wildcards:        /files/*path  (catch-all)
// ─────────────────────────────────────────────────────────────────────

import type { RegisteredRoute } from './Router.js';
import type { HttpMethod } from './decorators.js';

// ─── Types ───

export interface ResolvedRoute {
  route: RegisteredRoute;
  params: Record<string, string>;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  paramChild: { node: TrieNode; paramName: string } | null;
  wildcardChild: { node: TrieNode; paramName: string } | null;
  handlers: Map<HttpMethod, RegisteredRoute>;
}

// ─── Trie Implementation ───

function createNode(): TrieNode {
  return {
    children: new Map(),
    paramChild: null,
    wildcardChild: null,
    handlers: new Map(),
  };
}

export class RouteResolver {
  private root: TrieNode = createNode();
  private routeCount = 0;

  /**
   * Add a route to the trie.
   * Called once at boot time for each registered route.
   */
  add(route: RegisteredRoute): void {
    const segments = this.splitPath(route.fullPath);
    let node = this.root;

    for (const segment of segments) {
      if (segment.startsWith('*')) {
        // Wildcard catch-all — must be the last segment
        const paramName = segment.slice(1) || 'wildcard';
        if (!node.wildcardChild) {
          node.wildcardChild = { node: createNode(), paramName };
        }
        node = node.wildcardChild.node;
        break;
      } else if (segment.startsWith(':')) {
        // Dynamic parameter
        const paramName = segment.slice(1);
        if (!node.paramChild) {
          node.paramChild = { node: createNode(), paramName };
        }
        node = node.paramChild.node;
      } else {
        // Static segment
        let child = node.children.get(segment);
        if (!child) {
          child = createNode();
          node.children.set(segment, child);
        }
        node = child;
      }
    }

    // If path is just '/', we store at root
    if (node.handlers.has(route.method)) {
      console.warn(
        `[ForgeTS] Duplicate route: ${route.method} ${route.fullPath}. ` +
          `The later registration will overwrite the earlier one.`,
      );
    }

    node.handlers.set(route.method, route);
    this.routeCount++;
  }

  /**
   * Resolve an incoming request to a registered route.
   * Returns the matched route and extracted parameters, or null.
   *
   * PERFORMANCE: Worst-case O(n) where n = number of path segments.
   * Does NOT scale with total route count — that's the advantage of a trie.
   */
  resolve(method: HttpMethod, path: string): ResolvedRoute | null {
    const segments = this.splitPath(path);
    const params: Record<string, string> = {};

    const result = this.search(this.root, segments, 0, params, method);
    return result;
  }

  private search(
    node: TrieNode,
    segments: string[],
    index: number,
    params: Record<string, string>,
    method: HttpMethod,
  ): ResolvedRoute | null {
    // Base case: consumed all segments
    if (index === segments.length) {
      const route = node.handlers.get(method);
      if (route) {
        return { route, params: { ...params } };
      }
      // Check if HEAD can fallback to GET
      if (method === 'HEAD') {
        const getRoute = node.handlers.get('GET');
        if (getRoute) {
          return { route: getRoute, params: { ...params } };
        }
      }
      return null;
    }

    const segment = segments[index];

    // 1. Try static match first (fastest)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const result = this.search(staticChild, segments, index + 1, params, method);
      if (result) return result;
    }

    // 2. Try parameter match
    if (node.paramChild) {
      const { node: paramNode, paramName } = node.paramChild;
      params[paramName] = segment;
      const result = this.search(paramNode, segments, index + 1, params, method);
      if (result) return result;
      delete params[paramName]; // backtrack
    }

    // 3. Try wildcard match (catch-all)
    if (node.wildcardChild) {
      const { node: wildcardNode, paramName } = node.wildcardChild;
      // Wildcard captures everything from this segment onwards
      params[paramName] = segments.slice(index).join('/');
      const route = wildcardNode.handlers.get(method);
      if (route) {
        return { route, params: { ...params } };
      }
      delete params[paramName]; // backtrack
    }

    return null;
  }

  /**
   * Split a path into segments, filtering out empty strings.
   * '/users/42/posts' → ['users', '42', 'posts']
   */
  private splitPath(path: string): string[] {
    return path.split('/').filter(Boolean);
  }

  /**
   * Get the total number of registered routes.
   */
  get count(): number {
    return this.routeCount;
  }

  /**
   * Get all registered routes as a flat list (for routes:list command).
   */
  getAllRoutes(): RegisteredRoute[] {
    const routes: RegisteredRoute[] = [];
    this.collectRoutes(this.root, routes);
    return routes;
  }

  private collectRoutes(node: TrieNode, routes: RegisteredRoute[]): void {
    for (const route of node.handlers.values()) {
      routes.push(route);
    }
    for (const child of node.children.values()) {
      this.collectRoutes(child, routes);
    }
    if (node.paramChild) {
      this.collectRoutes(node.paramChild.node, routes);
    }
    if (node.wildcardChild) {
      this.collectRoutes(node.wildcardChild.node, routes);
    }
  }
}
