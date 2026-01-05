import { Router, Request, Response } from 'express';
import { createMenuItemHandler } from '../../handlers/menu-items/create-menu-item.handler';
import { getMenuItemHandler } from '../../handlers/menu-items/get-menu-item.handler';
import { listMenuItemsHandler } from '../../handlers/menu-items/list-menu-items.handler';
import { updateMenuItemHandler } from '../../handlers/menu-items/update-menu-item.handler';
import { deleteMenuItemHandler } from '../../handlers/menu-items/delete-menu-item.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';

const router = Router();

/**
 * POST /api/menu-items
 * Create menu item endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createMenuItemHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create menu item route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the create menu item request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/menu-items
 * List menu items endpoint (with optional filters)
 * NOTE: This must come before /:menu_item_id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listMenuItemsHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List menu items route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list menu items request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/menu-items/:menu_item_id
 * Get menu item by ID endpoint
 */
router.get('/:menu_item_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { menu_item_id: req.params.menu_item_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getMenuItemHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get menu item route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get menu item request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/menu-items/:menu_item_id
 * Update menu item endpoint
 */
router.put('/:menu_item_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { menu_item_id: req.params.menu_item_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateMenuItemHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update menu item route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update menu item request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/menu-items/:menu_item_id
 * Delete menu item endpoint
 */
router.delete('/:menu_item_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { menu_item_id: req.params.menu_item_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteMenuItemHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete menu item route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete menu item request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

