/**
 * Storage de archivos (imágenes) — contrato de dominio.
 *
 * Abstrae el proveedor concreto (S3) para que los use-cases no dependan de él
 * directamente, igual que el resto de repositorios. La implementación vive en
 * `infrastructure/storage/` y se registra en DI bajo el token 'IFileStorage'.
 */
export interface UploadResult {
  /** URL pública del archivo subido. */
  url: string;
  /** Key (ruta) del objeto dentro del bucket, p.ej. `branches/{branchId}/logo.webp`. */
  key: string;
}

export interface IFileStorage {
  /**
   * Sube un archivo al storage.
   * @param key Ruta destino dentro del bucket (incluye prefijo de tenant).
   * @param body Contenido binario del archivo.
   * @param contentType MIME type (p.ej. `image/webp`).
   */
  upload(key: string, body: Buffer, contentType: string): Promise<UploadResult>;

  /**
   * Elimina un archivo del storage por su key. No falla si no existe.
   */
  delete(key: string): Promise<void>;
}
