import { Router } from 'express';
import { getConfigController } from '../../controllers/config/get-config.controller';

const router = Router();

/**
 * GET /api/config
 * Public endpoint - returns app configuration
 * Used by frontend to determine feature flags (billing, etc.)
 */
router.get('/', getConfigController);

export default router;
