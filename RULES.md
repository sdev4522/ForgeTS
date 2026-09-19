# RULES.md — Mandatory Rules for AI Agents Working on ForgeTS

**Read this file completely before doing ANY work on this codebase. These rules override
your default behavior. If a rule conflicts with what seems like the "helpful" or "efficient"
thing to do, the rule wins.**

---

## Rule 1 — One Task at a Time, No Exceptions

You will be given tasks one at a time. Even if you can see what the next 5 tasks will
probably be, or the current task references future work, **only implement what is
explicitly asked in the current message.**

- Do NOT bundle multiple tasks into one response because it seems more efficient.
- Do NOT "get ahead" by scaffolding future features you anticipate needing.
- After finishing the current task, STOP and report what you did. Wait for explicit
  confirmation ("looks good, next task") before continuing.
- If you believe a task is too large to do safely in one pass, say so and propose
  splitting it — don't silently do a huge multi-file change.

**Violation example (do not do this):** given a single task like "add error handling,"
also refactoring the router, adding new npm dependencies, or implementing unrelated
features "while you're in there."

---

## Rule 2 — src/core/ Is Sacred: Zero Business Logic

`src/core/` contains ONLY generic, reusable framework internals — router, DI container,
ORM driver layer, HTTP wrappers, CLI engine. It must work identically for ANY app built
on this framework, whether that app is a todo list, a blog, or a banking system.

- **NEVER** put app-specific field names, table names, route paths, or business rules
  inside `src/core/`.
- If implementing a feature requires touching `src/core/`, that's a signal the feature
  needs a generic extension point (a hook, an interface, a config option) — not a
  hardcoded special case for the current app.
- Before finishing any task, explicitly check: "did I put anything app-specific into
  core/?" If yes, stop and move it to `src/app/` or ask me how to generalize it.
- All example/demo code (Todo app, Health check, etc.) belongs ONLY in `src/app/` and
  `src/database/`. Never in `src/core/`.

---

## Rule 3 — No New Architecture Decisions Without Asking

Architecture (decorator style, DI approach, ORM driver interface, folder structure,
naming conventions) is decided in `PROJECT.md` and is FINAL unless I explicitly say
otherwise in a message.

- Do not propose alternative architectures "for consideration."
- Do not silently deviate from a documented convention because you think your way is
  better — if you genuinely think a rule in PROJECT.md is wrong, say so explicitly and
  ask, don't just implement it your way.
- If PROJECT.md and the current task instructions conflict, STOP and ask which one is
  correct instead of guessing.

---

## Rule 4 — No Silent Dependency Changes

- Do not add, remove, or upgrade any npm/bun package without calling it out explicitly
  in your response BEFORE writing code, and explaining why it's needed.
- Prefer zero new dependencies unless the task genuinely requires one (e.g. Task 4
  requires Kysely — that's expected and pre-approved per PROJECT.md).
- Never modify `tsconfig.json`, `package.json` scripts, or build config without flagging
  it as a separate, explicit callout — these are high-blast-radius changes.

---

## Rule 5 — Always Report Scope Before and After

At the end of every task, report:
1. Exact list of files created/modified (paths only, no need to paste full diffs unless
   asked).
2. One line confirming Rule 2 was checked (core/ stayed generic).
3. Any deviation from the task instructions, and why.

If a response would touch more than ~5 files for what was framed as a small task, stop
and flag this before proceeding — it's a signal the task scope grew silently.

---

## Rule 6 — Verification Before "Done"

Never mark a task complete without either:
- Running the code yourself and showing the output/result, OR
- Giving me the exact command to run to verify it myself.

"This should work" is not verification. If you can't run it in your current environment,
say so explicitly and give me precise verification steps.

---

## Rule 7 — When Uncertain, Ask ONE Question

If something is genuinely ambiguous (not covered by PROJECT.md or the task), ask ONE
short, specific question. Do not:
- Ask multiple speculative questions to cover all bases.
- Guess silently and hope it's right.
- Over-explain the ambiguity — just ask what you need to know.

---

## Rule 8 — Strict Prohibition on Emojis

Emojis must never be used in ForgeTS source code or technical documentation.
This codebase maintains a serious, production-grade standard of engineering.

- **Source Code**: Emojis must not be introduced into TypeScript, JavaScript, TSX/JSX, HTML, CSS, or shell scripts.
- **Documentation**: Emojis must not be introduced into Markdown documents, code examples, or technical headings.
- **CLI & Diagnostics**: Emojis must not be used in framework CLI output, comments, logs, or error messages unless a future explicit project decision permits them.
- **Cleanup**: Existing emoji usage must be removed during cleanup passes.
- **Plain Text Standard**: Technical communication and status indications must use professional plain text tags (e.g. `[OK]`, `[ERROR]`, `[WARN]`, `Implemented`, `Verified`) rather than decorative icons.

---

## Rule 9 — Portability and Hardcoded Environment Prohibitions

Framework code and tests must never contain developer-specific absolute filesystem paths, machine usernames, local directory structures, machine-specific timezones, or uncontrolled environment assumptions. ForgeTS must clone and run cleanly on any machine, OS, or CI runner.

- **Filesystem Paths**: Never hardcode developer paths (e.g. `/home/user/...`, `C:\Users\...`). Derive paths dynamically from `process.cwd()`, `import.meta.dir`, or runtime configuration.
- **Framework Tests Must Be Generic**: Generic framework tests must never import or assert against application-specific dogfood fixtures (`TodoController`, `TodoException`, `UserRegistered`) unless the test explicitly targets dogfood application integration. Use controlled test fixtures (e.g. `tests/fixtures/ErrorSourceFixture.ts`, `ExampleController`, `SampleEvent`).
- **Synthetic Request URLs**: When testing request handling without a real TCP socket, use deterministic synthetic domains (e.g. `http://example.test/path`) rather than `http://localhost:3000`.
- **Real Server Tests**: When an actual server socket is bound, obtain its dynamic assigned port from `server.port` rather than assuming a fixed port.
- **Environment & Timezone Defaults**: Framework defaults must be neutral standards (e.g. UTC, UTF-8). Never embed developer-local timezones (e.g. `Asia/Kolkata`, `IST`) into framework defaults or secret sanitizers.

### Examples

**Filesystem Paths:**
- BAD: `'/home/sdev/Projects/ForgeTS/app/controllers/TodoController.ts'`
- GOOD: `path.join(process.cwd(), 'tests/fixtures/ErrorSourceFixture.ts')`

**Synthetic Request Metadata:**
- BAD: `new Request('http://localhost:3000/todos/42')`
- GOOD: `new Request('http://example.test/items/42')`

**Generic Subsystem Assertions:**
- BAD (testing generic ErrorDisplayEngine): `expect(html).toContain('TodoController')`
- GOOD: `expect(html).toContain('ExampleController')` using a controlled test fixture.

---

## Quick Self-Check Before Submitting Any Response

- [ ] Did I only do what was asked in THIS task, nothing more?
- [ ] Is src/core/ still 100% free of app-specific logic?
- [ ] Did I avoid adding dependencies without flagging them?
- [ ] Did I list exactly which files changed?
- [ ] Did I verify zero emojis were introduced into code, logs, or documentation?
- [ ] Did I verify no developer paths, machine-specific values, or uncontrolled localhost URLs were hardcoded?
- [ ] Can this be verified right now, and did I say how?

If any box is unchecked, fix it before responding.