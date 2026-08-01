// Helpers compartidos para tests de integración.
//
// Los tests de integración tocan una BD MySQL REAL y DEBEN ejecutarse siempre
// contra una base de datos dedicada de pruebas (`restify_test`), NUNCA contra la
// BD de desarrollo o la QA remota. Este helper es el guardián de esa regla.

export const INTEGRATION_TEST_DATABASE_URL =
  'mysql://root:root_password@localhost:3306/restify_test?connection_limit=5';

/**
 * True solo si la URL apunta a una base de datos LOCAL cuyo nombre contiene
 * `_test`. Cualquier otra cosa (dev, QA remota, sin URL) → false.
 */
export function isLocalTestDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      u.pathname.includes('_test')
    );
  } catch {
    return false;
  }
}

/**
 * Asegura el entorno mínimo para correr contra la BD de pruebas. Si no hay
 * DATABASE_URL definida, apunta a `restify_test`. NO sobreescribe una URL
 * existente: si apunta a dev/QA, los tests se saltan (ver shouldSkipIntegration).
 */
export function ensureTestEnv(): void {
  process.env.NODE_ENV = 'test';
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = INTEGRATION_TEST_DATABASE_URL;
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'integration_test_jwt_secret_min_32_chars_ok';
  }
  process.env.PAYMENT_CONFIG_ENCRYPTION_KEY =
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || 'a'.repeat(64);
  process.env.STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || 'sk_test_integration_mock';
}

/**
 * Skip cuando NO estamos apuntando a la BD de pruebas local. Esto evita:
 *  - correr contra la BD de desarrollo (riesgo de contaminar datos reales)
 *  - correr contra la BD QA remota definida en `.env`
 *  - correr sin BD disponible
 */
export function shouldSkipIntegration(): boolean {
  ensureTestEnv();
  return !isLocalTestDatabase(process.env.DATABASE_URL);
}
