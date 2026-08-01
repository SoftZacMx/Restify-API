jest.mock('multer', () => {
  class MockMulterError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  const mockMiddleware = jest.fn();
  const multerMock = jest.fn(() => ({ single: jest.fn(() => mockMiddleware) }));
  (multerMock as any).memoryStorage = jest.fn(() => ({}));
  (multerMock as any).MulterError = MockMulterError;
  return multerMock;
});

import { uploadSingle } from '../../../src/server/middleware/upload.middleware';

const multerModule = require('multer');
const mockMiddleware = multerModule().single('file') as jest.Mock;
const { MulterError } = multerModule;

describe('uploadSingle', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('mapea LIMIT_FILE_SIZE a IMAGE_SIZE_EXCEEDS_LIMIT', () => {
    mockMiddleware.mockImplementation((req: any, res: any, cb: (err?: unknown) => void) => {
      cb(new MulterError('LIMIT_FILE_SIZE'));
    });

    uploadSingle({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'IMAGE_SIZE_EXCEEDS_LIMIT' }));
  });

  it('mapea otros MulterError a INVALID_IMAGE_TYPE', () => {
    mockMiddleware.mockImplementation((req: any, res: any, cb: (err?: unknown) => void) => {
      cb(new MulterError('UNEXPECTED_FIELD'));
    });

    uploadSingle({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_IMAGE_TYPE' }));
  });

  it('propaga errores no-Multer al next', () => {
    const boom = new Error('boom');
    mockMiddleware.mockImplementation((req: any, res: any, cb: (err?: unknown) => void) => {
      cb(boom);
    });

    uploadSingle({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('llama a next() sin error en un upload exitoso', () => {
    mockMiddleware.mockImplementation((req: any, res: any, cb: (err?: unknown) => void) => {
      cb();
    });

    uploadSingle({} as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
