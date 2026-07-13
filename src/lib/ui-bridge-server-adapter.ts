import TcpSocket from 'react-native-tcp-socket';
import type {
  HTTPRequest,
  HTTPResponse,
  RequestHandler,
  ServerAdapter,
} from '@qontinui/ui-bridge-native';

/**
 * A minimal HTTP/1.1 server adapter for UI Bridge, backed by
 * `react-native-tcp-socket` (already a native dep of this app). UI Bridge is
 * transport-agnostic: it hands us a `RequestHandler` and expects us to run a
 * server and route raw requests through it. We speak just enough HTTP to serve
 * the `/ui-bridge/*` control endpoints the Qontinui runner calls.
 *
 * One request per connection (we send `Connection: close`), which is all the
 * control API needs and keeps parsing simple and robust.
 */

const CRLF = '\r\n';

function parseRequest(raw: string): HTTPRequest | null {
  const headerEnd = raw.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null; // headers not fully received yet

  const head = raw.slice(0, headerEnd);
  const lines = head.split(CRLF);
  const [method = 'GET', target = '/'] = lines[0].split(' ');

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf(':');
    if (idx > 0) {
      headers[lines[i].slice(0, idx).trim().toLowerCase()] = lines[i].slice(idx + 1).trim();
    }
  }

  // Wait for the full body if a Content-Length was declared.
  const contentLength = Number(headers['content-length'] ?? 0);
  const bodyStart = headerEnd + 4;
  const body = raw.slice(bodyStart);
  if (body.length < contentLength) return null; // body not fully received yet

  const qIndex = target.indexOf('?');
  const path = qIndex === -1 ? target : target.slice(0, qIndex);
  const query: Record<string, string> = {};
  if (qIndex !== -1) {
    for (const pair of target.slice(qIndex + 1).split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const k = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
      const v = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1));
      query[k] = v;
    }
  }

  let parsedBody: unknown;
  const trimmed = body.slice(0, contentLength).trim();
  if (trimmed) {
    try {
      parsedBody = JSON.parse(trimmed);
    } catch {
      parsedBody = trimmed;
    }
  }

  return { method, path, headers, query, body: parsedBody };
}

function serializeResponse(res: HTTPResponse): string {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // The runner may call cross-origin; keep the control surface permissive.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Connection: 'close',
    ...res.headers,
  };
  const body = res.body ?? '';
  // Content-Length is in bytes; latin1 keeps one char per byte.
  headers['Content-Length'] = String(unescape(encodeURIComponent(body)).length);

  const statusText = STATUS_TEXT[res.status] ?? 'OK';
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join(CRLF);
  return `HTTP/1.1 ${res.status} ${statusText}${CRLF}${headerLines}${CRLF}${CRLF}${body}`;
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  204: 'No Content',
  400: 'Bad Request',
  404: 'Not Found',
  500: 'Internal Server Error',
};

export function createTcpServerAdapter(): ServerAdapter {
  let server: ReturnType<typeof TcpSocket.createServer> | null = null;
  let running = false;

  return {
    start(port: number, handler: RequestHandler): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server = TcpSocket.createServer((socket) => {
          let buffer = '';
          socket.on('data', (data) => {
            buffer += typeof data === 'string' ? data : data.toString('latin1');
            const request = parseRequest(buffer);
            if (!request) return; // keep buffering until the request is complete

            // `end(data)` writes the response THEN closes after it flushes.
            // (write()+destroy() can truncate the response mid-flush, which the
            // client sees as "connection closed unexpectedly".)
            const respond = (res: HTTPResponse) => {
              socket.end(serializeResponse(res));
            };

            // Answer CORS preflight without invoking the handler.
            if (request.method === 'OPTIONS') {
              respond({ status: 204, headers: {}, body: '' });
              return;
            }

            handler(request)
              .then(respond)
              .catch((err: unknown) =>
                respond({
                  status: 500,
                  headers: {},
                  body: JSON.stringify({ error: String(err) }),
                }),
              );
          });
          socket.on('error', () => socket.destroy());
        });

        server.on('error', (err) => {
          running = false;
          reject(err);
        });

        // 0.0.0.0 so `adb forward` / the runner can reach it from outside the app.
        server.listen({ port, host: '0.0.0.0' }, () => {
          running = true;
          resolve();
        });
      });
    },

    stop(): Promise<void> {
      return new Promise<void>((resolve) => {
        running = false;
        if (server) {
          server.close(() => resolve());
          server = null;
        } else {
          resolve();
        }
      });
    },

    isRunning(): boolean {
      return running;
    },
  };
}
