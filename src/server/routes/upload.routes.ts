import { Router } from 'express';
import { uploadImageController } from '../../controllers/uploads';
import { uploadSingle } from '../middleware/upload.middleware';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { uploadImageSchema } from '../../core/application/dto/image.dto';
import { TenantMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// Note: AuthMiddleware and TenantMiddleware are applied globally in routes/index.ts

// POST /api/uploads — sube una imagen (multipart/form-data: campo "file" + "kind").
// `uploadSingle` va ANTES del zodValidator: multer parsea el multipart y popula
// req.body.kind (que el validador valida) y req.file (el buffer del archivo).
//
// Multer parsea el stream de forma asíncrona, lo que rompe la propagación del
// AsyncLocalStorage del contexto de tenant establecido por el middleware global.
// Re-aplicamos TenantMiddleware.attach DESPUÉS de multer (lee `req.user` del JWT,
// que multer no toca) para que el use-case vea org/branch vía getOrganizationId().
router.post(
  '/',
  uploadSingle,
  TenantMiddleware.attach,
  zodValidator({ schema: uploadImageSchema, source: 'body' }),
  uploadImageController
);

export default router;
