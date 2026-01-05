// Test setup file
import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local if it exists
const envLocalPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath });

// Mock environment variables for tests (use existing or set defaults)
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://restify_user:restify_password@localhost:3306/restify';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';
process.env.WEBSOCKET_CONNECTIONS_TABLE = process.env.WEBSOCKET_CONNECTIONS_TABLE || 'websocket-connections';

