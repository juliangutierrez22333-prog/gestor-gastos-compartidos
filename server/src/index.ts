import { createApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db/connection.js';

const db = createDb(config.databasePath);
const app = createApp({ db, jwtSecret: config.jwtSecret });

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
});
