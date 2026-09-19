# React Server-Side Rendering (SSR) in ForgeTS

> Comprehensive guide to React 19 SSR, page resolution, view serialization, hydration handshake, Vite dev server, and production builds in ForgeTS.

---

## 1. Overview

ForgeTS provides a hybrid rendering engine combining server-rendered HTML views and full React 19 Server-Side Rendering with client hydration.

Unlike external full-stack frameworks that impose proprietary routing or heavy clients, ForgeTS keeps controllers and routing strictly in the backend, treating React pages as the view presentation layer (`res.view('name', props)`).

---

## 2. Page Directory Convention & Resolution

React page components reside in `resources/js/pages/`.

### Resolution Rules
When a controller calls `res.view('user', data)` or `res.view('users/index', data)`, `ReactEngine` searches for the corresponding component file in the following order:

1. `resources/js/pages/${cleanName}.tsx`
2. `resources/js/pages/${cleanName}.jsx`
3. `resources/js/pages/${cleanName}/index.tsx`
4. `resources/js/pages/${cleanName}/index.jsx`
5. `resources/js/pages/${name}.tsx`
6. `resources/js/pages/${name}.jsx`

*Note: Any leading `pages/` in the template name is stripped automatically.*

---

## 3. Controller to View Flow

Controllers render pages by returning `res.view()`:

```typescript
// app/controllers/UserController.ts
import { Controller, Get, Request, ForgeResponse } from '@forge/core';
import { User } from '@/models/User.js';

@Controller('/user')
export class UserController {
  @Get('/')
  async index(req: Request, res: ForgeResponse) {
    const users = await User.all();

    return res.view('user', {
      title: 'Users Directory',
      userData: users,
    });
  }
}
```

### Automatic Serialization Boundary
Active Record `Model` instances or arrays of models (such as `users = await User.all()`) contain internal state and active-record methods.

ForgeTS automatically sanitizes this boundary:
1. `ForgeResponse.view()` and `ReactEngine.renderPage()` invoke `serializeViewData()`.
2. Any object with a `.toJSON()` method is unwrapped recursively into plain JSON-compatible objects and primitives.
3. React components receive pure plain props, preventing crashes and preventing internal state (`_attributes`) from leaking.

---

## 4. Writing React Pages & PageProps

React pages are standard React functional components exported as `default`:

```tsx
// resources/js/pages/user.tsx
import React from 'react';
import type { PageProps } from '@/types';

interface UserItem {
  id: number;
  name: string;
  email: string;
}

interface UserPageProps extends PageProps {
  title?: string;
  userData?: UserItem[];
}

export default function UserPage({
  csrf_token,
  title = 'Users',
  userData = [],
}: UserPageProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>{title}</h1>

      {/* Form with CSRF Protection */}
      <form action="/user" method="POST">
        <input type="hidden" name="_token" value={csrf_token} />
        <input type="text" name="name" placeholder="Name" required />
        <input type="email" name="email" placeholder="Email" required />
        <button type="submit">Add User</button>
      </form>

      {/* Render list */}
      <ul>
        {userData.map((user) => (
          <li key={user.id}>
            <strong>{user.name}</strong> ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Built-in Injected Props
The framework automatically injects the following properties into `props`:
- `csrf_token`: Raw hex CSRF session token string.
- `csrf_field`: Render-ready HTML string `<input type="hidden" name="_token" value="...">`.
- `title`: Document title (defaults to `'ForgeTS — React SSR'`).

---

## 5. Master SSR Shell & Hydration Handshake

### Master Document (`resources/views/app.html`)
The server renders the React component into static HTML markup and injects it into `resources/views/app.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><!-- FORGETS_TITLE --></title>
</head>
<body>
  <div id="root"><!-- FORGETS_APP --></div>
  <script type="application/json" id="__FORGETS_DATA__"><!-- FORGETS_DATA --></script>
  <script type="module" src="/resources/js/entry-client.tsx"></script>
</body>
</html>
```

### Placeholders Replaced by ReactEngine
- `<!-- FORGETS_TITLE -->`: Sanitized document title or metadata title.
- `<!-- FORGETS_APP -->`: Server-rendered component markup generated via `ReactDOMServer.renderToString()`.
- `<!-- FORGETS_DATA -->`: JSON-escaped payload containing `{ page: '...', props: { ... } }` for client hydration.

### Client Hydration Entry (`resources/js/entry-client.tsx`)
On page load, the browser executes `entry-client.tsx`:
1. Parses initial props from the `__FORGETS_DATA__` script tag.
2. Dynamically imports the matching page component from `resources/js/pages/${page}`.
3. Invokes React's `hydrateRoot(rootElement, <PageComponent {...props} />)`.
4. In development mode, wraps hydration with diagnostics to flag any mismatch warnings.

---

## 6. SEO Metadata API

Controllers can chain `.meta()` on `res.view()`:

```typescript
return res.view('welcome', { appName: 'ForgeTS' }).meta({
  title: 'Welcome to ForgeTS',
  description: 'High-performance TypeScript web framework on Bun',
  'og:image': 'https://example.test/og.png',
});
```

This dynamically replaces `<title>` and injects `<meta>` tags into the `<head>` of the server-rendered HTML response prior to transmission.

---

## 7. Development vs Production Execution

### Development Mode (`bun run dev` / `forge serve`)
- Runs Vite in middleware mode (`ViteDevServer.ts`).
- Pages are compiled on demand using `vite.ssrLoadModule()`.
- Fast Refresh is enabled via React refresh runtime preamble injection.
- Changes to React components or CSS update instantly via WebSocket HMR without restarting the backend process.

### Production Mode (`bun run build` / `bun run start`)
- Client bundle: Built via `vite build --mode production` into `dist/client/`.
- SSR bundle: Built via `vite build --ssr --mode production` into `dist/server/entry-server.js`.
- `ReactEngine` executes against the compiled bundle, reads `dist/client/manifest.json` for hashed chunk filenames, and emits targeted `<link rel="modulepreload">` tags for page assets.
- Zero Vite development server overhead in production.
