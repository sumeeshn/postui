# PRD: postui V1 — Terminal API Client

## Problem Statement

As a terminal-first developer, I want to send HTTP requests, manage collections, and switch environments without leaving my terminal. Existing tools (Postman, Insomnia) are GUI applications that are heavy, slow to launch, and break my terminal workflow. The current postui app is a single-file prototype that can only send one-off requests — no persistence, no collections, no environments, no history.

## Solution

Transform postui from a single-request prototype into a full terminal API client that covers the core workflow of Postman/Insomnia: collections, environments, history, auth helpers, OpenAPI import, and a polished sidebar + main layout — all keyboard-driven, local-first, and git-trackable.

## User Stories

1. As a developer, I want to create and save named collections of HTTP requests, so that I can organize my API work by project or feature.
2. As a developer, I want to see a sidebar listing my collections and their requests, so that I can navigate between them with keyboard shortcuts.
3. As a developer, I want to select a request from the sidebar and have it load into the editor, so that I can quickly switch between requests.
4. As a developer, I want to define environments with key-value variable pairs, so that I can reuse configurations across local, staging, and prod.
5. As a developer, I want to use `{{varName}}` syntax in URLs, headers, and bodies, so that environment variables are resolved before sending.
6. As a developer, I want to switch the active environment with a quick keybinding (`Ctrl+E`), so that I can toggle between environments without leaving the terminal.
7. As a developer, I want a global variables file that always applies, so that I can define shared values without duplicating them across environments.
8. As a developer, I want every sent request to be recorded in history, so that I can replay or reference past requests.
9. As a developer, I want to fuzzy-search my history with `Ctrl+R`, so that I can find and replay old requests quickly.
10. As a developer, I want to configure Bearer Token auth on a request, so that I can authenticate with JWT/API token APIs.
11. As a developer, I want to configure Basic Auth on a request, so that I can authenticate with username/password APIs.
12. As a developer, I want to configure API Key auth on a request (custom header or query param), so that I can authenticate with key-based APIs.
13. As a developer, I want auth config to be inheritable at the collection level, so that I don't repeat auth settings on every request.
14. As a developer, I want to see the response body with syntax highlighting, so that I can read JSON/XML responses clearly.
15. As a developer, I want to switch between response Body and Headers tabs, so that I can inspect both the payload and the response metadata.
16. As a developer, I want to see status code, latency, and response size in the status bar, so that I can quickly assess the response.
17. As a developer, I want to import an OpenAPI 3.0/3.1 spec (JSON or YAML), so that a full collection is generated automatically from the spec.
18. As a developer, I want my collections, environments, and config stored as JSON files on disk, so that they are git-trackable and editable outside the app.
19. As a developer, I want to send a request with `Ctrl+P`, so that the action is fast and discoverable.
20. As a developer, I want binary responses to prompt me to save to a file, so that I can download assets without the TUI breaking.

## Implementation Decisions

### Modules

- **`store/`** — Persistence layer. Reads/writes collections, environments, history, and config to `.postui/` directory. Interface: `loadCollection(id)`, `saveCollection(collection)`, `loadEnvironment(id)`, `saveEnvironment(env)`, `listCollections()`, `listEnvironments()`, `appendHistory(entry)`, `searchHistory(query)`, `loadConfig()`, `saveConfig(config)`.
- **`openapi-importer/`** — Pure function: OpenAPI 3.x spec (JSON or YAML) → Collection object. Generates one request per path+method. Tags become groupings. Populates path params, query params, headers, and request body schemas.
- **`request-engine/`** — Executes HTTP requests. Resolves `{{varName}}` in URL/headers/body against active environment + globals. Injects auth headers. Measures latency. Returns response body, headers, status, size.
- **`response-viewer/`** — Renders response with tabs: Body (syntax-highlighted, auto-detect JSON/XML/HTML/text), Headers (key-value table). Status bar shows status code, latency, response size.
- **`collection-sidebar/`** — Left panel (~25% width). Lists collections, expandable to show flat request list. Keyboard navigation: up/down to move, Enter to select, left/right to expand/collapse.
- **`environment-picker/`** — Overlay picker triggered by `Ctrl+E`. Lists environments, Enter to select active.
- **`history-picker/`** — Overlay picker triggered by `Ctrl+R`. Fuzzy-searchable list of past requests. Enter to load into editor, `Ctrl+P` to replay.
- **`auth/`** — Auth configuration UI and header injection. Supports Bearer, Basic, API Key. Per-request config with collection-level inheritance.
- **`App` (refactor)** — Rewire existing single-file `index.tsx` into sidebar + main layout. Top bar: method selector + URL input. Middle: request tabs (headers/body/auth). Bottom: response viewer. Left: collection sidebar. Overlays: environment picker, history picker.

