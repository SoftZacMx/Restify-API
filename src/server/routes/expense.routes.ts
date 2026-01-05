import { Router, Request, Response } from 'express';
import {
  createExpenseHandler,
  getExpenseHandler,
  listExpensesHandler,
  updateExpenseHandler,
  deleteExpenseHandler,
} from '../../handlers/expenses';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);

// Expenses routes
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createExpenseHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create expense route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the expense request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// List must come before :expense_id
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listExpensesHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List expenses route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list expenses request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:expense_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { expense_id: req.params.expense_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getExpenseHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get expense route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get expense request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.put('/:expense_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { expense_id: req.params.expense_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateExpenseHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update expense route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update expense request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.delete('/:expense_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { expense_id: req.params.expense_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteExpenseHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete expense route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete expense request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

