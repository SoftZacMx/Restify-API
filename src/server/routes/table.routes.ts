import { Router } from 'express';
import {
  createTableController,
  getTableController,
  listTablesController,
  updateTableController,
  deleteTableController,
} from '../../controllers/tables';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createTableSchema, getTableSchema, listTablesSchema, updateTableSchema, deleteTableSchema } from '../../core/application/dto/table.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', zodValidator({ schema: createTableSchema, source: 'body' }), createTableController);
router.get('/', zodValidator({ schema: listTablesSchema, source: 'query' }), listTablesController);
router.get('/:table_id', zodValidator({ schema: getTableSchema, source: 'params' }), getTableController);
router.put('/:table_id', zodValidator({ schema: updateTableSchema, source: 'body' }), updateTableController);
router.delete('/:table_id', zodValidator({ schema: deleteTableSchema, source: 'params' }), deleteTableController);

export default router;
