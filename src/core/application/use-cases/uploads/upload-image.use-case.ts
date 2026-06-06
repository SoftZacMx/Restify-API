import { randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import {
  IFileStorage,
  UploadResult,
} from '../../../domain/interfaces/file-storage.interface';
import {
  ImageKind,
  MAX_IMAGE_BYTES,
  MIME_TO_EXTENSION,
  isAllowedImageMime,
} from '../../dto/image.dto';
import { getBranchId, getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { AppError } from '../../../../shared/errors';

/**
 * Transversal — Storage de imágenes (S3).
 *
 * Sube una imagen al storage y devuelve `{ url, key }`. La key se deriva del
 * `kind` + el contexto de tenant (org/branch), NUNCA del body, para garantizar
 * el aislamiento: un request solo puede escribir bajo el prefijo de su propia
 * organización/sucursal.
 */
export interface UploadImageCommand {
  kind: ImageKind;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

@injectable()
export class UploadImageUseCase {
  constructor(
    @inject('IFileStorage') private readonly fileStorage: IFileStorage
  ) {}

  async execute(input: UploadImageCommand): Promise<UploadResult> {
    if (!isAllowedImageMime(input.mimeType)) {
      throw new AppError('INVALID_IMAGE_TYPE');
    }

    if (input.size > MAX_IMAGE_BYTES) {
      throw new AppError('IMAGE_SIZE_EXCEEDS_LIMIT');
    }

    const key = this.buildKey(input.kind, input.mimeType);

    return this.fileStorage.upload(key, input.buffer, input.mimeType);
  }

  /**
   * Construye la key de S3 a partir del `kind` y el contexto de tenant.
   * El org/branch sale del contexto del request (no del body) para aislamiento.
   */
  private buildKey(kind: ImageKind, mimeType: string): string {
    const ext = MIME_TO_EXTENSION[mimeType as keyof typeof MIME_TO_EXTENSION];
    const organizationId = getOrganizationId();

    switch (kind) {
      case 'org_logo':
        return `organizations/${organizationId}/logo.${ext}`;
      case 'branch_logo':
        return `branches/${this.requireBranchId()}/logo.${ext}`;
      case 'product_image':
        return `branches/${this.requireBranchId()}/products/${randomUUID()}.${ext}`;
      case 'menu_item_image':
        return `branches/${this.requireBranchId()}/menu-items/${randomUUID()}.${ext}`;
    }
  }

  /**
   * Las imágenes a nivel sucursal exigen un branch en el contexto del JWT.
   * Sin branch → 400 (no se puede derivar un prefijo de key seguro).
   */
  private requireBranchId(): string {
    const branchId = getBranchId();
    if (!branchId) {
      throw new AppError('IMAGE_BRANCH_CONTEXT_REQUIRED');
    }
    return branchId;
  }
}
