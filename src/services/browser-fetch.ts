/**
 * Thin-browser fetch channel. Providers that are protected by bot challenges
 * (Cloudflare, etc.) can load a URL in a real hidden WebView so the challenge's
 * JavaScript runs and the resulting DOM can be read back. The service is a thin
 * indirection; `BrowserHost` owns the actual WebView.
 */

export type BrowserFetchRequest = {
  url: string;
  /** Wait until this CSS selector exists before returning the DOM. */
  waitForSelector?: string;
  /** Maximum time to wait for the page to settle. Defaults to 30s. */
  timeoutMs?: number;
  /** Extra quiet time after readiness before reading the DOM. Defaults to 250ms. */
  settleMs?: number;
  /**
   * JavaScript expression evaluated inside the loaded page once it is ready.
   * Its resolved value is returned as `result` instead of the page HTML. It
   * lets a provider use the page's own session to call same-origin endpoints
   * that a plain request cannot reach.
   */
  evaluate?: string;
};

export type BrowserFetchResult = {
  url: string;
  html: string;
  /** Result of the `evaluate` expression, when one was supplied. */
  result?: string;
};

export type BrowserFetcher = (request: BrowserFetchRequest) => Promise<BrowserFetchResult>;

let fetcher: BrowserFetcher | null = null;

export function setBrowserFetcher(next: BrowserFetcher | null): void {
  fetcher = next;
}

export function browserFetchAvailable(): boolean {
  return fetcher !== null;
}

export function browserFetch(request: BrowserFetchRequest): Promise<BrowserFetchResult> {
  if (!fetcher) {
    return Promise.reject(new Error('Browser fetch is unavailable'));
  }
  return fetcher(request);
}

export type BrowserPageMessage = {
  type: 'page';
  id: string;
  url: string;
  html: string;
  ready: boolean;
  /** Result of an evaluated expression, when one was requested. */
  result?: string;
};

/** Parses a message posted back by the readiness script. */
export function parseBrowserPageMessage(raw: string): BrowserPageMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.type !== 'page') return null;
  if (typeof message.id !== 'string') return null;
  return {
    type: 'page',
    id: message.id,
    url: typeof message.url === 'string' ? message.url : '',
    html: typeof message.html === 'string' ? message.html : '',
    ready: message.ready === true,
    ...(typeof message.result === 'string' ? { result: message.result } : {}),
  };
}

/**
 * Builds the injected script that polls the document until the challenge is
 * gone (or `waitForSelector` appears) and posts the outer HTML back to the host.
 * Kept pure so the readiness heuristics are unit-testable.
 */
export function buildReadinessScript(params: {
  id: string;
  waitForSelector?: string;
  timeoutMs: number;
  settleMs: number;
  evaluate?: string;
}): string {
  const id = JSON.stringify(params.id);
  const selector = JSON.stringify(params.waitForSelector ?? '');
  const timeoutMs = Math.max(0, Math.floor(params.timeoutMs));
  const settleMs = Math.max(0, Math.floor(params.settleMs));
  const evaluate = params.evaluate ? JSON.stringify(params.evaluate) : 'null';

  return `(function(){
  var ID = ${id};
  var SEL = ${selector};
  var EVAL = ${evaluate};
  var DEADLINE = Date.now() + ${timeoutMs};
  var SETTLE = ${settleMs};
  var EVENTS = ['pointerdown', 'mousedown', 'mouseup', 'click'];
  function post(ready, result){
    try {
      var payload = {
        type: 'page', id: ID, url: location.href,
        html: document.documentElement ? document.documentElement.outerHTML : '',
        ready: !!ready
      };
      if (result !== undefined && result !== null) payload.result = String(result);
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (e) {}
  }
  function challenged(){
    var t = (document.title || '').toLowerCase();
    if (t.indexOf('just a moment') >= 0 || t.indexOf('attention required') >= 0) return true;
    if (document.querySelector('#challenge-running, #challenge-stage, #cf-please-wait, .cf-turnstile')) return true;
    if (document.querySelector('iframe[src*="challenges.cloudflare.com"]')) return true;
    return false;
  }
  // An interactive challenge renders a "verify you are human" checkbox
  // inside a cross-origin frame. A click on the frame is forwarded into it,
  // so a synthetic click at the checkbox position is enough to answer it.
  function solveInteractive(){
    var frames = document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]');
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      var box = frame.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) continue;
      var x = box.left + 30;
      var y = box.top + Math.min(30, box.height / 2);
      var target = document.elementFromPoint(x, y) || frame;
      for (var k = 0; k < EVENTS.length; k++) {
        var event = new MouseEvent(EVENTS[k], {
          bubbles: true, cancelable: true, view: window,
          clientX: x, clientY: y, button: 0, detail: 1
        });
        target.dispatchEvent(event);
      }
      return true;
    }
    return false;
  }
  function ready(){
    if (challenged()) return false;
    if (SEL && !document.querySelector(SEL)) return false;
    if (!document.body) return false;
    if (document.body.innerText.replace(/\\s+/g, '').length === 0) return false;
    return true;
  }
  function run(){
    if (!EVAL) { post(true); return; }
    var value;
    try {
      value = (0, eval)(EVAL);
    } catch (e) {
      post(false);
      return;
    }
    if (value && typeof value.then === 'function') {
      value.then(function(resolved){ post(true, resolved); }, function(){ post(false); });
      return;
    }
    post(true, value);
  }
  function tick(){
    if (ready()) { setTimeout(run, SETTLE); return; }
    if (Date.now() >= DEADLINE) { post(false); return; }
    solveInteractive();
    setTimeout(tick, 400);
  }
  setTimeout(tick, 250);
})();
true;`;
}
