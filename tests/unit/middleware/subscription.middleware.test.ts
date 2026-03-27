/// <reference types="jest" />

// Mock tsyringe before any imports
jest.mock('tsyringe', () => {
  const mockFindFirst = jest.fn();
  return {
    container: {
      resolve: jest.fn().mockReturnValue({
        getClient: () => ({
          subscription: {
            findFirst: mockFindFirst,
          },
        }),
      }),
    },
    singleton: () => (target: any) => target,
    injectable: () => (target: any) => target,
    inject: () => () => undefined,
    __mockFindFirst: mockFindFirst,
  };
});

import { SubscriptionMiddleware } from '../../../src/server/middleware/subscription.middleware';

// Get the mock function
const tsyringe = require('tsyringe');
const mockFindFirst = tsyringe.__mockFindFirst;

describe('SubscriptionMiddleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    mockFindFirst.mockReset();
  });

  it('should call next() when subscription is active', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    });

    await SubscriptionMiddleware.validateSubscription(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should call next() when subscription is trialing', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'TRIALING',
      currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await SubscriptionMiddleware.validateSubscription(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 403 when no subscription exists', async () => {
    mockFindFirst.mockResolvedValue(null);

    await SubscriptionMiddleware.validateSubscription(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'SUBSCRIPTION_REQUIRED',
        }),
      })
    );
  });

  it('should return 403 when subscription is expired', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'EXPIRED',
      currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    await SubscriptionMiddleware.validateSubscription(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'SUBSCRIPTION_EXPIRED',
        }),
      })
    );
  });

  it('should allow access during grace period for PAST_DUE', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'PAST_DUE',
      currentPeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired 1 day ago
    });

    await SubscriptionMiddleware.validateSubscription(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should block access after grace period for PAST_DUE', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'PAST_DUE',
      currentPeriodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // expired 5 days ago
    });

    await SubscriptionMiddleware.validateSubscription(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });
});
