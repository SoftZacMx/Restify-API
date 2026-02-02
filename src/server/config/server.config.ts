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
  // CORS: siempre cualquier origen, sin restricción (dev, qa, producción).
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: true,
      credentials: true,
      allowedOrigins: [],
    },
  };
};

