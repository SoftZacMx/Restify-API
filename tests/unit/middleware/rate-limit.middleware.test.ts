jest.mock('express-rate-limit', () => {
  const mockRateLimit = jest.fn((config: any) => config);
  return mockRateLimit;
});

import {
  authRateLimiter,
  apiRateLimiter,
  passwordResetRateLimiter,
  publicMenuRateLimiter,
  publicOrderRateLimiter,
  publicStatusRateLimiter,
  mpWebhookRateLimiter,
} from '../../../src/server/middleware/rate-limit.middleware';

const rateLimit = require('express-rate-limit');

describe('rate-limit middleware', () => {
  it('configura los 7 rate limiters con windowMs y max esperados', () => {
    const configs = [
      { limiter: authRateLimiter, windowMs: 15 * 60 * 1000, max: 5 },
      { limiter: apiRateLimiter, windowMs: 1 * 60 * 1000, max: 100 },
      { limiter: passwordResetRateLimiter, windowMs: 15 * 60 * 1000, max: 3 },
      { limiter: publicMenuRateLimiter, windowMs: 1 * 60 * 1000, max: 30 },
      { limiter: publicOrderRateLimiter, windowMs: 1 * 60 * 1000, max: 5 },
      { limiter: publicStatusRateLimiter, windowMs: 1 * 60 * 1000, max: 60 },
      { limiter: mpWebhookRateLimiter, windowMs: 1 * 60 * 1000, max: 120 },
    ];

    for (const { limiter, windowMs, max } of configs) {
      const config: any = limiter;
      expect(config.windowMs).toBe(windowMs);
      expect(config.max).toBe(max);
      expect(config.standardHeaders).toBe(true);
      expect(config.legacyHeaders).toBe(false);
      expect(config.message).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
        })
      );
    }

    expect(rateLimit).toHaveBeenCalledTimes(7);
  });

  it('auth limiter no cuenta intentos exitosos (solo fallidos)', () => {
    expect((authRateLimiter as any).skipSuccessfulRequests).toBe(true);
    expect((authRateLimiter as any).skipFailedRequests).toBe(false);
  });
});
