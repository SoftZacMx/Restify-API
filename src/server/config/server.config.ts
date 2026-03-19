export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  cors: {
    origin: string;
    credentials: boolean;
  };
}

/** Strip surrounding single/double quotes (e.g. Railway adds them when saving env vars). Exported for WebSocket. */
export function stripEnvQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

/** Orígenes permitidos por CORS: se lee de la variable de entorno CORS_ORIGIN. */
const CORS_ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? [stripEnvQuotes(process.env.CORS_ORIGIN)]
  : ['http://localhost:5173'];

export const getServerConfig = (): ServerConfig => {
  const corsOrigin = process.env.CORS_ORIGIN
    ? stripEnvQuotes(process.env.CORS_ORIGIN)
    : 'http://localhost:5173';

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  };
};

