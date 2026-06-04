import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  rol: string;
  org: string; // organizationId
  branch?: string; // branchId (optional)
  tokenVersion: number;
  emailVerified: boolean;
  mustChangePassword: boolean;

  // Legacy fields (keep for backwards compatibility during migration)
  userId?: string;
}

/**
 * Payload reducido para el token de verificación de email (4.1.E).
 *
 * No reutiliza `JwtPayload` (que carga contexto de auth: rol, org, tokenVersion…)
 * porque este token solo confirma la titularidad del correo. El claim `purpose`
 * lo distingue de un token de auth/reset: `verifyEmailToken` rechaza cualquier
 * token cuyo `purpose` no sea `'email_verification'`.
 */
export interface EmailVerificationPayload {
  sub: string; // userId
  email: string;
  purpose: 'email_verification';
}

export class JwtUtil {
  private static _secret: string | null = null;

  private static get SECRET(): string {
    if (!this._secret) {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      this._secret = secret;
    }
    return this._secret;
  }

  private static get EXPIRES_IN(): string {
    return process.env.JWT_EXPIRES_IN || '24h';
  }

  static generateToken(payload: JwtPayload, expiresIn?: string): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: expiresIn || this.EXPIRES_IN,
    } as jwt.SignOptions);
  }

  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.SECRET) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Firma un token de verificación de email (4.1.E). Expiry 24h por defecto
   * (más largo que el reset de 1h porque el correo se abre con retraso).
   */
  static generateEmailVerificationToken(
    payload: Omit<EmailVerificationPayload, 'purpose'>,
    expiresIn = '1h'
  ): string {
    return jwt.sign(
      { ...payload, purpose: 'email_verification' } satisfies EmailVerificationPayload,
      this.SECRET,
      { expiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verifica un token de verificación de email: valida firma + expiry y exige
   * `purpose === 'email_verification'`. Lanza `Error('Invalid token')` si el
   * token es inválido, expiró o su `purpose` no corresponde.
   */
  static verifyEmailVerificationToken(token: string): EmailVerificationPayload {
    let decoded: EmailVerificationPayload;
    try {
      decoded = jwt.verify(token, this.SECRET) as EmailVerificationPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }

    if (decoded.purpose !== 'email_verification') {
      throw new Error('Invalid token');
    }

    return decoded;
  }
}
