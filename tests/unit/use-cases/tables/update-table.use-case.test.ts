import { UpdateTableUseCase } from '../../../../src/core/application/use-cases/tables/update-table.use-case';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateTableUseCase', () => {
  let updateTableUseCase: UpdateTableUseCase;
  let mockTableRepository: jest.Mocked<ITableRepository>;

  beforeEach(() => {
    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    updateTableUseCase = new UpdateTableUseCase(mockTableRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const tableId = '123';
    const existingTable = new Table(
      '123',
      '1',
      '456',
      true,
      true,
      new Date(),
      new Date()
    );

    it('should update table successfully', async () => {
      mockTableRepository.findById.mockResolvedValue(existingTable);
      mockTableRepository.update.mockResolvedValue({
        ...existingTable,
        status: false,
      } as Table);

      const result = await updateTableUseCase.execute(tableId, { status: false });

      expect(result.status).toBe(false);
      expect(mockTableRepository.findById).toHaveBeenCalledWith(tableId);
      expect(mockTableRepository.update).toHaveBeenCalled();
    });

    it('should throw error when table not found', async () => {
      mockTableRepository.findById.mockResolvedValue(null);

      try {
        await updateTableUseCase.execute(tableId, { status: false });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('TABLE_NOT_FOUND');
      }
    });

    it('should throw error when new table name already exists', async () => {
      const otherTable = new Table(
        '789',
        '5',
        '456',
        true,
        true,
        new Date(),
        new Date()
      );

      mockTableRepository.findById.mockResolvedValue(existingTable);
      mockTableRepository.findByName.mockResolvedValue(otherTable);

      try {
        await updateTableUseCase.execute(tableId, { name: '5' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should allow updating to same name', async () => {
      mockTableRepository.findById.mockResolvedValue(existingTable);
      mockTableRepository.update.mockResolvedValue(existingTable);

      await updateTableUseCase.execute(tableId, { name: '1' });

      expect(mockTableRepository.findByName).not.toHaveBeenCalled();
      expect(mockTableRepository.update).toHaveBeenCalled();
    });
  });
});
