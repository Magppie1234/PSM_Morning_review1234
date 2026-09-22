# PSM Morning Review

Magppie's daily review dashboards, fed live from Zoho CRM: Pre Sales (PSM funnel and mandate), Sales,
Design, PDI & Site, Factory stand-up, Dispatch, Installation, AMS and the Decision Queue.

## Structure

```text
PSM-Morning-Review/
├── package.json              # One set of commands for the whole app (see below)
├── backend/                  # Express API + production web server
│   ├── .env.example          # Every setting, documented — copy to .env
│   ├── .data/                # Runtime files: Zoho token, CRM caches, meeting state (not committed)
│   └── src/
│       ├── server.js         # Entry point: checks settings, starts listening
│       ├── app.js            # Express app: security, /api routes, serves the built frontend
│       ├── config/
│       │   ├── env.js        # Reads and validates environment variables (single source)
│       │   ├── roster.js     # PSM team, sales team, Monday rota
│       │   └── psmTargets.js # Monthly PSM targets (edit each month)
│       ├── routes/           # API routes by area: presales, sales (+design, PDI), factory, operations
│       ├── services/         # Zoho client and the builders that turn CRM records into each board
│       ├── middleware/       # Optional sign-in (HTTP Basic)
│       ├── lib/              # Small helpers: data folder, demo fallbacks, request parsing
│       └── data/             # Demo data shown only when Zoho cannot be reached
└── frontend/                 # React (Vite) app
    ├── .env.example          # Optional overrides (public values only)
    ├── vite.config.js        # Dev server; forwards /api to the backend
    └── src/
        ├── App.jsx           # Tabs and shared filters
        ├── components/       # One folder per board (presales, sales, factory, …) + formula/
        ├── config/crm.js     # Zoho CRM web address for record links
        ├── lib/api.js        # API address
        ├── hooks/            # Data loading
        ├── data/             # Incentive policies
        └── styles/
```

## First-time setup

Needs Node.js 20 or newer.

```bash
npm run install:all
```

Then copy `backend/.env.example` to `backend/.env` and fill in the Zoho values.

## Run locally

```bash
npm run dev
```

Starts the API on http://127.0.0.1:4010 and the app on http://127.0.0.1:5174 (open this one). The app
calls `/api` on its own address and Vite forwards it to the API. `npm run dev:api` / `npm run dev:web`
start one at a time.

## Production

```bash
npm run install:all
npm run build          # builds frontend/dist
NODE_ENV=production npm start
```

In production the backend serves the built app and the API from one address, listens on all interfaces
and on `PORT`. Set the backend settings as the host's environment variables (not a committed file):

- **Required:** `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNTS_URL`, `ZOHO_API_DOMAIN`
- **Strongly recommended:** `DASHBOARD_USER` and `DASHBOARD_PASSWORD` — the dashboard shows live CRM
  leads, so without these anyone with the link can see them
- **As needed:** `DATA_DIR` (a writable, persistent folder), `FACTORY_*_FILE` (factory spreadsheets)

`GET /api/health` reports whether the Zoho settings are present (names only) and needs no sign-in.

The server keeps state on disk (`DATA_DIR`) and reads the factory spreadsheets from files, so it needs a
host that runs a long-lived Node process with a persistent disk. Serverless hosting (e.g. Vercel
functions) would lose the factory meeting decisions between requests.

## Secrets

`backend/.env` holds the Zoho client secret and refresh token and is never committed (`.gitignore`
excludes every `.env` except the examples). Frontend `VITE_*` values are built into public JavaScript,
so they must never contain secrets.
