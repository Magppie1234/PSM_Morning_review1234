import { createApp } from '../backend/src/app.js';

// Vercel entry point: every /api/* request is routed here (see vercel.json) and handled by the same Express
// app that `npm start` runs. The built frontend is served by Vercel directly from frontend/dist.
export default createApp();
