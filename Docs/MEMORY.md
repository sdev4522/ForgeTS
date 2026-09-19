# ForgeTS Framework Memory & Architectural Patterns

> Curated framework knowledge, invariant rules, and architectural guidelines for engineers and AI agents working on ForgeTS.

---

## 1. Core Framework Invariants

### 1.1 Source Hierarchy
- `packages/forge/src/`: Framework Core Engine ONLY (`@forge/core`, `@forge/database`). Contains zero application-specific logic, table names, or domain models.
- `app/`: Application domain layer (controllers, models, services, middleware).
- `routes/`: Route definitions (`web.ts`, `api.ts`).
- `resources/js/pages/`: React SSR pages.
- `resources/views/`: Server HTML templates and master SSR shell (`app.html`).
- `bin/`: CLI and server entry points (`dev.ts`, `serve.ts`, `forge.ts`).

### 1.2 TC39 Stage 3 Decorators
- Bun 1.3+ executes TC39 Stage 3 decorators natively.
- Metadata is attached via `context.metadata[Symbol.for(...)]`.
- Never introduce `experimentalDecorators: true` or `reflect-metadata` into the framework core.

### 1.3 Active Record Model Architecture
- The `Model` base class uses an **ES6 Proxy** to virtualize property reads and writes to `this._attributes`.
- The proxy traps `ownKeys`, `has`, and `getOwnPropertyDescriptor` ensure native reflection (`Object.keys(model)`, `{ ...model }`) operates seamlessly.
- **Never expose `_attributes` as a public API**: Application code and documentation must always teach public property access (`user.name`), `user.save()`, `user.update()`, and `user.toJSON()`.

### 1.4 HTTP / SSR View Data Serialization Boundary
- Whenever `res.view('name', data)` or `ReactEngine.renderPage('name', props)` is executed, the data passes through `serializeViewData()`.
- `serializeViewData()` detects any object implementing `toJSON()` (including Active Record `Model` instances) and unwraps them recursively into plain JavaScript objects.
- React components receive plain data structures, preventing internal active-record state or non-serializable methods from reaching React SSR or the `<script id="__FORGETS_DATA__">` client hydration tag.

### 1.5 HTTP Status Code Normalization
- All HTTP status values returned by `ForgeResponse` or exceptions pass through `normalizeHttpStatus()`.
- Guaranteed valid HTTP status: strictly `101` or integers in `[200, 599]`. Invalid values safely default to `200` (or `302` for redirects).

### 1.6 CSRF Protection Contract
- `CsrfMiddleware` manages session token verification via the `forge_session` cookie.
- State-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid `_token` in body, query, or headers.
- Mismatched tokens receive **HTTP 419 Page Expired**.
- Stateless API routes starting with `/api/` are automatically exempt.

---

## 2. Common Gotchas & Best Practices

1. **Avoid Private Attribute Access**:
   - BAD: `console.log(user._attributes.email);`
   - GOOD: `console.log(user.email);` or `console.log(user.toJSON().email);`
2. **Passing Models to res.view()**:
   - It is fully supported and recommended to pass Model instances directly:
     `return res.view('user', { userData: users });`
   - The framework handles recursive unwrapping automatically.
3. **Form Actions and HTTP Verbs**:
   - Standard HTML forms only support `GET` and `POST`. For update and delete forms, use standard POST routes (e.g. `POST /users/:id/update`, `POST /users/:id/delete`) with hidden CSRF tokens:
     `<input type="hidden" name="_token" value={csrf_token} />`.
4. **Zero Emojis**:
   - Prohibited across all source code, tests, CLI outputs, and documentation.
5. **Neutral Paths**:
   - Never hardcode absolute developer paths (e.g. `/home/user/...`). Use dynamic derivation via `process.cwd()` or neutral synthetic URLs (`http://example.test`).
