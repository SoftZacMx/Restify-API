import { Router, Request, Response } from 'express';
import { createTableHandler } from '../../handlers/tables/create-table.handler';
import { getTableHandler } from '../../handlers/tables/get-table.handler';
import { listTablesHandler } from '../../handlers/tables/list-tables.handler';
import { updateTableHandler } from '../../handlers/tables/update-table.handler';
import { deleteTableHandler } from '../../handlers/tables/delete-table.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';

const router = Router();

/**
 * POST /api/tables
 * Create table endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createTableHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create table route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the create table request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/tables
 * List tables endpoint (with optional filters)
 * NOTE: This must come before /:table_id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listTablesHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List tables route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list tables request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/tables/:table_id
 * Get table by ID endpoint
 */
router.get('/:table_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { table_id: req.params.table_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getTableHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get table route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get table request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/tables/:table_id
 * Update table endpoint
 */
router.put('/:table_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { table_id: req.params.table_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateTableHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update table route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update table request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/tables/:table_id
 * Delete table endpoint
 */
router.delete('/:table_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { table_id: req.params.table_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteTableHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete table route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete table request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

