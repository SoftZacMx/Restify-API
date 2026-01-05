import { UserRole } from '@prisma/client';

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

  getFullName(): string {
    const parts = [this.name, this.last_name];
    if (this.second_last_name) {
      parts.push(this.second_last_name);
    }
    return parts.join(' ');
  }
}

