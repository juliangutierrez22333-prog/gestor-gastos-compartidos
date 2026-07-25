// Carga .env si existe (soporte nativo de Node >= 20.12, sin dotenv).
try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: se usan las variables de entorno del sistema.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databasePath: process.env.DATABASE_PATH ?? 'data/app.db',
  jwtSecret: required('JWT_SECRET'),
};
