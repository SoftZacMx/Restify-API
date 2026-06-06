import { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { MAX_IMAGE_BYTES } from '../../core/application/dto/image.dto';
import { AppError } from '../../shared/errors';

/**
 * Transversal — Storage de imágenes (S3).
 *
 * Multer en memoria: el archivo llega como Buffer en `req.file.buffer` (no se
 * escribe a disco), listo para que el use-case lo suba a S3. El límite de tamaño
 * corta el upload antes de llegar al controller.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
});

/**
 * Procesa un único archivo bajo el campo `file` de un `multipart/form-data`.
 *
 * Envuelve `multer.single` para traducir su `MulterError` al esquema de errores
 * de la app: `LIMIT_FILE_SIZE` → `IMAGE_SIZE_EXCEEDS_LIMIT` (413). El resto de
 * MulterErrors (campo inesperado, etc.) se mapean a `INVALID_IMAGE_TYPE` (400).
 */
export const uploadSingle = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('IMAGE_SIZE_EXCEEDS_LIMIT'));
      }
      return next(new AppError('INVALID_IMAGE_TYPE', err.message));
    }
    if (err) {
      return next(err);
    }
    next();
  });
};
