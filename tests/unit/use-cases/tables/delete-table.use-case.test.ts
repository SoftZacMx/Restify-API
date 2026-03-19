import { DeleteTableUseCase } from '../../../../src/core/application/use-cases/tables/delete-table.use-case';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteTableUseCase', () => {
  let deleteTableUseCase: DeleteTableUseCase;
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

    deleteTableUseCase = new DeleteTableUseCase(mockTableRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      table_id: '123',
    };

    it('should delete table successfully', async () => {
      const mockTable = new Table(
        '123',
        '1',
        '456',
        true,
        true,
        new Date(),
        new Date()
      );

      mockTableRepository.findById.mockResolvedValue(mockTable);
      mockTableRepository.delete.mockResolvedValue();

      await deleteTableUseCase.execute(validInput);

      expect(mockTableRepository.findById).toHaveBeenCalledWith('123');
      expect(mockTableRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should throw error when table not found', async () => {
      mockTableRepository.findById.mockResolvedValue(null);

      try {
        await deleteTableUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('TABLE_NOT_FOUND');
      }
    });
  });
});
