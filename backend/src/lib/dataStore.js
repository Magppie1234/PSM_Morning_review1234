import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

// Small JSON files the API keeps between restarts (Zoho access token, CRM fallback caches, factory
// meeting decisions). They live in DATA_DIR (backend/.data by default), outside the source tree.
export const dataPath = (name) => path.join(config.dataDir, name);

export function readJson(name, fallback = null) {
  try {
    const file = dataPath(name);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : fallback;
  } catch (error) {
    console.error(`Could not read ${name}:`, error.message);
    return fallback;
  }
}

// `strict` makes a failed write throw (for data the user just saved); otherwise it is logged and ignored.
export function writeJson(name, data, { strict = false, pretty = false } = {}) {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(dataPath(name), JSON.stringify(data, null, pretty ? 2 : 0), 'utf-8');
  } catch (error) {
    if (strict) throw error;
    console.error(`Could not write ${name}:`, error.message);
  }
}

export function removeFile(name) {
  try { fs.rmSync(dataPath(name), { force: true }); } catch { /* already gone */ }
}
