import { Router } from 'express';
import {
  createUserController,
  getUserController,
  listUsersController,
  updateUserController,
  deleteUserController,
  reactivateUserController,
  resetUserPasswordController,
} from '../../controllers/users';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createUserSchema, getUserSchema, listUsersSchema, updateUserSchema, deleteUserSchema, reactivateUserSchema, resetUserPasswordSchema } from '../../core/application/dto/user.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { MANAGER_AND_UP, OWNER_ADMIN } from '../../shared/constants/roles.constants';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize(...MANAGER_AND_UP));

router.post('/', zodValidator({ schema: createUserSchema, source: 'body' }), createUserController);
router.get('/', zodValidator({ schema: listUsersSchema, source: 'query' }), listUsersController);
router.patch('/:user_id/reactivate', zodValidator({ schema: reactivateUserSchema, source: 'params' }), reactivateUserController);
// Reset-password de empleados: solo OWNER/ADMIN (más restrictivo que el resto del módulo).
router.post('/:user_id/reset-password', AuthMiddleware.authorize(...OWNER_ADMIN), zodValidator({ schema: resetUserPasswordSchema, source: 'params' }), resetUserPasswordController);
router.get('/:user_id', zodValidator({ schema: getUserSchema, source: 'params' }), getUserController);
router.put('/:user_id', zodValidator({ schema: updateUserSchema, source: 'body' }), updateUserController);
router.delete('/:user_id', zodValidator({ schema: deleteUserSchema, source: 'params' }), deleteUserController);

export default router;
