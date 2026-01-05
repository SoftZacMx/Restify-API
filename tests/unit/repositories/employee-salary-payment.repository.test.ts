/// <reference types="jest" />

import { EmployeeSalaryPaymentRepository } from '../../../src/core/infrastructure/database/repositories/employee-salary-payment.repository';
import { EmployeeSalaryPayment } from '../../../src/core/domain/entities/employee-salary-payment.entity';

// Mock Prisma Client
const mockPrismaClient = {
  employeeSalaryPayment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe('EmployeeSalaryPaymentRepository', () => {
  let repository: EmployeeSalaryPaymentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new EmployeeSalaryPaymentRepository(mockPrismaClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a payment when found by id', async () => {
      const mockPayment = {
        id: 'payment-123',
        userId: 'user-123',
        amount: 5000.0,
        paymentMethod: 1,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.employeeSalaryPayment.findUnique.mockResolvedValue(
        mockPayment
      );

      const result = await repository.findById('payment-123');

      expect(result).toBeInstanceOf(EmployeeSalaryPayment);
      expect(result?.id).toBe('payment-123');
      expect(result?.amount).toBe(5000.0);
      expect(
        mockPrismaClient.employeeSalaryPayment.findUnique
      ).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
      });
    });

    it('should return null if payment not found', async () => {
      mockPrismaClient.employeeSalaryPayment.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all payments without filters', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          userId: 'user-123',
          amount: 5000.0,
          paymentMethod: 1,
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'payment-2',
          userId: 'user-456',
          amount: 6000.0,
          paymentMethod: 2,
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.employeeSalaryPayment.findMany.mockResolvedValue(
        mockPayments
      );

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(EmployeeSalaryPayment);
      expect(result[1]).toBeInstanceOf(EmployeeSalaryPayment);
      expect(
        mockPrismaClient.employeeSalaryPayment.findMany
      ).toHaveBeenCalledWith({
        where: {},
        orderBy: { date: 'desc' },
      });
    });

    it('should filter by userId', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          userId: 'user-123',
          amount: 5000.0,
          paymentMethod: 1,
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.employeeSalaryPayment.findMany.mockResolvedValue(
        mockPayments
      );

      const result = await repository.findAll({ userId: 'user-123' });

      expect(result).toHaveLength(1);
      expect(
        mockPrismaClient.employeeSalaryPayment.findMany
      ).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { date: 'desc' },
      });
    });

    it('should filter by paymentMethod', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          userId: 'user-123',
          amount: 5000.0,
          paymentMethod: 1,
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.employeeSalaryPayment.findMany.mockResolvedValue(
        mockPayments
      );

      const result = await repository.findAll({ paymentMethod: 1 });

      expect(result).toHaveLength(1);
      expect(
        mockPrismaClient.employeeSalaryPayment.findMany
      ).toHaveBeenCalledWith({
        where: { paymentMethod: 1 },
        orderBy: { date: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');
      const mockPayments = [
        {
          id: 'payment-1',
          userId: 'user-123',
          amount: 5000.0,
          paymentMethod: 1,
          date: new Date('2024-06-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.employeeSalaryPayment.findMany.mockResolvedValue(
        mockPayments
      );

      const result = await repository.findAll({ dateFrom, dateTo });

      expect(result).toHaveLength(1);
      expect(
        mockPrismaClient.employeeSalaryPayment.findMany
      ).toHaveBeenCalledWith({
        where: {
          date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { date: 'desc' },
      });
    });

    it('should apply pagination', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          userId: 'user-123',
          amount: 5000.0,
          paymentMethod: 1,
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.employeeSalaryPayment.findMany.mockResolvedValue(
        mockPayments
      );

      const result = await repository.findAll(undefined, { skip: 0, take: 10 });

      expect(result).toHaveLength(1);
      expect(
        mockPrismaClient.employeeSalaryPayment.findMany
      ).toHaveBeenCalledWith({
        where: {},
        orderBy: { date: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('count', () => {
    it('should return count of all payments', async () => {
      mockPrismaClient.employeeSalaryPayment.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(result).toBe(5);
      expect(
        mockPrismaClient.employeeSalaryPayment.count
      ).toHaveBeenCalledWith({ where: {} });
    });

    it('should return count with filters', async () => {
      mockPrismaClient.employeeSalaryPayment.count.mockResolvedValue(2);

      const result = await repository.count({ userId: 'user-123' });

      expect(result).toBe(2);
      expect(
        mockPrismaClient.employeeSalaryPayment.count
      ).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
    });
  });

  describe('create', () => {
    it('should create a new payment', async () => {
      const mockCreatedPayment = {
        id: 'payment-123',
        userId: 'user-123',
        amount: 5000.0,
        paymentMethod: 1,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.employeeSalaryPayment.create.mockResolvedValue(
        mockCreatedPayment
      );

      const result = await repository.create({
        userId: 'user-123',
        amount: 5000.0,
        paymentMethod: 1,
        date: new Date(),
      });

      expect(result).toBeInstanceOf(EmployeeSalaryPayment);
      expect(result.id).toBe('payment-123');
      expect(result.amount).toBe(5000.0);
      expect(
        mockPrismaClient.employeeSalaryPayment.create
      ).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          amount: 5000.0,
          paymentMethod: 1,
          date: expect.any(Date),
        },
      });
    });
  });

  describe('update', () => {
    it('should update a payment', async () => {
      const mockUpdatedPayment = {
        id: 'payment-123',
        userId: 'user-123',
        amount: 6000.0,
        paymentMethod: 2,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.employeeSalaryPayment.update.mockResolvedValue(
        mockUpdatedPayment
      );

      const result = await repository.update('payment-123', {
        amount: 6000.0,
        paymentMethod: 2,
      });

      expect(result).toBeInstanceOf(EmployeeSalaryPayment);
      expect(result.amount).toBe(6000.0);
      expect(result.paymentMethod).toBe(2);
      expect(
        mockPrismaClient.employeeSalaryPayment.update
      ).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: {
          amount: 6000.0,
          paymentMethod: 2,
        },
      });
    });

    it('should update only provided fields', async () => {
      const mockUpdatedPayment = {
        id: 'payment-123',
        userId: 'user-123',
        amount: 6000.0,
        paymentMethod: 1,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.employeeSalaryPayment.update.mockResolvedValue(
        mockUpdatedPayment
      );

      const result = await repository.update('payment-123', {
        amount: 6000.0,
      });

      expect(result).toBeInstanceOf(EmployeeSalaryPayment);
      expect(
        mockPrismaClient.employeeSalaryPayment.update
      ).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: {
          amount: 6000.0,
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete a payment', async () => {
      mockPrismaClient.employeeSalaryPayment.delete.mockResolvedValue({
        id: 'payment-123',
      });

      await repository.delete('payment-123');

      expect(
        mockPrismaClient.employeeSalaryPayment.delete
      ).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
      });
    });
  });
});

