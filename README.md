# Boomi EmbedKit — Examples

This repository contains end-to-end working examples of [Boomi EmbedKit](https://github.com/OfficialBoomi/embedkit) across multiple frontend frameworks and a shared Node.js authentication server.

- 📦 **EmbedKit on GitHub:** [github.com/OfficialBoomi/embedkit](https://github.com/OfficialBoomi/embedkit)
- 📚 **Getting Started Guide:** [GettingStarted.md](https://github.com/OfficialBoomi/embedkit/blob/main/public-docs/GettingStarted.md)
- 📋 **Full Documentation:** [Boomi Product Documentation](https://help.boomi.com/)

---

## Repository Contents

| Directory | Description |
|-----------|-------------|
| [`server/`](#server) | Shared Node.js + Express authentication server. Handles session management and exchanges Boomi credentials for EmbedKit nonces. |
| [`common-js/`](#common-js--vanilla-javascript) | Vanilla JavaScript (no framework) example. Full dashboard with hash-based routing, canvas charts, and EmbedKit components. |
| [`react/`](#react--typescript) | React + TypeScript example. Full dashboard using React Router, Tailwind CSS, and EmbedKit components with context-based state management. |
| [`embedkit-aws-server/`](#embedkit-aws-server) | AWS-targeted variant of the authentication server, pre-wired for use with AWS-hosted EmbedKit deployments. |

---

## How It Works

These examples implement the three-tier architecture described in the [Getting Started Guide](https://github.com/OfficialBoomi/embedkit/blob/main/public-docs/GettingStarted.md):

```
Browser (common-js or react)
    │
    │  POST /api/session (email + password)
    ▼
Node.js Server (server/)
    │
    │  POST /auth/login (Boomi credentials)
    ▼
EmbedKit Server (api.boomi.space)
    │
    │  Returns one-time HMAC nonce (2-minute TTL)
    ▼
Node.js Server
    │
    │  Returns { nonce, serverBase, tenantId } to browser
    ▼
Browser
    │
    │  BoomiPlugin({ nonce, serverBase, tenantId, boomiConfig })
    ▼
EmbedKit Plugin initialized — RenderComponent() calls work
```

The server never exposes Boomi API credentials to the browser. The browser only ever receives a short-lived nonce.

---

## Prerequisites

### Boomi Account

You will need:

| Credential | Description |
|-----------|-------------|
| `API_ACCOUNT_ID` | Your Boomi Parent Account ID |
| `API_USERNAME` | A service account username within Boomi |
| `API_TOKEN` | The API token for the service account |
| `API_AUTH_USER` | The child (sub) account ID within Boomi |
| `API_ACCOUNT_GROUP` | The account group holding your Integration Packs |

Refer to the [Getting Started Guide](https://github.com/OfficialBoomi/embedkit/blob/main/public-docs/GettingStarted.md#prerequisites) for instructions on where to find these values in the Boomi Platform.

### CORS Configuration

The EmbedKit Plugin makes browser requests to the EmbedKit Server, so your site's origin must be registered before the embed will work.

1. Log in to [admin.boomi.space](https://admin.boomi.space)
2. Navigate to **CORS** in the left sidebar
3. Click **+** to add an origin
4. Enter your origin (e.g., `http://localhost:5173` for local development)
5. Click **Save**

> [!NOTE]
> `http://localhost:5173` and `http://localhost:3000` are different origins. Add each port separately as needed.

### npm

`@boomi/embedkit` is published publicly on npm — no `.npmrc` or access token is required.

```sh
npm install @boomi/embedkit
```

---

## Server

The shared authentication server is used by both the `common-js` and `react` examples. It:

- Issues JWT session cookies (2-hour expiration)
- Accepts Boomi credentials via environment variables
- Calls the EmbedKit Server's `/auth/login` endpoint to obtain a nonce
- Returns the nonce to the browser client
- Provides a `/api/session/nonce` endpoint for refreshing nonces on tab reload without re-authentication

### Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ping` | Health check |
| `POST` | `/api/session` | Log in — validates credentials, obtains nonce, sets session cookie |
| `GET` | `/api/session` | Check session — returns user info if the session cookie is valid |
| `DELETE` | `/api/session` | Log out — clears the session cookie |
| `POST` | `/api/session/nonce` | Get a fresh nonce for an existing session (used on tab reload) |

### Install & Run

```sh
cd server
npm install
```

Create `server/.env`:

```sh
# Server
PORT=8080
NODE_ENV=development

# Auth
JWT_SECRET=replace_with_a_random_secret
# Enables /api/admin/catalog (send as `x-admin-key` header); admin routes are off when unset
ADMIN_API_KEY=replace_with_a_random_secret
# Swagger UI at /api/docs (spec at /api/docs.json) is on outside production; set true to enable it in production
# ENABLE_API_DOCS=true

# CORS — must match the origin of the client you are running
CORS_ORIGINS=http://localhost:5173

# EmbedKit
EMBEDKIT_SERVER_BASE="https://api.boomi.space/api/v1"

# Boomi credentials
API_URL="https://api.boomi.com/partner/api/rest/v1"
API_ACCOUNT_ID="your-parent-account-id"
API_USERNAME="your-service-account-username"
API_TOKEN="your-api-token"
API_AUTH_USER="your-child-account-id"
API_ACCOUNT_GROUP="your-account-group"

# SQL Server (required). Local Docker/dev typically needs trustServerCertificate.
# App Runner injects these from Secrets Manager boomi/<env>/db (Genesis RDS, database Boomi).
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=EmbedKitDB
DB_USER=sa
DB_PASSWORD=replace_with_local_sql_password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# Prisma CLI only (migrate/generate). Runtime uses DB_* above, not DATABASE_URL.
# DATABASE_URL="sqlserver://localhost:1433;database=EmbedKitDB;user=sa;password=replace_with_local_sql_password;encrypt=true;trustServerCertificate=true"

# AI features (optional)
OPENAI_API_KEY="your-openai-key"
OPENAI_API_MODEL="gpt-4o-2024-08-06"
```

```sh
npm run dev
```

The server starts on `http://localhost:8080`.

---

## common-js — Vanilla JavaScript

A complete single-page dashboard built with vanilla JavaScript and no framework dependencies. Demonstrates the full EmbedKit integration lifecycle without React or any UI library.

### What's Included

**Pages (hash-routed):**

| Route | Description |
|-------|-------------|
| `#dashboard` | KPI cards, canvas charts (line + bar), recent activity table, and an embedded **Boomi Integrations** component (dashboard widget) |
| `#integrations` | Full-page **Boomi Integrations** component |
| `#agents` | Full-page **Boomi Agent** component |
| `#reports` | Canvas charts — revenue (12 months), orders (12 months), traffic sources donut, top products with sparklines |
| `#settings` | Profile section, plan usage donut chart, activity chart, preference toggles |

**Key Files:**

| File | Description |
|------|-------------|
| `src/main.js` | All application logic — auth, routing, chart drawing, EmbedKit initialization, page rendering |
| `boomi.config.js` | EmbedKit UI configuration — theme, component configs, and CSS variable overrides |
| `src/style.css` | Full CSS design system — layout, components, charts, responsive styles |
| `index.html` | HTML entry point |

**Boot Sequence:**
1. On load, check if a server session exists (`GET /api/session`)
2. If a session exists, fetch a fresh nonce (`POST /api/session/nonce`)
3. Initialize `BoomiPlugin` with the nonce
4. Render the main app shell
5. If no session exists, render the login form

### Install & Run

```sh
cd common-js
npm install
```

Create `common-js/.env`:

```sh
# Must match the PORT configured in server/.env
VITE_SERVER_URL="http://localhost:8080"
```

```sh
npm run dev
```

Navigate to `http://localhost:5173`.

---

## React + TypeScript

A full React + TypeScript dashboard application demonstrating EmbedKit integration using React context, React Router, and reusable component patterns.

### What's Included

**Pages:**

| Route | Description |
|-------|-------------|
| `/` | Dashboard — KPI cards, canvas charts, and an embedded **Boomi Integrations** component via `BoomiMount` |
| `/integrations` | Full-page **Boomi Integrations** component |
| `/reports` | Canvas charts — revenue, orders, traffic sources donut |
| `/settings` | Profile section, plan usage chart, activity chart |

**Key Files:**

| File | Description |
|------|-------------|
| `src/state/authContext.tsx` | React Context managing authentication state, session boot, EmbedKit initialization, login, and logout |
| `src/state/boomiProvider.tsx` | EmbedKit plugin lifecycle — `initBoomi()`, `renderBoomiComponent()`, `destroyBoomi()` with race-condition handling |
| `src/components/BoomiMount.tsx` | Reusable React component that wraps any EmbedKit component. Handles initialization before rendering, generates unique host IDs, and cleans up on unmount |
| `src/utils/charts.ts` | Canvas-based chart utilities — line, bar, and donut charts with DPI-aware rendering and resize support |
| `src/hooks/useCanvas.ts` | React hook for managing canvas element lifecycles |
| `boomi.config.js` | EmbedKit UI configuration — theme, component configs, and CSS variable overrides |

**`BoomiMount` Component:**

The `BoomiMount` component is the primary integration pattern for React apps. It handles all EmbedKit lifecycle concerns so you can render any EmbedKit component declaratively:

```tsx
// Render the Integrations component as a dashboard widget
<BoomiMount component="Integrations" props={{ componentKey: 'integrationsDashboard' }} />

// Render as a full-page component
<BoomiMount component="Integrations" props={{ componentKey: 'integrationsPage' }} />
```

**Boot Sequence:**
1. `AuthProvider` mounts and runs the boot effect once
2. `GET /api/session` — check if a server session cookie exists
3. If it does, `POST /api/session/nonce` — fetch a fresh nonce
4. `initBoomi({ nonce, serverBase, tenantId })` — initialize the EmbedKit plugin
5. Set session state — the app shell renders
6. If no session exists, the login page renders

### Install & Run

```sh
cd react
npm install
```

Create `react/.env`:

```sh
# Must match the PORT configured in server/.env
VITE_SERVER_URL="http://localhost:8080"
```

```sh
npm run dev
```

Navigate to `http://localhost:5173`.

---

## embedkit-aws-server

An authentication server variant pre-configured for AWS-hosted EmbedKit deployments. Functionally identical to `server/` with additional OAuth2 connection configuration in the Boomi payload, demonstrating how to pass OAuth2 credentials for connected systems within Boomi.

### Install & Run

```sh
cd embedkit-aws-server
npm install
npm run dev
```

Uses the same `.env` structure as `server/`. See the [Server](#server) section above.

---

## Running Everything Together

1. Start the server:
   ```sh
   cd server && npm run dev
   ```

2. In a second terminal, start the client:
   ```sh
   cd common-js && npm run dev   # or: cd react && npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

4. Log in with any email and password. The demo server accepts any credentials — **do not use this in production**.

5. The app authenticates with the EmbedKit Server, receives a nonce, initializes the plugin, and renders the dashboard with live EmbedKit components.

> [!IMPORTANT]
> You must add `http://localhost:5173` to your CORS configuration in [admin.boomi.space](https://admin.boomi.space) before the EmbedKit components will load.

---

## boomi.config.js

Both `common-js` and `react` include a `boomi.config.js` file that controls the EmbedKit UI. This is passed to `BoomiPlugin()` on initialization.

```js
export default {
  enableAi: true,               // Enable AI features (requires AI credentials on server)
  theme: {
    allowThemes: true,          // Allow runtime theme switching
    defaultTheme: 'dark',       // Starting theme: 'light' | 'dark' | 'boomi' | custom key
  },
  // Component-level configuration
  integrationsDashboard: {
    integrations: { showHeader: false, showControls: false, view: 'table' },
  },
  integrationsPage: {
    integrations: { showHeader: true, view: 'grid' },
    mapping: { treeMode: true },
  },
  // Custom theme CSS variable overrides
  cssVarsByTheme: {
    oem: {
      '--boomi-root-bg-color': '#0b1220',
      '--boomi-btn-primary-bg': '#2563eb',
      // ... additional token overrides
    },
  },
};
```

See the [Getting Started Guide — Styling & Theming](https://github.com/OfficialBoomi/embedkit/blob/main/public-docs/GettingStarted.md#styling--theming) for the full list of available CSS variables and theme configuration options.

---

## Release Notes

### v1.1.0
- Updated `@boomi/embedkit` references to the public npm package — no `.npmrc` or access token required.
- Removed stale private registry references from documentation.
- Cleaned up environment variable examples.

### v1.0.6 (react)
- Updated to React 19, React Router 7, and Vite 7.
- Added `BoomiMount` component for declarative EmbedKit rendering.
- Added `boomiProvider.tsx` state machine with race-condition handling for concurrent initialization calls.
- Added `useCanvas` hook for canvas lifecycle management.

### v1.0.5 (common-js)
- Added `#agents` route rendering the Boomi Agent component.
- Added sparkline charts to the Reports page top products table.
- Chart registry system for responsive canvas resize handling.

### v1.1.0 (server)
- Added `POST /api/session/nonce` endpoint for refreshing nonces on tab reload without requiring re-authentication.
- Added rate limiting (100 requests per 60 seconds).
- Improved error handling and structured logging.

---

## Resources

- 📦 [EmbedKit on GitHub](https://github.com/OfficialBoomi/embedkit)
- 📚 [Getting Started Guide](https://github.com/OfficialBoomi/embedkit/blob/main/public-docs/GettingStarted.md)
- ⚙️ [CDN Configuration Guide](https://github.com/OfficialBoomi/embedkit/blob/main/public-docs/CDNConfiguration.md)
- 📋 [Boomi Product Documentation](https://help.boomi.com/)
- 🛠️ [Admin Console](https://admin.boomi.space)
