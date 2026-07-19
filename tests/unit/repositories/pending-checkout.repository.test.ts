/// <reference types="jest" />

import { PendingCheckoutRepository } from '../../../src/core/infrastructure/database/repositories/pending-checkout.repository';
import { Prisma } from '@prisma/client';

const mockPrismaClient = {
  pendingCheckout: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Fila "raw" tal como la devuelve Prisma (Decimal para montos, Json para cart).
function makeRow(overrides: Record<string, any> = {}) {
  return {
    id: 'checkout-1',
    branchId: 'branch-1',
    status: 'WAITING',
    cart: [{ menuItemId: 'menu-1', quantity: 2 }],
    customerName: 'Ana',
    customerPhone: '5551112222',
    orderType: 'PICKUP',
    deliveryAddress: null,
    latitude: null,
    longitude: null,
    scheduledAt: null,
    total: new Prisma.Decimal(150.5),
    subtotal: new Prisma.Decimal(150.5),
    trackingToken: 'track-xyz',
    mpPreferenceId: null,
    paymentId: null,
    orderId: null,
    expiresAt: new Date('2026-07-19T12:05:00.000Z'),
    createdAt: new Date('2026-07-19T12:00:00.000Z'),
    ...overrides,
  };
}

describe('PendingCheckoutRepository', () => {
  let repository: PendingCheckoutRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PendingCheckoutRepository(mockPrismaClient as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return null when not found', async () => {
      mockPrismaClient.pendingCheckout.findUnique.mockResolvedValue(null);
      expect(await repository.findById('nope')).toBeNull();
    });

    it('should map Decimal total/subtotal to plain numbers and round-trip the cart', async () => {
      mockPrismaClient.pendingCheckout.findUnique.mockResolvedValue(makeRow());

      const result = await repository.findById('checkout-1');

      expect(mockPrismaClient.pendingCheckout.findUnique).toHaveBeenCalledWith({ where: { id: 'checkout-1' } });
      expect(result).not.toBeNull();
      expect(typeof result!.total).toBe('number');
      expect(result!.total).toBe(150.5);
      expect(typeof result!.subtotal).toBe('number');
      expect(result!.cart).toEqual([{ menuItemId: 'menu-1', quantity: 2 }]);
    });
  });

  describe('findByTrackingToken', () => {
    it('should query by trackingToken', async () => {
      mockPrismaClient.pendingCheckout.findUnique.mockResolvedValue(makeRow());

      const result = await repository.findByTrackingToken('track-xyz');

      expect(mockPrismaClient.pendingCheckout.findUnique).toHaveBeenCalledWith({ where: { trackingToken: 'track-xyz' } });
      expect(result!.trackingToken).toBe('track-xyz');
    });

    it('should return null when not found', async () => {
      mockPrismaClient.pendingCheckout.findUnique.mockResolvedValue(null);
      expect(await repository.findByTrackingToken('nope')).toBeNull();
    });
  });

  describe('create', () => {
    it('should persist the draft and return the domain object (status defaults via DB)', async () => {
      mockPrismaClient.pendingCheckout.create.mockResolvedValue(makeRow());

      const result = await repository.create({
        branchId: 'branch-1',
        cart: [{ menuItemId: 'menu-1', quantity: 2 }],
        customerName: 'Ana',
        customerPhone: '5551112222',
        orderType: 'PICKUP',
        total: 150.5,
        subtotal: 150.5,
        trackingToken: 'track-xyz',
        expiresAt: new Date('2026-07-19T12:05:00.000Z'),
      });

      const dataArg = mockPrismaClient.pendingCheckout.create.mock.calls[0][0].data;
      // create no envía status: se apoya en el default WAITING del schema.
      expect(dataArg.status).toBeUndefined();
      expect(dataArg.deliveryAddress).toBeNull();
      expect(result.status).toBe('WAITING');
      expect(result.id).toBe('checkout-1');
    });
  });

  describe('update', () => {
    it('should only send the provided fields', async () => {
      mockPrismaClient.pendingCheckout.update.mockResolvedValue(
        makeRow({ status: 'CONSUMED', orderId: 'order-9' })
      );

      const result = await repository.update('checkout-1', { status: 'CONSUMED', orderId: 'order-9' });

      expect(mockPrismaClient.pendingCheckout.update).toHaveBeenCalledWith({
        where: { id: 'checkout-1' },
        data: { status: 'CONSUMED', orderId: 'order-9' },
      });
      expect(result.status).toBe('CONSUMED');
      expect(result.orderId).toBe('order-9');
    });

    it('should allow clearing a nullable field explicitly', async () => {
      mockPrismaClient.pendingCheckout.update.mockResolvedValue(makeRow({ orderId: null }));

      await repository.update('checkout-1', { orderId: null });

      expect(mockPrismaClient.pendingCheckout.update).toHaveBeenCalledWith({
        where: { id: 'checkout-1' },
        data: { orderId: null },
      });
    });

    it('should not include undefined fields in the update payload', async () => {
      mockPrismaClient.pendingCheckout.update.mockResolvedValue(makeRow({ mpPreferenceId: 'pref-9' }));

      await repository.update('checkout-1', { mpPreferenceId: 'pref-9' });

      const dataArg = mockPrismaClient.pendingCheckout.update.mock.calls[0][0].data;
      expect(dataArg).toEqual({ mpPreferenceId: 'pref-9' });
      expect('status' in dataArg).toBe(false);
      expect('orderId' in dataArg).toBe(false);
    });
  });
});
