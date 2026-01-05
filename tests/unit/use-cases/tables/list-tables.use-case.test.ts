import { ListTablesUseCase } from '../../../../src/core/application/use-cases/tables/list-tables.use-case';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Table } from '../../../../src/core/domain/entities/table.entity';

describe('ListTablesUseCase', () => {
  let listTablesUseCase: ListTablesUseCase;
  let mockTableRepository: jest.Mocked<ITableRepository>;

  beforeEach(() => {
    mockTableRepository = {
      findById: jest.fn(),
      findByNumberTable: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    listTablesUseCase = new ListTablesUseCase(mockTableRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all tables when no filters provided', async () => {
      const mockTables = [
        new Table('1', 1, '123', true, true, new Date(), new Date()),
        new Table('2', 2, '123', true, false, new Date(), new Date()),
      ];

      mockTableRepository.findAll.mockResolvedValue(mockTables);

      const result = await listTablesUseCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].numberTable).toBe(1);
      expect(result[1].numberTable).toBe(2);
      expect(mockTableRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered tables by status', async () => {
      const mockTables = [
        new Table('1', 1, '123', true, true, new Date(), new Date()),
      ];

      mockTableRepository.findAll.mockResolvedValue(mockTables);

      const result = await listTablesUseCase.execute({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockTableRepository.findAll).toHaveBeenCalledWith({
        status: true,
        availabilityStatus: undefined,
        userId: undefined,
        numberTable: undefined,
      });
    });

    it('should return filtered tables by availabilityStatus', async () => {
      const mockTables = [
        new Table('1', 1, '123', true, true, new Date(), new Date()),
      ];

      mockTableRepository.findAll.mockResolvedValue(mockTables);

      const result = await listTablesUseCase.execute({ availabilityStatus: true });

      expect(result).toHaveLength(1);
      expect(result[0].availabilityStatus).toBe(true);
      expect(mockTableRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        availabilityStatus: true,
        userId: undefined,
        numberTable: undefined,
      });
    });

    it('should return filtered tables by numberTable', async () => {
      const mockTables = [
        new Table('1', 5, '123', true, true, new Date(), new Date()),
      ];

      mockTableRepository.findAll.mockResolvedValue(mockTables);

      const result = await listTablesUseCase.execute({ numberTable: 5 });

      expect(result).toHaveLength(1);
      expect(result[0].numberTable).toBe(5);
      expect(mockTableRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        availabilityStatus: undefined,
        userId: undefined,
        numberTable: 5,
      });
    });
  });
});

