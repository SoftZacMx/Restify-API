import { UploadImageUseCase } from '../../../../src/core/application/use-cases/uploads/upload-image.use-case';
import { IFileStorage } from '../../../../src/core/domain/interfaces/file-storage.interface';
import { MAX_IMAGE_BYTES } from '../../../../src/core/application/dto/image.dto';
import { getBranchId } from '../../../../src/core/infrastructure/tenant/tenant-context';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
  getBranchId: jest.fn(() => 'branch-1'),
}));

describe('UploadImageUseCase', () => {
  let useCase: UploadImageUseCase;
  let fileStorage: jest.Mocked<IFileStorage>;

  beforeEach(() => {
    fileStorage = {
      upload: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new UploadImageUseCase(fileStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buffer = Buffer.from('fake-image-bytes');

  it('sube un logo de organización bajo organizations/{orgId}', async () => {
    fileStorage.upload.mockResolvedValue({ url: 'https://s3/x.png', key: 'organizations/org-1/logo.png' });

    const result = await useCase.execute({
      kind: 'org_logo',
      buffer,
      mimeType: 'image/png',
      size: 100,
    });

    expect(fileStorage.upload).toHaveBeenCalledWith(
      'organizations/org-1/logo.png',
      buffer,
      'image/png',
      'no-cache'
    );
    expect(result).toEqual({ url: 'https://s3/x.png', key: 'organizations/org-1/logo.png' });
  });

  it('sube un logo de sucursal bajo branches/{branchId}/logo.{ext}', async () => {
    fileStorage.upload.mockResolvedValue({ url: 'https://s3/x.jpg', key: 'branches/branch-1/logo.jpg' });

    const result = await useCase.execute({
      kind: 'branch_logo',
      buffer,
      mimeType: 'image/jpeg',
      size: 100,
    });

    expect(fileStorage.upload).toHaveBeenCalledWith(
      'branches/branch-1/logo.jpg',
      buffer,
      'image/jpeg',
      'no-cache'
    );
    expect(result.key).toBe('branches/branch-1/logo.jpg');
  });

  it('sube una imagen de producto con UUID aleatorio', async () => {
    fileStorage.upload.mockResolvedValue({ url: 'https://s3/x.png', key: 'k' });

    await useCase.execute({ kind: 'product_image', buffer, mimeType: 'image/png', size: 100 });

    const [key, , , cacheControl] = fileStorage.upload.mock.calls[0];
    expect(key).toMatch(/^branches\/branch-1\/products\/[0-9a-f-]+\.png$/);
    expect(cacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('sube una imagen de menú con UUID aleatorio', async () => {
    fileStorage.upload.mockResolvedValue({ url: 'https://s3/x.webp', key: 'k' });

    await useCase.execute({ kind: 'menu_item_image', buffer, mimeType: 'image/webp', size: 100 });

    const [key, , , cacheControl] = fileStorage.upload.mock.calls[0];
    expect(key).toMatch(/^branches\/branch-1\/menu-items\/[0-9a-f-]+\.webp$/);
    expect(cacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('rechaza MIME no permitido', async () => {
    await expect(
      useCase.execute({ kind: 'org_logo', buffer, mimeType: 'application/pdf', size: 100 })
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE_TYPE' });
    expect(fileStorage.upload).not.toHaveBeenCalled();
  });

  it('rechaza imágenes que exceden el tamaño máximo', async () => {
    await expect(
      useCase.execute({ kind: 'org_logo', buffer, mimeType: 'image/png', size: MAX_IMAGE_BYTES + 1 })
    ).rejects.toMatchObject({ code: 'IMAGE_SIZE_EXCEEDS_LIMIT' });
    expect(fileStorage.upload).not.toHaveBeenCalled();
  });

  it('rechaza imágenes de sucursal sin branch en el contexto', async () => {
    (getBranchId as jest.Mock).mockReturnValue(undefined);

    await expect(
      useCase.execute({ kind: 'branch_logo', buffer, mimeType: 'image/png', size: 100 })
    ).rejects.toMatchObject({ code: 'IMAGE_BRANCH_CONTEXT_REQUIRED' });
    expect(fileStorage.upload).not.toHaveBeenCalled();
  });
});
