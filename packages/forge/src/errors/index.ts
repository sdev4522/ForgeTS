// packages/forge/src/errors/index.ts
// ─────────────────────────────────────────────────────────────────────
// Public API barrel export for ForgeTS Error Infrastructure subsystem.
// ─────────────────────────────────────────────────────────────────────

export {
  ForgeError,
  type ForgeErrorOptions,
  HttpError,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  UnprocessableEntityException,
  ServiceUnavailableException,
  InternalServerErrorException,
  ValidationError,
  ValidationException,
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
} from './ForgeError.js';

export { Redactor } from './Redactor.js';

export {
  SourceFrameReader,
  type StackFrame,
  type CodeSnippet,
  type CodeSnippetLine,
} from './SourceFrameReader.js';

export {
  ErrorNormalizer,
  type NormalizedError,
  type NormalizedCause,
  type NormalizedDiagnostic,
  type DiagnosticLocation,
} from './ErrorNormalizer.js';

export {
  ContextCollector,
  type ErrorContext,
  type RequestContext,
  type RouteContext,
  type EnvironmentContext,
} from './ContextCollector.js';

export { ContentNegotiator } from './ContentNegotiator.js';

export { HtmlErrorRenderer } from './renderers/HtmlErrorRenderer.js';
export {
  JsonErrorRenderer,
  type DevJsonErrorResponse,
  type ProdJsonErrorResponse,
} from './renderers/JsonErrorRenderer.js';
export { FallbackRenderer } from './renderers/FallbackRenderer.js';
