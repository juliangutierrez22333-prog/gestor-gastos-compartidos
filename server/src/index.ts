import path from 'node:path';

import { createApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db/connection.js';

const db = createDb(config.databasePath);
const app = createApp({
  db,
  jwtSecret: config.jwtSecret,
  clientDist: config.clientDist ? path.resolve(config.clientDist) : undefined,
});

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
});
