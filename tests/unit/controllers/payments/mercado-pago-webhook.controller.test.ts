jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
  singleton: () => (target: any) => target,
  injectable: () => (target: any) => target,
  inject: () => () => undefined,
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { mercadoPagoWebhookController } from '../../../../src/controllers/payments/mercado-pago-webhook.controller';
import { ConfirmMercadoPagoPaymentUseCase } from '../../../../src/core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { WebSocketEventType } from '../../../../src/core/domain/interfaces/websocket-connection.interface';

const tsyringe = require('tsyringe');
const mockResolve = tsyringe.container.resolve as jest.Mock;

describe('mercadoPagoWebhookController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockResolve.mockReset();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('validación del payload', () => {
    it('responde received sin procesar cuando el type no es payment', async () => {
      mockReq = { body: { type: 'test' }, query: {} };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockResolve).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });

    it('responde received sin procesar cuando el payment no trae data.id', async () => {
      mockReq = { body: { type: 'payment', data: {} }, query: {} };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockResolve).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });
  });

  describe('confirmación de pago', () => {
    it('resuelve el use case y confirma el pago con branchId del query', async () => {
      const confirmExecute = jest.fn().mockResolvedValue({
        payment: { id: 'pay-1', orderId: null, status: 'SUCCEEDED', gatewayTransactionId: '123' },
      });
      mockResolve.mockReturnValueOnce({ execute: confirmExecute });
      mockReq = {
        body: { type: 'payment', action: 'payment.created', data: { id: 123 } },
        query: { branchId: 'branch-123' },
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockResolve).toHaveBeenCalledWith(ConfirmMercadoPagoPaymentUseCase);
      expect(confirmExecute).toHaveBeenCalledWith({
        mpPaymentId: 123,
        action: 'payment.created',
        branchId: 'branch-123',
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });

    it('no notifica por WebSocket cuando el pago no marca la orden como pagada', async () => {
      const confirmExecute = jest.fn().mockResolvedValue({
        payment: { id: 'pay-1', orderId: 'order-1', status: 'PENDING', gatewayTransactionId: '123' },
      });
      mockResolve.mockReturnValueOnce({ execute: confirmExecute });
      mockReq = {
        body: { type: 'payment', action: 'payment.updated', data: { id: 123 } },
        query: {},
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockResolve).not.toHaveBeenCalledWith('IOrderRepository');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });

    it('propaga el error al middleware cuando el use case falla', async () => {
      const error = new Error('boom');
      mockResolve.mockReturnValueOnce({
        execute: jest.fn().mockRejectedValue(error),
      });
      mockReq = {
        body: { type: 'payment', action: 'payment.created', data: { id: 123 } },
        query: {},
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('notificación WebSocket a la sucursal', () => {
    it('notifica ORDER_NEW_ONLINE (DELIVERY) al staff cuando la orden online se paga', async () => {
      const confirmExecute = jest.fn().mockResolvedValue({
        payment: { id: 'pay-1', orderId: 'order-1', status: 'SUCCEEDED', gatewayTransactionId: '123' },
        order: { id: 'order-1', status: true, paymentMethod: null },
      });
      const orderRepo = { findById: jest.fn().mockResolvedValue({ id: 'order-1', origin: 'online-delivery', customerName: 'Juan', total: 150, createdAt: new Date('2026-07-01T12:00:00Z'), branchId: 'branch-1' }) };
      const wsManager = { sendToStaffRoles: jest.fn() };
      mockResolve
        .mockReturnValueOnce({ execute: confirmExecute })
        .mockReturnValueOnce(orderRepo)
        .mockReturnValueOnce(wsManager);
      mockReq = {
        body: { type: 'payment', action: 'payment.created', data: { id: 123 } },
        query: { branchId: 'branch-123' },
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockResolve).toHaveBeenCalledWith('IOrderRepository');
      expect(mockResolve).toHaveBeenCalledWith('IWebSocketConnectionManager');
      expect(orderRepo.findById).toHaveBeenCalledWith('order-1');
      expect(wsManager.sendToStaffRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebSocketEventType.ORDER_NEW_ONLINE,
          data: expect.objectContaining({
            orderId: 'order-1',
            customerName: 'Juan',
            orderType: 'DELIVERY',
            total: 150,
          }),
          timestamp: expect.any(Date),
        }),
        { branchId: 'branch-1' }
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });

    it('usa orderType PICKUP para órdenes online-pickup', async () => {
      const confirmExecute = jest.fn().mockResolvedValue({
        payment: { id: 'pay-1', orderId: 'order-1', status: 'SUCCEEDED', gatewayTransactionId: '123' },
        order: { id: 'order-1', status: true, paymentMethod: null },
      });
      const orderRepo = { findById: jest.fn().mockResolvedValue({ id: 'order-1', origin: 'online-pickup', customerName: 'Ana', total: 90, createdAt: new Date(), branchId: null }) };
      const wsManager = { sendToStaffRoles: jest.fn() };
      mockResolve
        .mockReturnValueOnce({ execute: confirmExecute })
        .mockReturnValueOnce(orderRepo)
        .mockReturnValueOnce(wsManager);
      mockReq = {
        body: { type: 'payment', action: 'payment.created', data: { id: 123 } },
        query: {},
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      const message = wsManager.sendToStaffRoles.mock.calls[0][0];
      expect(message.data.orderType).toBe('PICKUP');
      expect(wsManager.sendToStaffRoles).toHaveBeenCalledWith(expect.anything(), undefined);
    });

    it('no notifica por WebSocket cuando la orden no es online', async () => {
      const confirmExecute = jest.fn().mockResolvedValue({
        payment: { id: 'pay-1', orderId: 'order-1', status: 'SUCCEEDED', gatewayTransactionId: '123' },
        order: { id: 'order-1', status: true, paymentMethod: null },
      });
      const orderRepo = { findById: jest.fn().mockResolvedValue({ id: 'order-1', origin: 'Local', customerName: null, total: 100, createdAt: new Date(), branchId: 'branch-1' }) };
      mockResolve
        .mockReturnValueOnce({ execute: confirmExecute })
        .mockReturnValueOnce(orderRepo);
      mockReq = {
        body: { type: 'payment', action: 'payment.created', data: { id: 123 } },
        query: {},
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(mockResolve).not.toHaveBeenCalledWith('IWebSocketConnectionManager');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });

    it('no rompe el webhook si falla la notificación WebSocket', async () => {
      const confirmExecute = jest.fn().mockResolvedValue({
        payment: { id: 'pay-1', orderId: 'order-1', status: 'SUCCEEDED', gatewayTransactionId: '123' },
        order: { id: 'order-1', status: true, paymentMethod: null },
      });
      const orderRepo = { findById: jest.fn().mockRejectedValue(new Error('db down')) };
      const wsManager = { sendToStaffRoles: jest.fn() };
      mockResolve
        .mockReturnValueOnce({ execute: confirmExecute })
        .mockReturnValueOnce(orderRepo)
        .mockReturnValueOnce(wsManager);
      mockReq = {
        body: { type: 'payment', action: 'payment.created', data: { id: 123 } },
        query: {},
      };

      await mercadoPagoWebhookController(mockReq, mockRes, mockNext);

      expect(wsManager.sendToStaffRoles).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { received: true } })
      );
    });
  });
});
