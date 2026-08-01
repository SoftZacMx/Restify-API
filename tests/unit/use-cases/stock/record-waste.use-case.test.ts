import { Prisma, StockMovement, StockMovementType } from '@prisma/client';
import { RecordWasteUseCase } from '../../../../src/core/application/use-cases/stock/record-waste.use-case';
import { StockService } from '../../../../src/core/application/services/stock.service';

const Decimal = Prisma.Decimal;

function buildMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mov-1',
    productId: 'prod-1',
    quantity: new Decimal('-2'),
    type: StockMovementType.WASTE,
    reason: 'EXPIRED',
    notes: null,
    expenseItemId: null,
    orderItemId: null,
    userId: 'user-1',
    branchId: 'branch-1',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('RecordWasteUseCase', () => {
  let useCase: RecordWasteUseCase;
  let mockStockService: jest.Mocked<Pick<StockService, 'recordWaste'>>;

  beforeEach(() => {
    mockStockService = {
      recordWaste: jest.fn(),
    };

    useCase = new RecordWasteUseCase(mockStockService as unknown as StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve recorded true con el movement mapeado', async () => {
    mockStockService.recordWaste.mockResolvedValue(buildMovement());

    const result = await useCase.execute({
      productId: 'prod-1',
      quantity: 2,
      reason: 'EXPIRED',
      userId: 'user-1',
      notes: 'Merma por vencimiento',
    });

    expect(mockStockService.recordWaste).toHaveBeenCalledWith({
      productId: 'prod-1',
      quantity: 2,
      reason: 'EXPIRED',
      userId: 'user-1',
      notes: 'Merma por vencimiento',
    });
    expect(result).toEqual({
      recorded: true,
      movement: {
        id: 'mov-1',
        productId: 'prod-1',
        quantity: '-2',
        type: StockMovementType.WASTE,
        reason: 'EXPIRED',
        createdAt: expect.any(Date),
      },
    });
  });

  it('normaliza notes undefined a null al llamar al servicio', async () => {
    mockStockService.recordWaste.mockResolvedValue(buildMovement());

    await useCase.execute({
      productId: 'prod-1',
      quantity: 2,
      reason: 'BROKEN',
      userId: 'user-1',
    });

    expect(mockStockService.recordWaste).toHaveBeenCalledWith({
      productId: 'prod-1',
      quantity: 2,
      reason: 'BROKEN',
      userId: 'user-1',
      notes: null,
    });
  });

  it('devuelve recorded false y movement null cuando el producto no trackea stock', async () => {
    mockStockService.recordWaste.mockResolvedValue(null);

    const result = await useCase.execute({
      productId: 'prod-1',
      quantity: 2,
      reason: 'THEFT',
      userId: 'user-1',
    });

    expect(result).toEqual({ recorded: false, movement: null });
  });
});
