import { Router } from 'express';
import {
  createUserController,
  getUserController,
  listUsersController,
  updateUserController,
  deleteUserController,
  reactivateUserController,
} from '../../controllers/users';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createUserSchema, getUserSchema, listUsersSchema, updateUserSchema, deleteUserSchema, reactivateUserSchema } from '../../core/application/dto/user.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN', 'MANAGER'));

router.post('/', zodValidator({ schema: createUserSchema, source: 'body' }), createUserController);
router.get('/', zodValidator({ schema: listUsersSchema, source: 'query' }), listUsersController);
router.patch('/:user_id/reactivate', zodValidator({ schema: reactivateUserSchema, source: 'params' }), reactivateUserController);
router.get('/:user_id', zodValidator({ schema: getUserSchema, source: 'params' }), getUserController);
router.put('/:user_id', zodValidator({ schema: updateUserSchema, source: 'body' }), updateUserController);
router.delete('/:user_id', zodValidator({ schema: deleteUserSchema, source: 'params' }), deleteUserController);

export default router;
