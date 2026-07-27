// Vercel serverless entry. Vercel treats files in /api as functions; this one
// re-exports the configured Express app, which Vercel runs as the handler.
// The rewrite in vercel.json sends every /api/* request here, and Express
// routes on the original URL.
import app from "../server/src/index";

export default app;
