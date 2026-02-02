export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    /** Lista de orígenes permitidos para usar como fallback si la petición no trae Origin (ej. proxy). */
    allowedOrigins: string[];
  };
}

/** Strip surrounding single/double quotes (e.g. Railway adds them when saving env vars). Exported for WebSocket. */
export function stripEnvQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

export const getServerConfig = (): ServerConfig => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const corsOriginRaw = process.env.CORS_ORIGIN ? stripEnvQuotes(process.env.CORS_ORIGIN) : '';
  const corsOrigin = corsOriginRaw
    ? corsOriginRaw.split(',').map((o) => stripEnvQuotes(o.trim()))
    : (isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : '*');
  const corsCredentials = process.env.CORS_CREDENTIALS !== 'false'; // Default to true unless explicitly disabled

  // If credentials are enabled, origin cannot be '*'. In production with no CORS_ORIGIN, reflect request origin (allow any).
  const finalOrigin =
    corsCredentials && corsOrigin === '*'
      ? isDevelopment
        ? ['http://localhost:5173', 'http://localhost:3000']
        : true // reflect request Origin so CORS works even if CORS_ORIGIN not set in Railway
      : corsOrigin;

  const allowedOrigins = Array.isArray(corsOrigin)
    ? corsOrigin
    : corsOrigin === '*'
      ? []
      : [corsOrigin as string];

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: finalOrigin,
      credentials: corsCredentials,
      allowedOrigins,
    },
  };
};

