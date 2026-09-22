// Where the API lives. Empty (the default) means the same address the page was loaded from: in production
// the backend serves this app, and in development Vite forwards /api to the backend (see vite.config.js).
// Set VITE_API_URL only when the API is hosted somewhere else.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const apiUrl = (path) => `${API_URL}${path}`;
