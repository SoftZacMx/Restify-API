import { Router, Request, Response } from 'express';
import { createProductHandler } from '../../handlers/products/create-product.handler';
import { getProductHandler } from '../../handlers/products/get-product.handler';
import { listProductsHandler } from '../../handlers/products/list-products.handler';
import { updateProductHandler } from '../../handlers/products/update-product.handler';
import { deleteProductHandler } from '../../handlers/products/delete-product.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';

const router = Router();

/**
 * POST /api/products
 * Create product endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createProductHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create product route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the create product request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/products
 * List products endpoint (with optional filters)
 * NOTE: This must come before /:product_id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listProductsHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List products route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list products request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/products/:product_id
 * Get product by ID endpoint
 */
router.get('/:product_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { product_id: req.params.product_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getProductHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get product route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get product request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/products/:product_id
 * Update product endpoint
 */
router.put('/:product_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { product_id: req.params.product_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateProductHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update product route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update product request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/products/:product_id
 * Delete product endpoint
 */
router.delete('/:product_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { product_id: req.params.product_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteProductHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete product route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete product request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

