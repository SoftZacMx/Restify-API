import { GetTableUseCase } from '../../../../src/core/application/use-cases/tables/get-table.use-case';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetTableUseCase', () => {
  let getTableUseCase: GetTableUseCase;
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

    getTableUseCase = new GetTableUseCase(mockTableRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      table_id: '123',
    };

    it('should return table data when table exists', async () => {
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

      const result = await getTableUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('123');
      expect(result.name).toBe('1');
      expect(mockTableRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should throw error when table not found', async () => {
      mockTableRepository.findById.mockResolvedValue(null);

      try {
        await getTableUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('TABLE_NOT_FOUND');
      }
    });
  });
});
