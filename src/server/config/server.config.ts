export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

export const getServerConfig = (): ServerConfig => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const corsOrigin = process.env.CORS_ORIGIN?.split(',') || (isDevelopment ? ['http://localhost:5173', 'http://localhost:3000'] : '*');
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

