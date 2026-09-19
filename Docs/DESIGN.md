# ForgeTS System Design & Architecture Specification

> In-depth architectural design, subsystem contracts, serialization boundaries, and runtime invariants of ForgeTS.

---

## 1. Architectural Philosophy

ForgeTS is designed to combine the expressive ergonomics of Laravel/Rails with the raw execution speed and native TypeScript support of the Bun runtime.

### Core Tenets
1. **Batteries-Included, Unified DX**: HTTP routing, controller decorators, dependency injection, Active Record ORM, CSRF protection, rate limiting, and React SSR work seamlessly under one coherent set of conventions.
2. **Framework Core Genericity**: Engine internals (`packages/forge/src/`) must never contain application-specific business logic, table names, or hardcoded routes.
3. **Future-Proof Standards**: Native ECMAScript TC39 Stage 3 decorators and `context.metadata` instead of legacy `experimentalDecorators` and `reflect-metadata`.
4. **Boundary Isolation**: Clear isolation between persistence layer (Active Record instances) and presentation layer (React SSR components and HTML templates).

---

## 2. Active Record Model & Proxy Architecture

### 2.1 Virtualized Attribute Storage
In ForgeTS, models inherit from `Model`:

```typescript
export abstract class Model {
  public _attributes: Record<string, any> = {};
  ...
}
```

Instead of defining class fields that store values directly on the instance (which would conflict with active record dirty-tracking and mass-assignment rules), the model constructor wraps `this` in an **ES6 Proxy**.

### 2.2 Proxy Traps Implementation
The proxy intercepts property operations:
- **`get`**: Intercepts attribute names and returns `this._attributes[prop]`. Bypasses symbols, private properties starting with `_`, constructor, and prototype methods.
- **`set`**: Writes to `this._attributes[prop]`.
- **`has`**: Checks if `prop in target._attributes`.
- **`ownKeys`**: Returns the list of attribute keys combined with non-private instance keys. Excludes internal `_` properties.
- **`getOwnPropertyDescriptor`**: Provides an enumerable descriptor for all keys in `_attributes`.

### 2.3 Rationale & Benefits
1. Natural developer syntax: `user.name = 'Alice'; console.log(user.name);`.
2. Native reflection works transparently: `Object.keys(user)` and `{ ...user }` extract model attributes directly without leaking `_attributes`.
3. Mass-assignment filtering: `user.fill(attributes)` filters unapproved fields before assigning them to `_attributes`.

---

## 3. View Data Serialization Boundary

### 3.1 Problem Statement
When an Active Record model instance is passed directly to a view layer:
- In React SSR, instances with methods, prototype chains, or non-serializable fields can cause React rendering errors.
- In client hydration, serializing a Model instance directly via `JSON.stringify` could leak internal state (`_attributes`) or break if circular references exist.
- Hydration mismatch occurs if server-rendered HTML and client hydration JSON do not share identical data shapes.

### 3.2 Solution: `serializeViewData()`
Located in `packages/forge/src/http/serializer.ts` and invoked automatically by `ForgeResponse.view()` and `ReactEngine.renderPage()`:

```
Controller returns res.view('user', { userData: users })
   │
   ▼
ForgeResponse.view()
   │
   ├─► Normalizes data with data.toJSON() if available
   ├─► Injects csrf_token and csrf_field
   └─► Passes through serializeViewData(viewData)
           │
           ├─► Detects objects with toJSON() (e.g. Model) -> unwrap toJSON()
           ├─► Deeply recurses through Arrays and Objects
           └─► Returns pure, plain JSON-serializable primitives and objects
                   │
                   ▼
ReactEngine.renderPage()
   │
   ├─► SSR: ReactDOMServer.renderToString(<PageComponent {...safeProps} />)
   └─► Hydration: <script id="__FORGETS_DATA__">{ "page": "user", "props": safeProps }</script>
```

### 3.3 Public vs Private Model API
- **Public API**: `user.name`, `user.email`, `user.save()`, `user.delete()`, `user.toJSON()`.
- **Internal State**: `_attributes` is private to the framework and never exposed or accessed directly in application code.

---

## 4. Dual View Rendering Architecture

### 4.1 Server HTML Engine (`ViewEngine`)
- Direct server-side interpolation of HTML templates located in `resources/views/*.html`.
- Evaluates `{{ variable }}` (HTML-escaped), `{{{ variable }}}` (raw), and `{{@ partialName }}` (includes).
- Templates are cached in memory for sub-millisecond response generation.

### 4.2 React 19 Server-Side Rendering (`ReactEngine`)
- Renders page components located in `resources/js/pages/*.tsx`.
- **Development Runtime**:
  - Leverages `ViteDevServer` in middleware mode.
  - Page components are transformed dynamically on each request via `vite.ssrLoadModule()`.
  - Frontend edits trigger instant HMR via WebSocket without restarting the Bun backend process.
- **Production Runtime**:
  - Precompiled client bundle in `dist/client/` and server bundle in `dist/server/entry-server.js`.
  - Direct execution of the precompiled SSR bundle with zero Vite server overhead.
  - Emits `<link rel="modulepreload">` tags mapped from `dist/client/manifest.json`.

---

## 5. Onion Middleware Pipeline & Native Routing

1. **Native Radix Trie**: O(segments) route resolution matching method and pathname directly on `Bun.serve()`.
2. **Onion Pipeline**: Global middleware (e.g. `CsrfMiddleware`, `RateLimiter`) and controller-level middleware wrap the handler execution in a nested promise chain (`executePipeline()`).
3. **Status Code Normalization**: All responses are processed through `normalizeHttpStatus()`, ensuring status codes are valid integers in `[200, 599]` or `101`, preventing `RangeError` panics when constructing native fetch responses.
