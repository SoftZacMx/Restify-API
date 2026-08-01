import { PaymentConfigService } from '../../../src/core/application/services/payment-config.service';
import { IBranchRepository } from '../../../src/core/domain/interfaces/branch-repository.interface';
import { PaymentConfig } from '../../../src/core/domain/types/payment-config.types';
import { Branch } from '../../../src/core/domain/entities/branch.entity';
import * as tenantContext from '../../../src/core/infrastructure/tenant/tenant-context';
import { encrypt, decrypt } from '../../../src/shared/utils/crypto.util';

describe('PaymentConfigService', () => {
  let service: PaymentConfigService;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let getBranchIdSpy: jest.SpyInstance;

  const branchId = 'branch-456';
  const organizationId = 'org-789';
  const config: PaymentConfig = {
    mercadoPago: {
      accessToken: 'TEST-123',
      webhookSecret: 'secret-456',
    },
  };

  function makeBranch(id: string, paymentConfig: string | null): Branch {
    return new Branch(
      id, organizationId, 'Sucursal', 'Jalisco', 'Guadalajara', 'Calle', '1',
      '555', null, null, null, null, null, paymentConfig,
      'America/Mexico_City', 'MXN', 'active', new Date(), new Date(), null
    );
  }

  beforeEach(() => {
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.MP_ACCESS_TOKEN = 'env-token';
    process.env.MP_WEBHOOK_SECRET = 'env-secret';

    mockBranchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    getBranchIdSpy = jest.spyOn(tenantContext, 'getBranchId');

    service = new PaymentConfigService(mockBranchRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.PAYMENT_CONFIG_ENCRYPTION_KEY;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_WEBHOOK_SECRET;
  });

  describe('get()', () => {
    it('devuelve la config del env cuando no hay branch context', async () => {
      getBranchIdSpy.mockReturnValue(undefined);

      const result = await service.get();

      expect(mockBranchRepository.findById).not.toHaveBeenCalled();
      expect(result).toEqual({
        mercadoPago: { accessToken: 'env-token', webhookSecret: 'env-secret' },
      });
    });

    it('desencripta la config del branch, la cachea y la devuelve', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockResolvedValue(
        makeBranch(branchId, encrypt(JSON.stringify(config)))
      );

      const first = await service.get();
      const second = await service.get();

      expect(mockBranchRepository.findById).toHaveBeenCalledTimes(1);
      expect(first).toEqual(config);
      expect(second).toEqual(config);
    });

    it('cae a la config del env cuando el branch no tiene paymentConfig', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockResolvedValue(makeBranch(branchId, null));

      const result = await service.get();

      expect(mockBranchRepository.findById).toHaveBeenCalledWith(branchId);
      expect(result).toEqual({
        mercadoPago: { accessToken: 'env-token', webhookSecret: 'env-secret' },
      });
    });
  });

  describe('getForCharging()', () => {
    it('falla sin branch context (nunca cobra con la cuenta del env)', async () => {
      getBranchIdSpy.mockReturnValue(undefined);

      await expect(service.getForCharging()).rejects.toMatchObject({
        code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
      });
      expect(mockBranchRepository.findById).not.toHaveBeenCalled();
    });

    it('falla cuando el branch no configuró su cuenta MP aunque el env tenga token', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockResolvedValue(makeBranch(branchId, null));

      await expect(service.getForCharging()).rejects.toMatchObject({
        code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
      });
    });

    it('devuelve la config del branch cuando está configurada y la cachea', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockResolvedValue(
        makeBranch(branchId, encrypt(JSON.stringify(config)))
      );

      const first = await service.getForCharging();
      const second = await service.getForCharging();

      expect(mockBranchRepository.findById).toHaveBeenCalledTimes(1);
      expect(first).toEqual(config);
      expect(second).toEqual(config);
    });
  });

  describe('save()', () => {
    it('falla sin branch context', async () => {
      getBranchIdSpy.mockReturnValue(undefined);

      await expect(service.save(config)).rejects.toThrow('Branch context not available');
    });

    it('falla si el branch no existe', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.save(config)).rejects.toThrow('Branch not found');
    });

    it('encripta la config, la guarda en el branch y la cachea', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockResolvedValue(makeBranch(branchId, null));
      mockBranchRepository.update.mockResolvedValue(makeBranch(branchId, ''));

      await service.save(config);

      expect(mockBranchRepository.update).toHaveBeenCalledTimes(1);
      const [updatedId, data] = mockBranchRepository.update.mock.calls[0];
      expect(updatedId).toBe(branchId);
      expect(data.paymentConfig).toEqual(expect.any(String));
      expect(JSON.parse(decrypt(data.paymentConfig!))).toEqual(config);

      const cached = await service.get();
      expect(cached).toEqual(config);
      expect(mockBranchRepository.findById).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache()', () => {
    it('con branchId elimina solo esa entrada', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockImplementation(async (id: string) =>
        makeBranch(id, encrypt(JSON.stringify(config)))
      );

      await service.getForCharging();
      await service.getForCharging();
      expect(mockBranchRepository.findById).toHaveBeenCalledTimes(1);

      service.clearCache(branchId);

      await service.getForCharging();
      expect(mockBranchRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('sin branchId limpia todo el caché', async () => {
      getBranchIdSpy.mockReturnValue(branchId);
      mockBranchRepository.findById.mockImplementation(async (id: string) =>
        makeBranch(id, encrypt(JSON.stringify(config)))
      );

      await service.getForCharging();
      service.clearCache();

      await service.getForCharging();
      expect(mockBranchRepository.findById).toHaveBeenCalledTimes(2);
    });
  });
});
