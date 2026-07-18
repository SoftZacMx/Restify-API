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

/**
 * Payload del token de restablecimiento de contraseña (flujo forgot-password).
 *
 * Mismo diseño que EmailVerificationPayload: token corto y stateless, sin tabla
 * en BD. El claim `purpose: 'password_reset'` lo aísla de los tokens de auth y de
 * verificación de email; `verifyPasswordResetToken` rechaza cualquier otro `purpose`.
 * Expira rápido (5 min) por ser sensible.
 */
export interface PasswordResetPayload {
  sub: string; // userId
  email: string;
  purpose: 'password_reset';
}

/**
 * Payload del token de reactivación de organización (flujo close → reactivate).
 *
 * Mismo diseño stateless que los tokens de reset/verify: el claim
 * `purpose: 'organization_reactivation'` lo aísla del resto y
 * `verifyOrganizationReactivationToken` rechaza cualquier otro `purpose`. Lleva
 * `org` porque el token autoriza reactivar UNA organización concreta. Expira
 * rápido (10 min): la reactivación es un acto inmediato (pedir correo → abrir link),
 * no algo que se posponga días. La unicidad de uso NO se persigue con el token, sino
 * con el estado: reactivar exige que la org siga cerrada, así que un token reusado
 * ya no puede hacer nada una vez la org está ACTIVE.
 */
export interface OrganizationReactivationPayload {
  sub: string; // userId (owner)
  email: string;
  org: string; // organizationId a reactivar
  purpose: 'organization_reactivation';
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

  /**
   * Firma un token de restablecimiento de contraseña (flujo forgot-password).
   * Expiry corto por defecto (5 min): es un token sensible que otorga cambio de
   * contraseña, así que se minimiza la ventana de uso.
   */
  static generatePasswordResetToken(
    payload: Omit<PasswordResetPayload, 'purpose'>,
    expiresIn = '5m'
  ): string {
    return jwt.sign(
      { ...payload, purpose: 'password_reset' } satisfies PasswordResetPayload,
      this.SECRET,
      { expiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verifica un token de restablecimiento: valida firma + expiry y exige
   * `purpose === 'password_reset'`. Lanza `Error('Invalid token')` si el token es
   * inválido, expiró o su `purpose` no corresponde.
   */
  static verifyPasswordResetToken(token: string): PasswordResetPayload {
    let decoded: PasswordResetPayload;
    try {
      decoded = jwt.verify(token, this.SECRET) as PasswordResetPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }

    if (decoded.purpose !== 'password_reset') {
      throw new Error('Invalid token');
    }

    return decoded;
  }

  /**
   * Firma un token de reactivación de organización. Expiry corto por defecto
   * (10 min): la reactivación se pide y confirma en la misma sesión, el token solo
   * cubre el tiempo de entrega del correo + apertura del link.
   */
  static generateOrganizationReactivationToken(
    payload: Omit<OrganizationReactivationPayload, 'purpose'>,
    expiresIn = '10m'
  ): string {
    return jwt.sign(
      {
        ...payload,
        purpose: 'organization_reactivation',
      } satisfies OrganizationReactivationPayload,
      this.SECRET,
      { expiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verifica un token de reactivación: valida firma + expiry y exige
   * `purpose === 'organization_reactivation'`. Lanza `Error('Invalid token')` si el
   * token es inválido, expiró o su `purpose` no corresponde.
   */
  static verifyOrganizationReactivationToken(token: string): OrganizationReactivationPayload {
    let decoded: OrganizationReactivationPayload;
    try {
      decoded = jwt.verify(token, this.SECRET) as OrganizationReactivationPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }

    if (decoded.purpose !== 'organization_reactivation') {
      throw new Error('Invalid token');
    }

    return decoded;
  }
}
