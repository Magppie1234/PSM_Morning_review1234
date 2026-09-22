import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Every setting the API reads, in one place. Values come from backend/.env locally and from the host's
// environment variables in production; see backend/.env.example for the full list.
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = (name, fallback = '') => (process.env[name] ?? '').trim() || fallback;
const list = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

const REQUIRED = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ACCOUNTS_URL', 'ZOHO_API_DOMAIN'];
export const missingSettings = REQUIRED.filter((name) => !read(name));

const isProduction = read('NODE_ENV') === 'production';
// On Vercel only /tmp is writable, and it is wiped between function instances.
const dataDir = path.resolve(BACKEND_ROOT, read('DATA_DIR', process.env.VERCEL ? '/tmp/psm-morning-review' : '.data'));

export const config = {
  isProduction,
  port: Number(read('PORT', '4010')),
  // Localhost only while developing; all interfaces when deployed so the host can reach it.
  host: read('HOST', isProduction ? '0.0.0.0' : '127.0.0.1'),
  // Sites allowed to call the API from a browser. Empty in production = same origin only.
  corsOrigins: list(read('CORS_ORIGIN', isProduction ? '' : 'http://127.0.0.1:5174,http://localhost:5174')),
  // Optional sign-in for the whole dashboard (HTTP Basic). Set both to turn it on.
  auth: { user: read('DASHBOARD_USER'), password: read('DASHBOARD_PASSWORD') },
  // Serve the built frontend (frontend/dist) from this server, so one deployment runs everything.
  frontendDist: path.resolve(BACKEND_ROOT, '..', 'frontend', 'dist'),
  // Runtime files: Zoho token, CRM fallback caches, factory meeting state. Never committed.
  dataDir,
  zoho: {
    clientId: read('ZOHO_CLIENT_ID'),
    clientSecret: read('ZOHO_CLIENT_SECRET'),
    refreshToken: read('ZOHO_REFRESH_TOKEN'),
    accountsUrl: read('ZOHO_ACCOUNTS_URL', 'https://accounts.zoho.in'),
    apiDomain: read('ZOHO_API_DOMAIN', 'https://www.zohoapis.in'),
    orgId: read('ZOHO_ORG_ID'),
    leadsModule: read('ZOHO_LEADS_MODULE', 'Leads'),
    timezone: read('ZOHO_DASHBOARD_TIMEZONE', 'Asia/Kolkata')
  },
  // Factory stand-up spreadsheets (exported from the planning / dispatch / CHI sheets).
  factoryFiles: {
    planning: path.resolve(BACKEND_ROOT, read('FACTORY_PLANNING_FILE', path.join(dataDir, 'factory', 'Planning Query.xlsx'))),
    dispatch: path.resolve(BACKEND_ROOT, read('FACTORY_DISPATCH_FILE', path.join(dataDir, 'factory', 'Dispatch Failure.xlsx'))),
    chi: path.resolve(BACKEND_ROOT, read('FACTORY_CHI_FILE', path.join(dataDir, 'factory', 'CHI MEET REF 8 SEP26.xlsx')))
  }
};

// Zoho credentials are needed for every live board; say so once, clearly, at start-up.
export function assertZohoConfigured() {
  if (missingSettings.length) {
    throw new Error(`Missing required environment variable(s): ${missingSettings.join(', ')}. Copy backend/.env.example to backend/.env and fill them in.`);
  }
}