### Data Schema

**Collection** (`.postui/collections/<id>.json`):
```json
{
  "id": "my-api",
  "name": "My API",
  "requests": [
    {
      "id": "get-users",
      "name": "Get Users",
      "method": "GET",
      "url": "{{baseUrl}}/api/users",
      "headers": {},
      "body": null,
      "auth": null
    }
  ],
  "auth": null
}
```

**Environment** (`.postui/environments/<id>.json`):
```json
{
  "id": "local",
  "name": "Local",
  "variables": {
    "baseUrl": "http://localhost:3000",
    "token": ""
  }
}
```

**Config** (`.postui/config.json`):
```json
{
  "activeEnvironment": "local",
  "activeCollection": "my-api"
}
```

**History** (`.postui/history.jsonl`):
```json
{"timestamp": "2025-01-01T00:00:00Z", "method": "GET", "url": "http://localhost:3000/api/users", "headers": {}, "body": null, "status": 200, "latency": 42, "responseSize": 1024}
```

### Variable Resolution

- Simple string replacement: `{{varName}}` → value from active environment + globals.
- Globals always apply; active environment overrides globals on conflict.
- Unresolved variables are sent as-is (no error).

### Auth Inheritance

- Auth is resolved per-request: request-level auth overrides collection-level auth.
- If neither is set, no auth headers are injected.

### Keyboard Map

| Key | Action |
|-----|--------|
| `Tab` | Cycle focus between panels |
| `Ctrl+P` | Send request |
| `Ctrl+E` | Open environment picker |
| `Ctrl+R` | Open history picker |
| `Ctrl+H` | Switch to Headers tab |
| `Ctrl+B` | Switch to Body tab |
| `Ctrl+A` | Switch to Auth tab |
| `Ctrl+C` | Exit |
| `↑/↓` | Navigate list items |
| `Enter` | Select / confirm |
| `Esc` | Close overlay / cancel |

## Testing Decisions

- **What to test**: External behavior only, not implementation details.
- **`store/`**: Test that load/save round-trips correctly, directory creation, list operations, history append/search.
- **`request-engine/`**: Test variable resolution (globals + env override, unresolved passthrough), auth header injection (Bearer, Basic, API Key), request construction.
- **`openapi-importer/`**: Test OpenAPI 3.0 and 3.1 spec parsing → collection generation (paths, methods, params, body schemas, tags).
- **`auth/`**: Test header generation for each auth type, collection-level inheritance override logic.
- **UI components**: No automated tests. TUI testing is fragile; validate via manual interaction.
- **Prior art**: None yet — this repo has no existing tests. Use `bun:test` for unit tests.

## Out of Scope

- OAuth 2.0 authentication
- Nested folder trees within collections
- Pre-request scripts and test assertions
- Full JavaScript runtime for scripting
- Response body storage in history (metadata only)
- Team collaboration, cloud sync, workspaces
- API mocking, monitoring, documentation generation
- OpenAPI 2.0 (Swagger) import
- Insomnia native format import
- Cookie management
- GraphQL-specific features (schema introspection, query builder)
- WebSocket support
- gRPC support
- Plugin system

## Further Notes

- The `.postui/` directory should be created on first use, not require manual setup.
- Collections and environments are plain JSON files — users can edit them in any editor while the app is closed.
- History grows unbounded; a future cleanup/rotation feature may be needed but is out of scope for V1.
- The app uses `@opentui/core` and `@opentui/react` with React 19. All new components should follow the existing JSX patterns.
- The existing `src/index.tsx` will be refactored, not replaced — preserve the method selector, URL input, and request sending logic, but extract into the new module structure.
