import { Prisma, StockMovement, StockMovementType } from '@prisma/client';
import { RecordAdjustmentUseCase } from '../../../../src/core/application/use-cases/stock/record-adjustment.use-case';
import { StockService } from '../../../../src/core/application/services/stock.service';

const Decimal = Prisma.Decimal;

function buildMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mov-1',
    productId: 'prod-1',
    quantity: new Decimal('4'),
    type: StockMovementType.ADJUSTMENT,
    reason: 'Conteo físico',
    notes: null,
    expenseItemId: null,
    orderItemId: null,
    userId: 'user-1',
    branchId: 'branch-1',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('RecordAdjustmentUseCase', () => {
  let useCase: RecordAdjustmentUseCase;
  let mockStockService: jest.Mocked<Pick<StockService, 'recordAdjustment'>>;

  beforeEach(() => {
    mockStockService = {
      recordAdjustment: jest.fn(),
    };

    useCase = new RecordAdjustmentUseCase(mockStockService as unknown as StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve recorded true con el movement mapeado', async () => {
    mockStockService.recordAdjustment.mockResolvedValue(buildMovement());

    const result = await useCase.execute({
      productId: 'prod-1',
      newStock: 14,
      reason: 'Conteo físico',
      userId: 'user-1',
      notes: 'Ajuste de inventario',
    });

    expect(mockStockService.recordAdjustment).toHaveBeenCalledWith({
      productId: 'prod-1',
      newStock: 14,
      reason: 'Conteo físico',
      userId: 'user-1',
      notes: 'Ajuste de inventario',
    });
    expect(result).toEqual({
      recorded: true,
      movement: {
        id: 'mov-1',
        productId: 'prod-1',
        quantity: '4',
        type: StockMovementType.ADJUSTMENT,
        reason: 'Conteo físico',
        createdAt: expect.any(Date),
      },
    });
  });

  it('normaliza notes undefined a null al llamar al servicio', async () => {
    mockStockService.recordAdjustment.mockResolvedValue(buildMovement());

    await useCase.execute({
      productId: 'prod-1',
      newStock: 14,
      reason: 'Conteo físico',
      userId: 'user-1',
    });

    expect(mockStockService.recordAdjustment).toHaveBeenCalledWith({
      productId: 'prod-1',
      newStock: 14,
      reason: 'Conteo físico',
      userId: 'user-1',
      notes: null,
    });
  });

  it('devuelve recorded false y movement null cuando no se generó movement', async () => {
    mockStockService.recordAdjustment.mockResolvedValue(null);

    const result = await useCase.execute({
      productId: 'prod-1',
      newStock: 10,
      reason: 'Sin cambios',
      userId: 'user-1',
    });

    expect(result).toEqual({ recorded: false, movement: null });
  });
});
