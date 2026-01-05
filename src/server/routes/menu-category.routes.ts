import { Router, Request, Response } from 'express';
import { createMenuCategoryHandler } from '../../handlers/menu-categories/create-menu-category.handler';
import { getMenuCategoryHandler } from '../../handlers/menu-categories/get-menu-category.handler';
import { listMenuCategoriesHandler } from '../../handlers/menu-categories/list-menu-categories.handler';
import { updateMenuCategoryHandler } from '../../handlers/menu-categories/update-menu-category.handler';
import { deleteMenuCategoryHandler } from '../../handlers/menu-categories/delete-menu-category.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';

const router = Router();

/**
 * POST /api/menu-categories
 * Create menu category endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createMenuCategoryHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create menu category route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the create menu category request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/menu-categories
 * List menu categories endpoint (with optional filters)
 * NOTE: This must come before /:category_id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listMenuCategoriesHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List menu categories route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list menu categories request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/menu-categories/:category_id
 * Get menu category by ID endpoint
 */
router.get('/:category_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { category_id: req.params.category_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getMenuCategoryHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get menu category route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get menu category request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/menu-categories/:category_id
 * Update menu category endpoint
 */
router.put('/:category_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { category_id: req.params.category_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateMenuCategoryHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update menu category route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update menu category request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/menu-categories/:category_id
 * Delete menu category endpoint
 */
router.delete('/:category_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { category_id: req.params.category_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteMenuCategoryHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete menu category route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete menu category request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

