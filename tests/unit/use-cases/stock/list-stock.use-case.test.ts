import { Prisma, UnitOfMeasure } from '@prisma/client';
import { ListStockUseCase } from '../../../../src/core/application/use-cases/stock/list-stock.use-case';
import { StockService, StockSummary } from '../../../../src/core/application/services/stock.service';

const Decimal = Prisma.Decimal;

function buildSummary(overrides: Partial<StockSummary> = {}): StockSummary {
  return {
    productId: 'prod-1',
    name: 'Café',
    description: 'Grano',
    unitOfMeasure: UnitOfMeasure.KG,
    stockActual: new Decimal('10.5'),
    averageCost: new Decimal('2.25'),
    minStockAlert: new Decimal('5'),
    trackStock: true,
    isLowStock: false,
    ...overrides,
  };
}

describe('ListStockUseCase', () => {
  let useCase: ListStockUseCase;
  let mockStockService: jest.Mocked<Pick<StockService, 'getStockSummary'>>;

  beforeEach(() => {
    mockStockService = {
      getStockSummary: jest.fn(),
    };

    useCase = new ListStockUseCase(mockStockService as unknown as StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve el resumen mapeado sin filtros cuando no recibe input', async () => {
    mockStockService.getStockSummary.mockResolvedValue([buildSummary({ minStockAlert: null })]);

    const result = await useCase.execute();

    expect(mockStockService.getStockSummary).toHaveBeenCalledWith({
      search: undefined,
      lowStockOnly: undefined,
    });
    expect(result).toEqual([
      {
        productId: 'prod-1',
        name: 'Café',
        description: 'Grano',
        unitOfMeasure: UnitOfMeasure.KG,
        stockActual: '10.5',
        averageCost: '2.25',
        minStockAlert: null,
        trackStock: true,
        isLowStock: false,
      },
    ]);
  });

  it('serializa minStockAlert como string cuando existe', async () => {
    mockStockService.getStockSummary.mockResolvedValue([buildSummary()]);

    const result = await useCase.execute({});

    expect(result[0].minStockAlert).toBe('5');
  });

  it('propaga search y lowStock al servicio', async () => {
    mockStockService.getStockSummary.mockResolvedValue([buildSummary()]);

    await useCase.execute({ search: 'café', lowStock: true });

    expect(mockStockService.getStockSummary).toHaveBeenCalledWith({
      search: 'café',
      lowStockOnly: true,
    });
  });
});
