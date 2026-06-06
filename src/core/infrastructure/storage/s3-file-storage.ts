import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { injectable } from 'tsyringe';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/errors';
import { IFileStorage, UploadResult } from '../../domain/interfaces/file-storage.interface';

/**
 * Transversal — Storage de imágenes (S3).
 *
 * Implementación de `IFileStorage` sobre AWS S3 (LocalStack en dev/test vía
 * `AWS_ENDPOINT_URL`). Apagable con `S3_ENABLED`: cuando está deshabilitado es un
 * no-op que loggea y devuelve una URL/key derivadas, permitiendo correr dev/test
 * sin credenciales ni bucket real. Mismo patrón que `EmailService`.
 */
@injectable()
export class S3FileStorage implements IFileStorage {
  private readonly client: S3Client;
  private readonly enabled: boolean;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly endpoint?: string;

  constructor() {
    // Por defecto deshabilitado: requiere opt-in explícito con S3_ENABLED=true.
    this.enabled = process.env.S3_ENABLED === 'true';
    this.bucket = process.env.S3_BUCKET_NAME || 'restify-uploads';
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || undefined;
    // Endpoint/credenciales propios de S3 (MinIO en dev) con fallback a los AWS
    // genéricos. En dev S3 vive en MinIO (:9000), separado de LocalStack (:4566)
    // que sigue sirviendo SQS/SES/DynamoDB. En prod basta con dejar S3_* sin setear
    // y reusa los AWS_* (o S3 real con endpoint undefined).
    this.endpoint = process.env.S3_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL || undefined;

    const region = process.env.AWS_REGION || 'us-east-1';

    this.client = new S3Client({
      region,
      endpoint: this.endpoint, // Endpoint para MinIO/LocalStack, undefined para AWS real
      forcePathStyle: !!this.endpoint, // MinIO/LocalStack requieren path-style addressing
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey:
          process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
    });
  }

  /**
   * Sube un archivo a S3. Si `S3_ENABLED` no es 'true', no sube nada y solo loggea
   * (no-op), devolviendo la key y una URL derivada para no romper los flujos.
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<UploadResult> {
    if (!this.enabled) {
      logger.info({ key, contentType }, '[S3] S3_ENABLED=false → archivo no subido (no-op)');
      return { key, url: this.buildUrl(key) };
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.client.send(command);
      logger.info({ key, contentType }, '[S3] Archivo subido a S3');

      return { key, url: this.buildUrl(key) };
    } catch (error) {
      logger.error({ err: error, key, contentType }, '[S3] Error subiendo archivo a S3');
      throw new AppError('IMAGE_UPLOAD_FAILED');
    }
  }

  /**
   * Elimina un archivo de S3 por su key. No-op si `S3_ENABLED` no es 'true'.
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      logger.info({ key }, '[S3] S3_ENABLED=false → archivo no eliminado (no-op)');
      return;
    }

    try {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.client.send(command);
      logger.info({ key }, '[S3] Archivo eliminado de S3');
    } catch (error) {
      logger.error({ err: error, key }, '[S3] Error eliminando archivo de S3');
      throw new AppError('IMAGE_UPLOAD_FAILED');
    }
  }

  /**
   * Construye la URL pública del objeto. Usa `S3_PUBLIC_BASE_URL` si está definida;
   * en su defecto la deriva del endpoint (LocalStack) o del esquema estándar de S3.
   */
  private buildUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    }
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
