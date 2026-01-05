import { Router, Request, Response } from 'express';
import {
  createEmployeeSalaryPaymentHandler,
  getEmployeeSalaryPaymentHandler,
  listEmployeeSalaryPaymentsHandler,
  updateEmployeeSalaryPaymentHandler,
  deleteEmployeeSalaryPaymentHandler,
} from '../../handlers/employees-salaries';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);

// Employee Salary Payment routes
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createEmployeeSalaryPaymentHandler(
      event as any,
      context
    );
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create employee salary payment route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the employee salary payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// List must come before :employee_salary_payment_id
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listEmployeeSalaryPaymentsHandler(
      event as any,
      context
    );
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List employee salary payments route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message:
          'An error occurred processing the list employee salary payments request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get(
  '/:employee_salary_payment_id',
  async (req: Request, res: Response) => {
    try {
      const event = HttpToLambdaAdapter.convertRequest(req, {
        employee_salary_payment_id: req.params.employee_salary_payment_id,
      });
      const context = HttpToLambdaAdapter.createContext();
      const response = await getEmployeeSalaryPaymentHandler(
        event as any,
        context
      );
      HttpToLambdaAdapter.convertResponse(response, res);
    } catch (error) {
      console.error('Get employee salary payment route error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ROUTE_ERROR',
          message:
            'An error occurred processing the get employee salary payment request',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.put(
  '/:employee_salary_payment_id',
  async (req: Request, res: Response) => {
    try {
      const event = HttpToLambdaAdapter.convertRequest(req, {
        employee_salary_payment_id: req.params.employee_salary_payment_id,
      });
      const context = HttpToLambdaAdapter.createContext();
      const response = await updateEmployeeSalaryPaymentHandler(
        event as any,
        context
      );
      HttpToLambdaAdapter.convertResponse(response, res);
    } catch (error) {
      console.error('Update employee salary payment route error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ROUTE_ERROR',
          message:
            'An error occurred processing the update employee salary payment request',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.delete(
  '/:employee_salary_payment_id',
  async (req: Request, res: Response) => {
    try {
      const event = HttpToLambdaAdapter.convertRequest(req, {
        employee_salary_payment_id: req.params.employee_salary_payment_id,
      });
      const context = HttpToLambdaAdapter.createContext();
      const response = await deleteEmployeeSalaryPaymentHandler(
        event as any,
        context
      );
      HttpToLambdaAdapter.convertResponse(response, res);
    } catch (error) {
      console.error('Delete employee salary payment route error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ROUTE_ERROR',
          message:
            'An error occurred processing the delete employee salary payment request',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;

