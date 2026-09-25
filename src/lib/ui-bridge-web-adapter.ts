import type {
  HTTPRequest,
  HTTPResponse,
  RequestHandler,
  ServerAdapter,
} from '@qontinui/ui-bridge-native';

/**
 * What `window.__uiBridgeNative` exposes while the adapter runs. Tooling that
 * drives the web build (a headless browser through the UI Bridge) calls it with
 * `page.evaluate`.
 *
 * The name is spelled only inside `__DEV__` blocks, never as a module-level
 * constant, so that no copy of it survives into a production bundle.
 */
export interface WebBridgeHandle {
  /**
   * Route one request through the app's own UI Bridge server. `path` may carry
   * a query string; `method` defaults to GET. Returns the raw response, whose
   * `body` is a JSON string, exactly as the native TCP adapter would send it.
   */
  handleRequest(
    request: Pick<HTTPRequest, 'path'> & Partial<Omit<HTTPRequest, 'path'>>,
  ): Promise<HTTPResponse>;
}

function splitQuery(target: string): { path: string; query: Record<string, string> } {
  const qIndex = target.indexOf('?');
  if (qIndex === -1) return { path: target, query: {} };
  return {
    path: target.slice(0, qIndex),
    query: Object.fromEntries(new URLSearchParams(target.slice(qIndex + 1))),
  };
}

/**
 * A UI Bridge server adapter for the web build. The browser can't listen on a
 * port, so instead of a socket this publishes the server's request handler on
 * `window`: the same handler the native TCP adapter routes to, so every
 * `/ui-bridge/*` route answers against the app's real registry.
 *
 * DEV ONLY. The handler hands every script on the page the app's actions. The
 * body of `start` is inside `if (__DEV__)`, which a production export compiles
 * away, so the published name is absent from a shipped bundle even if a caller
 * wired this adapter in by mistake. CI greps the export for it
 * (`scripts/check-web-export-has-no-control-surface.sh`).
 */
export function createWindowServerAdapter(): ServerAdapter {
  let running = false;

  return {
    async start(_port: number, handler: RequestHandler): Promise<void> {
      if (__DEV__) {
        const handle: WebBridgeHandle = {
          handleRequest(request) {
            const split = splitQuery(request.path);
            return handler({
              method: (request.method ?? 'GET').toUpperCase(),
              path: split.path,
              headers: request.headers ?? {},
              query: { ...split.query, ...request.query },
              body: request.body,
            });
          },
        };
        (globalThis as Record<string, unknown>)['__uiBridgeNative'] = handle;
        running = true;
      }
    },

    async stop(): Promise<void> {
      if (__DEV__) {
        delete (globalThis as Record<string, unknown>)['__uiBridgeNative'];
      }
      running = false;
    },

    isRunning(): boolean {
      return running;
    },
  };
}
