import 'reflect-metadata';
import './core/infrastructure/config/dependency-injection';

// Export handlers
export { loginHandler } from './handlers/auth/login.handler';
export { verifyUserHandler } from './handlers/auth/verify-user.handler';
export { setPasswordHandler } from './handlers/auth/set-password.handler';
//Test
