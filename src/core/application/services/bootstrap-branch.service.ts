import { injectable } from 'tsyringe';

/**
 * Service for bootstrapping a new branch with default data.
 *
 * Creates initial data to reduce friction in onboarding:
 * - 4 predefined menu categories (can be edited/removed later)
 * - Initial table ("Mesa 1") to start operating immediately
 */
@injectable()
export class BootstrapBranchService {
  /**
   * Bootstrap a branch with default menu categories and initial table.
   *
   * @param tx - Prisma transaction (supports both base and extended clients)
   * @param branchId - Branch ID to bootstrap
   * @param userId - User ID for the initial table owner (typically the owner)
   */
  async execute(tx: any, branchId: string, userId: string): Promise<void> {
    // Create default menu categories
    // These are generic categories that work for most restaurant types
    // Users can edit, remove, or add categories based on their business
    const categories = [
      { name: 'Entradas', order: 1 },
      { name: 'Platos principales', order: 2 },
      { name: 'Bebidas', order: 3 },
      { name: 'Postres', order: 4 },
    ];

    await tx.menuCategory.createMany({
      data: categories.map((cat) => ({
        name: cat.name,
        branchId,
        status: true,
      })),
    });

    // Create initial table
    // Allows the user to start taking orders immediately after signup
    await tx.table.create({
      data: {
        name: 'Mesa 1',
        branchId,
        userId,
        status: true,
        availabilityStatus: true,
      },
    });
  }
}
