// packages/forge/src/index.ts
// ─────────────────────────────────────────────────────────────────────
// Public API barrel export for @forge/core.
// This is the ONLY entry point user code imports from.
// ─────────────────────────────────────────────────────────────────────

// ─── Polyfills (MUST be first) ───
import './polyfills.js';

// ─── Core ───
export { Application, Provider } from './core/Application.js';
export {
  HttpException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from './core/Application.js';

// ─── HTTP ───
export { Request, ValidationException } from './http/Request.js';
export { ForgeResponse, type CookieOptions } from './http/Response.js';
export type { Middleware, MiddlewareClass, NextFunction } from './http/Middleware.js';

// ─── Routing ───
export { Router } from './routing/Router.js';
export {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Head,
  Options,
  Middleware as MiddlewareDecorator,
} from './routing/decorators.js';

// ─── Container ───
export { Container, type Constructor, type Token } from './container/Container.js';
export { Injectable, type InjectableOptions } from './container/decorators.js';

// ─── Config ───
export { env } from './config/env.js';
export { defineConfig } from './config/defineConfig.js';
export { config, initConfig, getConfigManager } from './config/ConfigManager.js';

// ─── View ───
export { ViewEngine } from './view/ViewEngine.js';
