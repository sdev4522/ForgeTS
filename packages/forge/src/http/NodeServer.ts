// packages/forge/src/http/NodeServer.ts
// ─────────────────────────────────────────────────────────────────────
// Node.js HTTP server adapter.
// Bridges node:http (IncomingMessage / ServerResponse) to the Web Fetch
// API primitives (Request / Response) the framework is written against.
// ─────────────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';

export interface ConnectionInfo {
  /** Remote socket address of the client (never taken from request headers). */
  remoteAddress: string;
}

export type FetchHandler = (
  request: globalThis.Request,
  info: ConnectionInfo,
) => Promise<globalThis.Response> | globalThis.Response;

export interface NodeServerOptions {
  port: number;
  hostname?: string;
  /** Maximum accepted request body size in bytes. */
  maxBodySize?: number;
  fetch: FetchHandler;
  onError?: (error: unknown) => globalThis.Response;
}

export interface NodeServerHandle {
  server: Server;
  port: number;
  hostname: string;
  stop(): Promise<void>;
}

const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Start a node:http server that dispatches to a Fetch-style handler.
 * Resolves once the socket is listening; rejects on bind errors (EADDRINUSE).
 */
export function serve(options: NodeServerOptions): Promise<NodeServerHandle> {
  const hostname = options.hostname ?? '127.0.0.1';
  const maxBodySize = options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  const server = createServer((req, res) => {
    handle(req, res, options, maxBodySize).catch((err) => {
      try {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end('{"message":"Internal Server Error","statusCode":500}');
      } catch {
        res.destroy();
      }
      console.error('[ForgeTS] Unhandled server adapter error:', err);
    });
  });

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port, hostname, () => {
      server.off('error', reject);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      resolvePromise({
        server,
        port,
        hostname,
        stop: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  options: NodeServerOptions,
  maxBodySize: number,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();

  // Reject oversized bodies up front when the client declares a length
  const declaredLength = Number(req.headers['content-length'] ?? 0);
  if (declaredLength > maxBodySize) {
    res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8', Connection: 'close' });
    res.end('{"error":"Payload Too Large","statusCode":413}');
    return;
  }

  let response: globalThis.Response;
  try {
    const request = toWebRequest(req, method, maxBodySize);
    response = await options.fetch(request, {
      remoteAddress: req.socket.remoteAddress ?? '127.0.0.1',
    });
  } catch (err) {
    if ((err as any)?.code === 'ERR_FORGE_BODY_TOO_LARGE') {
      response = new globalThis.Response('{"error":"Payload Too Large","statusCode":413}', {
        status: 413,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    } else if (options.onError) {
      response = options.onError(err);
    } else {
      throw err;
    }
  }

  await writeWebResponse(res, response, method === 'HEAD');
}

function toWebRequest(req: IncomingMessage, method: string, maxBodySize: number): globalThis.Request {
  const host = req.headers.host ?? 'localhost';
  const encrypted = Boolean((req.socket as any).encrypted);
  const url = `${encrypted ? 'https' : 'http'}://${host}${req.url ?? '/'}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (!hasBody) {
    return new globalThis.Request(url, { method, headers });
  }

  // Enforce the body limit for chunked uploads that declare no length
  let received = 0;
  const limited = new Readable({
    read() {
      req.resume();
    },
  });
  req.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (received > maxBodySize) {
      const err = Object.assign(new Error('Request body too large'), {
        code: 'ERR_FORGE_BODY_TOO_LARGE',
      });
      limited.destroy(err);
      req.destroy();
      return;
    }
    if (!limited.push(chunk)) req.pause();
  });
  req.on('end', () => limited.push(null));
  req.on('error', (err) => limited.destroy(err));
  req.pause();

  return new globalThis.Request(url, {
    method,
    headers,
    body: Readable.toWeb(limited) as unknown as BodyInit,
    // @ts-expect-error — `duplex` is required by Node for streamed request bodies
    duplex: 'half',
  });
}

async function writeWebResponse(
  res: ServerResponse,
  response: globalThis.Response,
  isHead: boolean,
): Promise<void> {
  res.statusCode = response.status;

  const setCookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  if (setCookies.length > 0) {
    res.setHeader('Set-Cookie', setCookies);
  }

  if (isHead || !response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) {
        await new Promise<void>((r) => res.once('drain', () => r()));
      }
    }
    res.end();
  } catch (err) {
    res.destroy(err as Error);
  }
}

// ─── Static file responses ───

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
};

export function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Build a streaming Response for a file on disk.
 * Returns null when the path does not exist or is not a regular file.
 */
export async function fileResponse(
  filePath: string,
  extraHeaders: Record<string, string> = {},
): Promise<globalThis.Response | null> {
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return null;
  }
  if (!info.isFile()) return null;

  const body = Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit;
  return new globalThis.Response(body, {
    headers: {
      'Content-Type': mimeTypeFor(filePath),
      'Content-Length': String(info.size),
      'Last-Modified': info.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}
