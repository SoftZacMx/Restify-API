import jwt from 'jsonwebtoken';

export interface JwtPayload {
  email: string;
  userId?: string;
  rol?: string;
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
}
