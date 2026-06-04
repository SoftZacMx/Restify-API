import { UserRole } from '@prisma/client';
import { User } from '../entities/user.entity';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: Partial<User>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  reactivate(id: string): Promise<User>;
  findAll(filters?: UserFilters): Promise<User[]>;
  /**
   * Fuerza el reseteo de contraseña del usuario: marca `mustChangePassword = true`
   * e incrementa `tokenVersion` (invalida sus sesiones activas).
   */
  markForPasswordReset(id: string): Promise<User>;
  /**
   * Marca el email del usuario como verificado seteando `emailVerifiedAt = now()`.
   * Idempotente desde el punto de vista del flujo: el caller decide si ya estaba verificado.
   */
  markEmailVerified(id: string): Promise<User>;
}

export interface UserFilters {
  rol?: UserRole;
  status?: boolean | 'all'; // 'all' means show both active and inactive users
  email?: string;
}

