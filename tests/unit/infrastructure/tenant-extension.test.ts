import {
  createTenantExtension,
} from '../../../src/core/infrastructure/database/prisma/tenant-extension';
import { runWithTenant, withoutTenant, getTenant } from '../../../src/core/infrastructure/tenant/tenant-context';

describe('createTenantExtension — filtrado por tenant', () => {
  const mockClient = { $extends: jest.fn((config: any) => config) } as any;
  const extension = createTenantExtension(mockClient) as any;
  const handlers = extension.query.$allModels as Record<string, any>;

  const organizationId = 'org-1';
  const branchId = 'branch-1';

  async function runOp(op: string, model: string, args: any, store?: { organizationId: string; branchId?: string }) {
    const query = jest.fn().mockResolvedValue('QUERY_RESULT');
    const exec = () => handlers[op]({ model, args, query });
    const result = store
      ? await runWithTenant(store, () => exec())
      : await exec();
    return { result, query };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('routing', () => {
    it('sin contexto, un modelo global no se filtra', async () => {
      const { query } = await runOp('findMany', 'Organization', { where: { status: false } });

      expect(query).toHaveBeenCalledWith({ where: { status: false } });
    });

    it('sin contexto, un modelo con dueño lanza TENANT_CONTEXT_MISSING', async () => {
      await expect(
        handlers.findMany({ model: 'Order', args: { where: {} }, query: jest.fn() })
      ).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
    });

    it('withoutTenant desactiva el filtro (bypass explícito)', async () => {
      const query = jest.fn().mockResolvedValue('QUERY_RESULT');
      await withoutTenant(() =>
        handlers.findMany({ model: 'Order', args: { where: { status: false } }, query })
      );

      expect(query).toHaveBeenCalledWith({ where: { status: false } });
    });

    it('modelos globales no se filtran aunque haya tenant', async () => {
      const { query } = await runOp('findMany', 'Organization', { where: {} }, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ where: {} });
    });

    it('modelo org-level aplica filtro de organización', async () => {
      const { query } = await runOp('findMany', 'User', { where: {} }, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ where: { organizationId } });
    });

    it('modelo branch-level exige branchId y lo aplica', async () => {
      const { query } = await runOp('findMany', 'Order', { where: {} }, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ where: { branchId } });
    });

    it('modelo branch-level sin branchId lanza TENANT_BRANCH_REQUIRED', async () => {
      await expect(
        runWithTenant({ organizationId }, () => handlers.findMany({
          model: 'Order',
          args: { where: {} },
          query: jest.fn(),
        }))
      ).rejects.toThrow(/TENANT_BRANCH_REQUIRED/);
    });

    it('modelo no clasificado lanza TENANT_MODEL_UNCLASSIFIED (falla-seguro)', async () => {
      await expect(
        runWithTenant({ organizationId, branchId }, () => handlers.findMany({
          model: 'ModeloNuevo',
          args: { where: {} },
          query: jest.fn(),
        }))
      ).rejects.toThrow(/TENANT_MODEL_UNCLASSIFIED/);
    });
  });

  describe('filtro org-level', () => {
    it('create inyecta organizationId en data', async () => {
      const { query } = await runOp('create', 'User', { data: { name: 'a' } }, { organizationId });

      expect(query).toHaveBeenCalledWith({ data: { name: 'a', organizationId } });
    });

    it('createMany inyecta organizationId en cada item', async () => {
      const { query } = await runOp(
        'createMany',
        'User',
        { data: [{ name: 'a' }, { name: 'b' }] },
        { organizationId }
      );

      expect(query).toHaveBeenCalledWith({
        data: [{ name: 'a', organizationId }, { name: 'b', organizationId }],
      });
    });

    it('findUnique devuelve el registro cuando pertenece a la org', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'u1', organizationId });
      const result = await runWithTenant({ organizationId }, () =>
        handlers.findUnique({ model: 'User', args: { where: { id: 'u1' } }, query })
      );

      expect(result).toEqual({ id: 'u1', organizationId });
    });

    it('findUnique devuelve null si el registro es de otra org', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'u1', organizationId: 'org-otra' });
      const result = await runWithTenant({ organizationId }, () =>
        handlers.findUnique({ model: 'User', args: { where: { id: 'u1' } }, query })
      );

      expect(result).toBeNull();
    });

    it('findUnique devuelve null cuando no existe', async () => {
      const query = jest.fn().mockResolvedValue(null);
      const result = await runWithTenant({ organizationId }, () =>
        handlers.findUnique({ model: 'User', args: { where: { id: 'nope' } }, query })
      );

      expect(result).toBeNull();
    });

    it('findUniqueOrThrow devuelve null si es de otra org (evita IDOR)', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'u1', organizationId: 'org-otra' });
      const result = await runWithTenant({ organizationId }, () =>
        handlers.findUniqueOrThrow({ model: 'User', args: { where: { id: 'u1' } }, query })
      );

      expect(result).toBeNull();
    });

    it('update agrega organizationId al where con AND', async () => {
      const { query } = await runOp(
        'update',
        'User',
        { where: { id: 'u1' }, data: { name: 'b' } },
        { organizationId }
      );

      expect(query).toHaveBeenCalledWith({
        where: { id: 'u1', AND: [{ organizationId }] },
        data: { name: 'b' },
      });
    });

    it('delete y upsert agregan organizationId con AND', async () => {
      const deleteRun = await runOp('delete', 'User', { where: { id: 'u1' } }, { organizationId });
      const upsertRun = await runOp(
        'upsert',
        'User',
        { where: { id: 'u1' }, create: { name: 'a' }, update: { name: 'b' } },
        { organizationId }
      );

      expect(deleteRun.query).toHaveBeenCalledWith({ where: { id: 'u1', AND: [{ organizationId }] } });
      expect(upsertRun.query).toHaveBeenCalledWith({
        where: { id: 'u1', AND: [{ organizationId }] },
        create: { name: 'a' },
        update: { name: 'b' },
      });
    });

    it('findMany/findFirst/findFirstOrThrow/count/aggregate/groupBy agregan organizationId al where', async () => {
      for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']) {
        const { query } = await runOp(op, 'User', { where: {} }, { organizationId });
        expect(query).toHaveBeenCalledWith({ where: { organizationId } });
      }
    });
  });

  describe('filtro branch-level', () => {
    it('create inyecta branchId en data', async () => {
      const { query } = await runOp('create', 'Order', { data: { total: 100 } }, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ data: { total: 100, branchId } });
    });

    it('createMany inyecta branchId en cada item', async () => {
      const { query } = await runOp(
        'createMany',
        'Order',
        { data: [{ total: 100 }, { total: 50 }] },
        { organizationId, branchId }
      );

      expect(query).toHaveBeenCalledWith({
        data: [{ total: 100, branchId }, { total: 50, branchId }],
      });
    });

    it('findUnique devuelve el registro cuando pertenece al branch', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'o1', branchId });
      const result = await runWithTenant({ organizationId, branchId }, () =>
        handlers.findUnique({ model: 'Order', args: { where: { id: 'o1' } }, query })
      );

      expect(result).toEqual({ id: 'o1', branchId });
    });

    it('findUnique devuelve null si el registro es de otro branch', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'o1', branchId: 'branch-otra' });
      const result = await runWithTenant({ organizationId, branchId }, () =>
        handlers.findUnique({ model: 'Order', args: { where: { id: 'o1' } }, query })
      );

      expect(result).toBeNull();
    });

    it('findUniqueOrThrow devuelve null si es de otro branch', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'o1', branchId: 'branch-otra' });
      const result = await runWithTenant({ organizationId, branchId }, () =>
        handlers.findUniqueOrThrow({ model: 'Order', args: { where: { id: 'o1' } }, query })
      );

      expect(result).toBeNull();
    });

    it('update/delete/upsert agregan branchId al where con AND', async () => {
      const updateRun = await runOp(
        'update',
        'Order',
        { where: { id: 'o1' }, data: { total: 200 } },
        { organizationId, branchId }
      );
      const deleteRun = await runOp('delete', 'Order', { where: { id: 'o1' } }, { organizationId, branchId });

      expect(updateRun.query).toHaveBeenCalledWith({
        where: { id: 'o1', AND: [{ branchId }] },
        data: { total: 200 },
      });
      expect(deleteRun.query).toHaveBeenCalledWith({ where: { id: 'o1', AND: [{ branchId }] } });
    });

    it('findMany/findFirst/findFirstOrThrow/count/updateMany/deleteMany agregan branchId al where', async () => {
      for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'updateMany', 'deleteMany', 'aggregate', 'groupBy']) {
        const { query } = await runOp(op, 'Order', { where: {} }, { organizationId, branchId });
        expect(query).toHaveBeenCalledWith({ where: { branchId } });
      }
    });

    it('findUnique devuelve null cuando el registro no existe', async () => {
      const query = jest.fn().mockResolvedValue(null);
      const result = await runWithTenant({ organizationId, branchId }, () =>
        handlers.findUnique({ model: 'Order', args: { where: { id: 'nope' } }, query })
      );

      expect(result).toBeNull();
    });
  });

  describe('filtros con args parciales (defensivos)', () => {
    it('org create sin data inyecta organizationId', async () => {
      const { query } = await runOp('create', 'User', {}, { organizationId });

      expect(query).toHaveBeenCalledWith({ data: { organizationId } });
    });

    it('org createMany sin data no rompe', async () => {
      const { query } = await runOp('createMany', 'User', {}, { organizationId });

      expect(query).toHaveBeenCalledWith({ data: [] });
    });

    it('org update sin where agrega AND con organizationId', async () => {
      const { query } = await runOp('update', 'User', { data: { name: 'b' } }, { organizationId });

      expect(query).toHaveBeenCalledWith({ where: { AND: [{ organizationId }] }, data: { name: 'b' } });
    });

    it('org findMany sin where agrega organizationId', async () => {
      const { query } = await runOp('findMany', 'User', {}, { organizationId });

      expect(query).toHaveBeenCalledWith({ where: { organizationId } });
    });

    it('branch create sin data inyecta branchId', async () => {
      const { query } = await runOp('create', 'Order', {}, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ data: { branchId } });
    });

    it('branch createMany sin data no rompe', async () => {
      const { query } = await runOp('createMany', 'Order', {}, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ data: [] });
    });

    it('branch update sin where agrega AND con branchId', async () => {
      const { query } = await runOp('update', 'Order', { data: { total: 1 } }, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ where: { AND: [{ branchId }] }, data: { total: 1 } });
    });

    it('branch findMany sin where agrega branchId', async () => {
      const { query } = await runOp('findMany', 'Order', {}, { organizationId, branchId });

      expect(query).toHaveBeenCalledWith({ where: { branchId } });
    });
  });
});
