export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

/** Strip surrounding single/double quotes (e.g. Railway adds them when saving env vars) */
function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

export const getServerConfig = (): ServerConfig => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const corsOriginRaw = process.env.CORS_ORIGIN ? stripQuotes(process.env.CORS_ORIGIN) : '';
  const corsOrigin = corsOriginRaw
    ? corsOriginRaw.split(',').map((o) => stripQuotes(o.trim()))
    : (isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : '*');
  const corsCredentials = process.env.CORS_CREDENTIALS !== 'false'; // Default to true unless explicitly disabled

  // If credentials are enabled, origin cannot be '*'
  const finalOrigin = corsCredentials && corsOrigin === '*' 
    ? (isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : corsOrigin)
    : corsOrigin;

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors: {
      origin: finalOrigin,
      credentials: corsCredentials,
    },
  };
};

