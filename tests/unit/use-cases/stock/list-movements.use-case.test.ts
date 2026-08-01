import { Prisma, StockMovement, StockMovementType } from '@prisma/client';
import { ListMovementsUseCase } from '../../../../src/core/application/use-cases/stock/list-movements.use-case';
import { StockService } from '../../../../src/core/application/services/stock.service';

const Decimal = Prisma.Decimal;

type MovementWithUser = StockMovement & {
  user: { name: string; last_name: string; second_last_name: string | null } | null;
};

function buildMovement(overrides: Partial<MovementWithUser> = {}): MovementWithUser {
  return {
    id: 'mov-1',
    productId: 'prod-1',
    quantity: new Decimal('-2'),
    type: StockMovementType.SALE,
    reason: 'Venta',
    notes: null,
    expenseItemId: null,
    orderItemId: 'oi-1',
    userId: 'user-1',
    branchId: 'branch-1',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    user: { name: 'Ana', last_name: 'López', second_last_name: null },
    ...overrides,
  };
}

describe('ListMovementsUseCase', () => {
  let useCase: ListMovementsUseCase;
  let mockStockService: jest.Mocked<Pick<StockService, 'getMovements'>>;

  beforeEach(() => {
    mockStockService = {
      getMovements: jest.fn(),
    };

    useCase = new ListMovementsUseCase(mockStockService as unknown as StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('mapea el movimiento con el nombre completo del usuario', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-31T23:59:59Z');
    mockStockService.getMovements.mockResolvedValue([buildMovement()]);

    const result = await useCase.execute({
      productId: 'prod-1',
      type: StockMovementType.SALE,
      reason: 'Venta',
      from,
      to,
      limit: 50,
      offset: 10,
    });

    expect(mockStockService.getMovements).toHaveBeenCalledWith({
      productId: 'prod-1',
      type: StockMovementType.SALE,
      reason: 'Venta',
      from,
      to,
      limit: 50,
      offset: 10,
    });
    expect(result).toEqual([
      {
        id: 'mov-1',
        productId: 'prod-1',
        quantity: '-2',
        type: StockMovementType.SALE,
        reason: 'Venta',
        notes: null,
        expenseItemId: null,
        orderItemId: 'oi-1',
        userId: 'user-1',
        userName: 'Ana López',
        createdAt: expect.any(Date),
      },
    ]);
  });

  it('sin filtros delega el objeto vacío de default y deja userName en null si no hay usuario', async () => {
    mockStockService.getMovements.mockResolvedValue([
      buildMovement({ user: null, userId: null, orderItemId: null }),
    ]);

    const result = await useCase.execute();

    expect(mockStockService.getMovements).toHaveBeenCalledWith({
      productId: undefined,
      type: undefined,
      reason: undefined,
      from: undefined,
      to: undefined,
      limit: undefined,
      offset: undefined,
    });
    expect(result[0].userName).toBeNull();
  });

  it('recorta espacios al inicio y final del nombre del usuario', async () => {
    mockStockService.getMovements.mockResolvedValue([
      buildMovement({ user: { name: ' Ana', last_name: 'López ', second_last_name: null } }),
    ]);

    const result = await useCase.execute();

    expect(result[0].userName).toBe('Ana López');
  });
});
