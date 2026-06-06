import { container } from 'tsyringe';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { IFileStorage } from '../../../domain/interfaces/file-storage.interface';
import { UploadImageUseCase } from '../../../application/use-cases/uploads/upload-image.use-case';

// Transversal — Storage de imágenes (S3). Singleton: un único cliente S3 en toda la app.
// Registrado bajo el token 'IFileStorage' para que los use-cases dependan del contrato.
container.registerSingleton<IFileStorage>('IFileStorage', S3FileStorage);

container.register(UploadImageUseCase, UploadImageUseCase);
