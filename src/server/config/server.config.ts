export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

/** Strip surrounding single/double quotes (e.g. Railway adds them when saving env vars). Exported for WebSocket. */
export function stripEnvQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

/**
 * Parse CORS_ORIGIN env var. Supports comma-separated origins.
 * Example: CORS_ORIGIN=http://localhost:5173,https://app.restify.com
 */
function parseCorsOrigins(): string | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return 'http://localhost:5173';

  const cleaned = stripEnvQuotes(raw);
  const origins = cleaned.split(',').map((o) => o.trim()).filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

export const getServerConfig = (): ServerConfig => {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: parseCorsOrigins(),
      credentials: true,
    },
  };
};
