import { Router, Request, Response } from 'express';
import { loginHandler } from '../../handlers/auth/login.handler';
import { verifyUserHandler } from '../../handlers/auth/verify-user.handler';
import { setPasswordHandler } from '../../handlers/auth/set-password.handler';
import { logoutHandler } from '../../handlers/auth/logout.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * POST /api/auth/login/:rol
 * Login endpoint
 * Protected with rate limiting: 5 attempts per 15 minutes
 * Sets HttpOnly cookie with JWT token for secure authentication
 */
router.post('/login/:rol', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { rol: req.params.rol });
    const context = HttpToLambdaAdapter.createContext();
    // Middy handlers are invoked directly with event and context
    const response = await loginHandler(event as any, context);
    
    // Extract token from response body to set as HttpOnly cookie
    if (response && response.body) {
      try {
        const responseBody = JSON.parse(response.body);
        if (responseBody.success && responseBody.data?.token) {
          const token = responseBody.data.token;
          
          // Set HttpOnly cookie with token
          const isProduction = process.env.NODE_ENV === 'production';
          res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction, // Only send over HTTPS in production
            sameSite: 'strict', // CSRF protection
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/',
          });
        }
      } catch (parseError) {
        // If body parsing fails, continue with normal response
        console.warn('Failed to parse response body for cookie setting:', parseError);
      }
    }
    
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the login request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/auth/verify-user
 * Verify user endpoint
 * Protected with rate limiting: 3 attempts per 15 minutes (prevents email enumeration)
 */
router.post('/verify-user', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    // Middy handlers are invoked directly with event and context
    const response = await verifyUserHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Verify user route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the verify user request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/auth/set-password/:user_id
 * Set password endpoint
 * Protected with rate limiting: 3 attempts per 15 minutes
 */
router.post('/set-password/:user_id', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { user_id: req.params.user_id });
    const context = HttpToLambdaAdapter.createContext();
    // Middy handlers are invoked directly with event and context
    const response = await setPasswordHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Set password route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the set password request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint
 * Clears the HttpOnly cookie containing the JWT token
 * Follows Clean Architecture: Route -> Handler -> Use Case
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await logoutHandler(event as any, context);

    // Clear the token cookie (HTTP-specific concern, handled at route level)
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 0, // Immediately expire
      path: '/',
    });

    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Logout route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the logout request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

