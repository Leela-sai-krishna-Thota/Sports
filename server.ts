/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './server/routes/api';
import { createServer as createViteServer } from 'vite';

// Load environmental parameters
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Setup security headers and request payload parser limits
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Print request logs for debugging
  app.use((req, res, next) => {
    console.log(`[Full-Stack Server] ${req.method} ${req.url}`);
    next();
  });

  // Mount MVC endpoints
  app.use('/api', apiRouter);

  // Vite Assets Handlers
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running server in DEVELOPMENT mode with Vite dev middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running server in PRODUCTION mode with static file assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Handle errors gracefully to prevent crashing
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server Error Anchor]:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || err });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sports Central full-stack server actively listening on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to launch application server: ', err);
});
