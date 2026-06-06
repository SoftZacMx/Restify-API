import { z } from 'zod';

/**
 * Transversal — Storage de imágenes (S3).
 *
 * DTO de subida de imágenes. `kind` es el "selector de destino": indica qué tipo
 * de imagen se sube para que el use-case derive el prefijo de la key en S3. El
 * tenant (org/branch) NO sale de aquí, sale del contexto del request.
 */
export const uploadImageSchema = z.object({
  kind: z.enum(['branch_logo', 'org_logo', 'product_image', 'menu_item_image']),
});

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type ImageKind = UploadImageInput['kind'];

/** MIME types permitidos para imágenes. */
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

/** Tamaño máximo permitido por imagen (5MB). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Mapa MIME → extensión de archivo para construir la key. */
export const MIME_TO_EXTENSION: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Type guard: ¿el MIME recibido está permitido? */
export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime);
}
