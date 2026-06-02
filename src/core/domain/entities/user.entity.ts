import { UserRole, UserAccountStatus } from '@prisma/client';

export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly last_name: string,
    public readonly second_last_name: string | null,
    public readonly email: string,
    public readonly password: string,
    public readonly phone: string | null,
    public readonly status: boolean,
    public readonly rol: UserRole,
    public readonly organizationId: string,
    public readonly accountStatus: UserAccountStatus,
    public readonly tokenVersion: number,
    public readonly emailVerifiedAt: Date | null,
    public readonly mustChangePassword: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromPrisma(data: any): User {
    return new User(
      data.id,
      data.name,
      data.last_name,
      data.second_last_name,
      data.email,
      data.password,
      data.phone,
      data.status,
      data.rol,
      data.organizationId,
      data.accountStatus,
      data.tokenVersion,
      data.emailVerifiedAt,
      data.mustChangePassword,
      data.createdAt,
      data.updatedAt
    );
  }

  isActive(): boolean {
    return this.status === true;
  }

  isWaiter(): boolean {
    return this.rol === UserRole.WAITER;
  }

  isAdmin(): boolean {
    return this.rol === UserRole.ADMIN;
  }

  isManager(): boolean {
    return this.rol === UserRole.MANAGER;
  }

  isChef(): boolean {
    return this.rol === UserRole.CHEF;
  }

  isOwner(): boolean {
    return this.rol === UserRole.OWNER;
  }

  isAccountActive(): boolean {
    return this.accountStatus === UserAccountStatus.ACTIVE;
  }

  isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  hasAccessToAllBranches(): boolean {
    return this.rol === UserRole.OWNER || this.rol === UserRole.ADMIN;
  }

  getFullName(): string {
    const parts = [this.name, this.last_name];
    if (this.second_last_name) {
      parts.push(this.second_last_name);
    }
    return parts.join(' ');
  }
}

