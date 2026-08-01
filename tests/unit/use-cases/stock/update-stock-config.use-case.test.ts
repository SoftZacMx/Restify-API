import { UnitOfMeasure } from '@prisma/client';
import { UpdateStockConfigUseCase } from '../../../../src/core/application/use-cases/stock/update-stock-config.use-case';
import { StockService } from '../../../../src/core/application/services/stock.service';

describe('UpdateStockConfigUseCase', () => {
  let useCase: UpdateStockConfigUseCase;
  let mockStockService: jest.Mocked<Pick<StockService, 'updateStockConfig'>>;

  beforeEach(() => {
    mockStockService = {
      updateStockConfig: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateStockConfigUseCase(mockStockService as unknown as StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delega la configuración completa y devuelve updated true', async () => {
    const result = await useCase.execute('prod-1', {
      trackStock: true,
      unitOfMeasure: UnitOfMeasure.KG,
      minStockAlert: 5,
    });

    expect(mockStockService.updateStockConfig).toHaveBeenCalledWith('prod-1', {
      trackStock: true,
      unitOfMeasure: UnitOfMeasure.KG,
      minStockAlert: 5,
    });
    expect(result).toEqual({ updated: true });
  });

  it('propaga campos parciales sin modificar', async () => {
    const result = await useCase.execute('prod-1', {
      trackStock: false,
      unitOfMeasure: null,
      minStockAlert: null,
    });

    expect(mockStockService.updateStockConfig).toHaveBeenCalledWith('prod-1', {
      trackStock: false,
      unitOfMeasure: null,
      minStockAlert: null,
    });
    expect(result).toEqual({ updated: true });
  });
});
