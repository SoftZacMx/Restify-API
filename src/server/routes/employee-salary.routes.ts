import { Router } from 'express';
import {
  createEmployeeSalaryPaymentController,
  getEmployeeSalaryPaymentController,
  listEmployeeSalaryPaymentsController,
  updateEmployeeSalaryPaymentController,
  deleteEmployeeSalaryPaymentController,
} from '../../controllers/employees-salaries';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createEmployeeSalaryPaymentSchema, getEmployeeSalaryPaymentSchema, listEmployeeSalaryPaymentsSchema, updateEmployeeSalaryPaymentSchema } from '../../core/application/dto/employee-salary-payment.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', zodValidator({ schema: createEmployeeSalaryPaymentSchema, source: 'body' }), createEmployeeSalaryPaymentController);
router.get('/', zodValidator({ schema: listEmployeeSalaryPaymentsSchema, source: 'query' }), listEmployeeSalaryPaymentsController);
router.get('/:employee_salary_payment_id', zodValidator({ schema: getEmployeeSalaryPaymentSchema, source: 'params' }), getEmployeeSalaryPaymentController);
router.put('/:employee_salary_payment_id', zodValidator({ schema: updateEmployeeSalaryPaymentSchema, source: 'body' }), updateEmployeeSalaryPaymentController);
router.delete('/:employee_salary_payment_id', zodValidator({ schema: getEmployeeSalaryPaymentSchema, source: 'params' }), deleteEmployeeSalaryPaymentController);

export default router;
