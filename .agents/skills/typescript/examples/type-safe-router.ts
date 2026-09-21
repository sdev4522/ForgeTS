/**
 * Type-Safe Route Parameter Extraction Pattern for ForgeTS
 * 
 * Demonstrates how template literal types recursively parse URL param tokens (:id)
 * and enforce type safety on controller action parameters.
 */

// 1. Recursive template literal type to extract route parameters
export type ParseRouteParams<TPath extends string> =
  TPath extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ParseRouteParams<`/${Rest}`>]: string }
    : TPath extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>;

// 2. Context interface with strongly typed route params
export interface RouteContext<TPath extends string> {
  params: ParseRouteParams<TPath>;
  query: Record<string, string | undefined>;
  url: URL;
  req: Request;
}

export type Handler<TPath extends string, TResponse = Response | Promise<Response>> = (
  ctx: RouteContext<TPath>
) => TResponse;

export interface RegisteredRoute {
  method: string;
  path: string;
  handler: (ctx: any) => any;
}

// 3. Router class with generic path inference
export class TypeSafeRouter {
  private routes: RegisteredRoute[] = [];

  get<TPath extends string>(path: TPath, handler: Handler<TPath>): this {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  post<TPath extends string>(path: TPath, handler: Handler<TPath>): this {
    this.routes.push({ method: "POST", path, handler });
    return this;
  }

  // Matching and dispatching
  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    for (const route of this.routes) {
      if (route.method !== req.method) continue;

      const params = this.match(route.path, url.pathname);
      if (params !== null) {
        const ctx: RouteContext<any> = {
          params,
          query: Object.fromEntries(url.searchParams.entries()),
          url,
          req,
        };
        return await route.handler(ctx);
      }
    }
    return new Response("Not Found", { status: 404 });
  }

  private match(template: string, pathname: string): Record<string, string> | null {
    const templateParts = template.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    if (templateParts.length !== pathParts.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < templateParts.length; i++) {
      const t = templateParts[i];
      const p = pathParts[i];
      if (t.startsWith(":")) {
        params[t.slice(1)] = p;
      } else if (t !== p) {
        return null;
      }
    }
    return params;
  }
}

// ==========================================
// Verification & Usage Example
// ==========================================
const appRouter = new TypeSafeRouter();

appRouter.get("/api/users/:userId/posts/:postId", (ctx) => {
  // TypeScript accurately verifies that ctx.params has 'userId' and 'postId'
  const userId: string = ctx.params.userId;
  const postId: string = ctx.params.postId;

  return new Response(JSON.stringify({ userId, postId }), {
    headers: { "Content-Type": "application/json" },
  });
});
