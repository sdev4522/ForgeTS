// packages/forge/src/index.ts
// ─────────────────────────────────────────────────────────────────────
// Public API barrel export for @forge/core.
// This is the ONLY entry point user code imports from.
// ─────────────────────────────────────────────────────────────────────

// ─── Polyfills (MUST be first) ───
import './polyfills.js';

// ─── Core ───
export { Application, Provider } from './core/Application.js';
export { now, today, ForgeDate, getTimezone } from './core/time.js';
export {
  HttpException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from './core/Application.js';

// ─── HTTP ───
export { Request, ValidationException } from './http/Request.js';
export { Validator, ValidationError, type ValidationRules } from './http/Validator.js';
export { ForgeResponse, isValidHttpStatus, normalizeHttpStatus, type CookieOptions } from './http/Response.js';
export { serializeViewData } from './http/serializer.js';
export { CsrfMiddleware } from './http/CsrfMiddleware.js';
export { RateLimiter, RateLimit, createRateLimitMiddleware } from './http/RateLimiter.js';
export { ErrorDisplayEngine } from './http/ErrorDisplayEngine.js';
export type { Middleware, MiddlewareClass, NextFunction } from './http/Middleware.js';

// ─── Errors & Diagnostics ───
export {
  ForgeError,
  type ForgeErrorOptions,
  HttpError,
  MethodNotAllowedException,
  ServiceUnavailableException,
  InternalServerErrorException,
  RoutingError,
  RouteNotFoundException,
  MethodNotAllowedError,
  ContainerError,
  BindingResolutionException,
  CircularDependencyException,
  DatabaseError,
  DatabaseConnectionException,
  QueryException,
  ModelNotFoundException,
  ViewError,
  ViewNotFoundException,
  ViewRenderException,
  ConfigurationError,
  ConfigurationException,
  AuthenticationError,
  AuthorizationError,
  Redactor,
  SourceFrameReader,
  type StackFrame,
  type CodeSnippet,
  type CodeSnippetLine,
  ErrorNormalizer,
  type NormalizedError,
  type NormalizedCause,
  type NormalizedDiagnostic,
  type DiagnosticLocation,
  ContextCollector,
  type ErrorContext,
  type RequestContext,
  type RouteContext,
  type EnvironmentContext,
  ContentNegotiator,
  HtmlErrorRenderer,
  JsonErrorRenderer,
  type DevJsonErrorResponse,
  type ProdJsonErrorResponse,
  FallbackRenderer,
} from './errors/index.js';

// ─── Security ───
export { Hash, hash } from './security/hash.js';

// ─── SSR & Vite ───
export { getViteDevServer, isViteAssetRequest } from './ssr/ViteDevServer.js';

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
export { bootstrapEnv, resetBootstrapEnv } from './config/bootstrapEnv.js';

// ─── View ───
export { ViewEngine } from './view/ViewEngine.js';

// ─── Events ───
export {
  EventDispatcher,
  events,
  getEventDispatcher,
  setEventDispatcher,
  type EventConstructor,
  type Listener,
  type ListenerClass,
  type ListenerFunction,
  type EventListenerClass,
} from './events/EventDispatcher.js';
