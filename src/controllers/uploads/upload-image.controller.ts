import { Request } from 'express';
import { UploadImageUseCase } from '../../core/application/use-cases/uploads/upload-image.use-case';
import { makeController } from '../../shared/utils/make-controller';
import { AppError } from '../../shared/errors';

/**
 * Transversal — Storage de imágenes (S3).
 *
 * Mapea el request multipart al input del use-case: multer pone el archivo en
 * `req.file` (no en `req.body`), y `kind` viene como campo de texto del form.
 * Si no llegó archivo → `IMAGE_FILE_REQUIRED` (400).
 */
export const uploadImageController = makeController(UploadImageUseCase, {
  mapper: (req: Request) => {
    if (!req.file) {
      throw new AppError('IMAGE_FILE_REQUIRED');
    }
    return {
      kind: req.body.kind,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size,
    };
  },
});
