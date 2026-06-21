'use strict';

// VERCEL NATIVE HACK:
// By moving the Express app into the `api/_server/` directory, we ensure
// that ALL backend files are strictly contained within the `api/` lambda root.
// Vercel perfectly natively traces these requires without any "escaping root" issues.
// The underscore prevents Vercel from treating each file as a separate public Serverless Function.

try {
  // Export the entire Express monolith directly
  const app = require('./_server/server.js');
  module.exports = app;
} catch (error) {
  // Catch ENV validation errors or startup crashes and return 500
  console.error("Vercel Startup Error:", error);
  const express = require('express');
  const fallbackApp = express();
  fallbackApp.use((req, res) => {
    res.status(500).json({
      error: 'CRITICAL SERVER BOOT ERROR',
      message: error.message,
      stack: error.stack
    });
  });
  module.exports = fallbackApp;
}
