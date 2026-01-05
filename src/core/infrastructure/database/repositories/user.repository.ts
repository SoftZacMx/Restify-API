import { PrismaClient, UserRole } from '@prisma/client';
import { injectable } from 'tsyringe';
import { IUserRepository, UserFilters } from '../../../domain/interfaces/user-repository.interface';
import { User } from '../../../domain/entities/user.entity';

@injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? User.fromPrisma(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? User.fromPrisma(user) : null;
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        name: userData.name!,
        last_name: userData.last_name!,
        second_last_name: userData.second_last_name || null,
        email: userData.email!,
        password: userData.password!,
        phone: userData.phone || null,
        status: userData.status ?? true,
        rol: userData.rol! as UserRole,
      },
    });

    return User.fromPrisma(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const updateData: any = {};

    if (userData.name) updateData.name = userData.name;
    if (userData.last_name) updateData.last_name = userData.last_name;
    if (userData.second_last_name !== undefined) updateData.second_last_name = userData.second_last_name;
    if (userData.email) updateData.email = userData.email;
    if (userData.password) updateData.password = userData.password;
    if (userData.phone !== undefined) updateData.phone = userData.phone;
    if (userData.status !== undefined) updateData.status = userData.status;
    if (userData.rol) updateData.rol = userData.rol as UserRole;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return User.fromPrisma(user);
  }

  async delete(id: string): Promise<void> {
    // Soft delete: desactivar usuario en lugar de eliminarlo físicamente
    await this.prisma.user.update({
      where: { id },
      data: { status: false },
    });
  }

  async reactivate(id: string): Promise<User> {
    // Reactivar usuario: cambiar status a true
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: true },
    });

    return User.fromPrisma(user);
  }

  async findAll(filters?: UserFilters): Promise<User[]> {
    const where: any = {};

    if (filters?.rol) {
      where.rol = filters.rol as UserRole;
    }

    // Manejo del filtro de status:
    // - Si no se especifica: solo usuarios activos (status: true) - comportamiento por defecto
    // - Si se especifica status: true -> solo activos
    // - Si se especifica status: false -> solo inactivos
    // - Si se especifica status: 'all' -> todos (activos e inactivos)
    if (filters?.status === 'all') {
      // No agregar filtro de status, mostrar todos
    } else if (filters?.status !== undefined) {
      // Se especificó explícitamente true o false
      where.status = filters.status;
    } else {
      // Por defecto, solo usuarios activos
      where.status = true;
    }

    if (filters?.email) {
      where.email = { contains: filters.email };
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => User.fromPrisma(user));
  }
}

