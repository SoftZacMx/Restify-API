import { Router, Request, Response } from 'express';
import { createUserHandler } from '../../handlers/users/create-user.handler';
import { getUserHandler } from '../../handlers/users/get-user.handler';
import { listUsersHandler } from '../../handlers/users/list-users.handler';
import { updateUserHandler } from '../../handlers/users/update-user.handler';
import { deleteUserHandler } from '../../handlers/users/delete-user.handler';
import { reactivateUserHandler } from '../../handlers/users/reactivate-user.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';

const router = Router();

/**
 * POST /api/users
 * Create user endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createUserHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create user route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the create user request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/users
 * List users endpoint (with optional filters)
 * NOTE: This must come before /:user_id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listUsersHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List users route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list users request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PATCH /api/users/:user_id/reactivate
 * Reactivate user endpoint
 * NOTE: This must come before /:user_id route to avoid route conflicts
 */
router.patch('/:user_id/reactivate', async (req: Request, res: Response) => {
  try {
    console.log('Reactivate route hit:', req.params.user_id);
    const event = HttpToLambdaAdapter.convertRequest(req, { user_id: req.params.user_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await reactivateUserHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Reactivate user route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the reactivate user request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/users/:user_id
 * Get user by ID endpoint
 */
router.get('/:user_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { user_id: req.params.user_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getUserHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get user route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get user request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/users/:user_id
 * Update user endpoint
 */
router.put('/:user_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { user_id: req.params.user_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateUserHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update user route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update user request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/users/:user_id
 * Delete user endpoint
 */
router.delete('/:user_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { user_id: req.params.user_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteUserHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete user route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete user request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

