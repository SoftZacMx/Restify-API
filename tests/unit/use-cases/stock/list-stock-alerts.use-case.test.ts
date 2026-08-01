import { Prisma, UnitOfMeasure } from '@prisma/client';
import { ListStockAlertsUseCase } from '../../../../src/core/application/use-cases/stock/list-stock-alerts.use-case';
import { StockService, StockSummary } from '../../../../src/core/application/services/stock.service';

const Decimal = Prisma.Decimal;

function buildSummary(overrides: Partial<StockSummary> = {}): StockSummary {
  return {
    productId: 'prod-1',
    name: 'Café',
    description: 'Grano',
    unitOfMeasure: UnitOfMeasure.KG,
    stockActual: new Decimal('3'),
    averageCost: new Decimal('2.25'),
    minStockAlert: new Decimal('5'),
    trackStock: true,
    isLowStock: true,
    ...overrides,
  };
}

describe('ListStockAlertsUseCase', () => {
  let useCase: ListStockAlertsUseCase;
  let mockStockService: jest.Mocked<Pick<StockService, 'getStockSummary'>>;

  beforeEach(() => {
    mockStockService = {
      getStockSummary: jest.fn(),
    };

    useCase = new ListStockAlertsUseCase(mockStockService as unknown as StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('pide solo productos con stock bajo y mapea la alerta', async () => {
    mockStockService.getStockSummary.mockResolvedValue([buildSummary()]);

    const result = await useCase.execute();

    expect(mockStockService.getStockSummary).toHaveBeenCalledWith({ lowStockOnly: true });
    expect(result).toEqual([
      {
        productId: 'prod-1',
        name: 'Café',
        unitOfMeasure: UnitOfMeasure.KG,
        stockActual: '3',
        minStockAlert: '5',
      },
    ]);
  });

  it('devuelve minStockAlert null cuando el producto no tiene alerta configurada', async () => {
    mockStockService.getStockSummary.mockResolvedValue([buildSummary({ minStockAlert: null })]);

    const result = await useCase.execute();

    expect(result).toEqual([
      {
        productId: 'prod-1',
        name: 'Café',
        unitOfMeasure: UnitOfMeasure.KG,
        stockActual: '3',
        minStockAlert: null,
      },
    ]);
  });
});
