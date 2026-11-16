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

interface RouteEntry {
  route: RegisteredRoute;
  /** Parameter names in path order, as declared by THIS route. */
  paramNames: string[];
}

interface TrieNode {
  children: Map<string, TrieNode>;
  paramChild: TrieNode | null;
  wildcardChild: TrieNode | null;
  handlers: Map<HttpMethod, RouteEntry>;
}

const ALL_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ─── Trie Implementation ───

function createNode(): TrieNode {
  return {
    children: new Map(),
    paramChild: null,
    wildcardChild: null,
    handlers: new Map(),
  };
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export class RouteResolver {
  private root: TrieNode = createNode();
  private routeCount = 0;

  /**
   * Add a route to the trie.
   * Called once at boot time for each registered route.
   *
   * Parameter names are stored per route (not per trie node), so sibling
   * routes such as `/users/:id` and `/users/:userId/posts` each receive
   * the names they declared.
   */
  add(route: RegisteredRoute): void {
    const segments = this.splitPath(route.fullPath);
    const paramNames: string[] = [];
    let node = this.root;

    for (const segment of segments) {
      if (segment.startsWith('*')) {
        // Wildcard catch-all — must be the last segment
        paramNames.push(segment.slice(1) || 'wildcard');
        node.wildcardChild ??= createNode();
        node = node.wildcardChild;
        break;
      } else if (segment.startsWith(':')) {
        // Dynamic parameter
        paramNames.push(segment.slice(1));
        node.paramChild ??= createNode();
        node = node.paramChild;
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

    if (node.handlers.has(route.method)) {
      console.warn(
        `[ForgeTS] Duplicate route: ${route.method} ${route.fullPath}. ` +
          `The later registration will overwrite the earlier one.`,
      );
    } else {
      this.routeCount++;
    }

    node.handlers.set(route.method, { route, paramNames });
  }

  /**
   * Resolve an incoming request to a registered route.
   * Returns the matched route and extracted (URL-decoded) parameters, or null.
   *
   * PERFORMANCE: Worst-case O(n) where n = number of path segments.
   * Does NOT scale with total route count — that's the advantage of a trie.
   */
  resolve(method: HttpMethod, path: string): ResolvedRoute | null {
    const segments = this.splitPath(path);
    return this.search(this.root, segments, 0, [], method);
  }

  /**
   * List the HTTP methods registered for a path (used for 405 + Allow header).
   */
  allowedMethods(path: string): HttpMethod[] {
    const segments = this.splitPath(path);
    const allowed: HttpMethod[] = [];
    for (const method of ALL_METHODS) {
      if (method === 'HEAD') continue;
      if (this.search(this.root, segments, 0, [], method)) allowed.push(method);
    }
    if (allowed.includes('GET')) allowed.push('HEAD');
    return allowed;
  }

  private match(node: TrieNode, method: HttpMethod, values: string[]): ResolvedRoute | null {
    let entry = node.handlers.get(method);
    // HEAD falls back to the GET handler
    if (!entry && method === 'HEAD') {
      entry = node.handlers.get('GET');
    }
    if (!entry) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < entry.paramNames.length; i++) {
      params[entry.paramNames[i]] = values[i] ?? '';
    }
    return { route: entry.route, params };
  }

  private search(
    node: TrieNode,
    segments: string[],
    index: number,
    values: string[],
    method: HttpMethod,
  ): ResolvedRoute | null {
    // Base case: consumed all segments
    if (index === segments.length) {
      return this.match(node, method, values);
    }

    const segment = segments[index];

    // 1. Try static match first (fastest)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const result = this.search(staticChild, segments, index + 1, values, method);
      if (result) return result;
    }

    // 2. Try parameter match
    if (node.paramChild) {
      values.push(safeDecode(segment));
      const result = this.search(node.paramChild, segments, index + 1, values, method);
      if (result) return result;
      values.pop(); // backtrack
    }

    // 3. Try wildcard match (catch-all): captures everything from this segment onwards
    if (node.wildcardChild) {
      values.push(segments.slice(index).map(safeDecode).join('/'));
      const result = this.match(node.wildcardChild, method, values);
      if (result) return result;
      values.pop(); // backtrack
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
    for (const entry of node.handlers.values()) {
      routes.push(entry.route);
    }
    for (const child of node.children.values()) {
      this.collectRoutes(child, routes);
    }
    if (node.paramChild) {
      this.collectRoutes(node.paramChild, routes);
    }
    if (node.wildcardChild) {
      this.collectRoutes(node.wildcardChild, routes);
    }
  }
}
