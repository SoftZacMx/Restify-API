import {
  CreateFirstBranchUseCase,
  CreateFirstBranchInput,
} from '../../../../src/core/application/use-cases/branches/create-first-branch.use-case';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { Prisma } from '@prisma/client';

describe('CreateFirstBranchUseCase', () => {
  let useCase: CreateFirstBranchUseCase;
  let mockTx: any;

  beforeEach(() => {
    useCase = new CreateFirstBranchUseCase();
    mockTx = {
      branch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
  });

  describe('execute', () => {
    const validInput: CreateFirstBranchInput = {
      organizationId: 'org-123',
      name: 'Sucursal Principal',
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Reforma',
      exteriorNumber: '123',
      phone: '5512345678',
      rfc: 'ABC123456789',
      startOperations: '08:00',
      endOperations: '22:00',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
    };

    it('should create a branch with all provided data', async () => {
      const mockBranchData = {
        id: 'branch-123',
        ...validInput,
        logoUrl: null,
        status: 'ACTIVE',
        ticketConfig: null,
        paymentConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockTx.branch.create.mockResolvedValue(mockBranchData);

      const result = await useCase.execute(mockTx, validInput);

      expect(mockTx.branch.create).toHaveBeenCalledWith({
        data: {
          organizationId: validInput.organizationId,
          name: validInput.name,
          slug: 'sucursal-principal',
          state: validInput.state,
          city: validInput.city,
          street: validInput.street,
          exteriorNumber: validInput.exteriorNumber,
          phone: validInput.phone,
          rfc: validInput.rfc,
          logoUrl: null,
          startOperations: validInput.startOperations,
          endOperations: validInput.endOperations,
          timezone: validInput.timezone,
          currency: validInput.currency,
          status: 'ACTIVE',
          ticketConfig: Prisma.JsonNull,
          paymentConfig: null,
        },
      });

      expect(result).toBeInstanceOf(Branch);
      expect(result.id).toBe('branch-123');
      expect(result.name).toBe(validInput.name);
      expect(result.organizationId).toBe(validInput.organizationId);
    });

    it('should use default currency "MXN" when not provided', async () => {
      const inputWithoutCurrency: CreateFirstBranchInput = {
        ...validInput,
        currency: undefined,
      };

      const mockBranchData = {
        id: 'branch-123',
        ...inputWithoutCurrency,
        currency: 'MXN',
        logoUrl: null,
        status: 'ACTIVE',
        ticketConfig: null,
        paymentConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockTx.branch.create.mockResolvedValue(mockBranchData);

      await useCase.execute(mockTx, inputWithoutCurrency);

      expect(mockTx.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'MXN',
          }),
        })
      );
    });

    it('should set null for optional fields when not provided', async () => {
      const minimalInput: CreateFirstBranchInput = {
        organizationId: 'org-123',
        name: 'Sucursal Principal',
        state: 'CDMX',
        city: 'Ciudad de México',
        street: 'Reforma',
        exteriorNumber: '123',
        phone: '5512345678',
        timezone: 'America/Mexico_City',
      };

      const mockBranchData = {
        id: 'branch-123',
        ...minimalInput,
        rfc: null,
        logoUrl: null,
        startOperations: null,
        endOperations: null,
        currency: 'MXN',
        status: 'ACTIVE',
        ticketConfig: null,
        paymentConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockTx.branch.create.mockResolvedValue(mockBranchData);

      await useCase.execute(mockTx, minimalInput);

      expect(mockTx.branch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rfc: null,
          startOperations: null,
          endOperations: null,
        }),
      });
    });

    it('should always create branch with ACTIVE status', async () => {
      const mockBranchData = {
        id: 'branch-123',
        ...validInput,
        logoUrl: null,
        status: 'ACTIVE',
        ticketConfig: null,
        paymentConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockTx.branch.create.mockResolvedValue(mockBranchData);

      await useCase.execute(mockTx, validInput);

      expect(mockTx.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });
  });
});
