import { BootstrapBranchService } from '../../../src/core/application/services/bootstrap-branch.service';

describe('BootstrapBranchService', () => {
  let service: BootstrapBranchService;
  let mockTx: any;

  beforeEach(() => {
    service = new BootstrapBranchService();
    mockTx = {
      menuCategory: {
        createMany: jest.fn().mockResolvedValue({}),
      },
      table: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
  });

  describe('execute', () => {
    it('should create 4 default menu categories', async () => {
      const branchId = 'branch-123';
      const userId = 'user-123';

      await service.execute(mockTx, branchId, userId);

      expect(mockTx.menuCategory.createMany).toHaveBeenCalledWith({
        data: [
          { name: 'Entradas', branchId, status: true },
          { name: 'Platos principales', branchId, status: true },
          { name: 'Bebidas', branchId, status: true },
          { name: 'Postres', branchId, status: true },
        ],
      });
    });

    it('should create initial table "Mesa 1"', async () => {
      const branchId = 'branch-123';
      const userId = 'user-123';

      await service.execute(mockTx, branchId, userId);

      expect(mockTx.table.create).toHaveBeenCalledWith({
        data: {
          name: 'Mesa 1',
          branchId,
          userId,
          status: true,
          availabilityStatus: true,
        },
      });
    });

    it('should create categories before table', async () => {
      const branchId = 'branch-123';
      const userId = 'user-123';

      const callOrder: string[] = [];
      mockTx.menuCategory.createMany.mockImplementation(() => {
        callOrder.push('categories');
        return Promise.resolve({});
      });
      mockTx.table.create.mockImplementation(() => {
        callOrder.push('table');
        return Promise.resolve({});
      });

      await service.execute(mockTx, branchId, userId);

      expect(callOrder).toEqual(['categories', 'table']);
    });
  });
});
