import 'reflect-metadata';
import './core/infrastructure/config/dependency-injection';

// Export controllers
export { loginController } from './controllers/auth/login.controller';
export { verifyUserController } from './controllers/auth/verify-user.controller';
export { setPasswordController } from './controllers/auth/set-password.controller';
