/**
 * HTML document used as the extension sandbox.
 *
 * Extensions are plain JavaScript evaluated inside a WebView (Hermes has no
 * `eval`). They receive a restricted `host` object: network access is bridged
 * back to the app so requests go through the cached/offline-aware transport and
 * are not subject to CORS. Everything else (DOMParser, fetch, timers) is the
 * WebView's normal environment, which makes HTML scrapers straightforward.
 */
export const EXTENSION_RUNNER_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body>
<script>
(function () {
  var source = null;
  var pendingHttp = {};
  var httpSeq = 0;

  function send(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  function errorText(error) {
    if (!error) return String(error);
    if (error.message) return error.name ? error.name + ': ' + error.message : String(error.message);
    return String(error);
  }

  function hostRequest(options) {
    return new Promise(function (resolve, reject) {
      var id = 'h' + ++httpSeq;
      pendingHttp[id] = { resolve: resolve, reject: reject };
      send({ type: 'http', id: id, request: options || {} });
    });
  }

  var host = {
    request: hostRequest,
    log: function (message) { send({ type: 'log', message: String(message) }); },
  };

  function load(code) {
    source = null;
    var registerSource = function (definition) { source = definition; };
    try {
      var factory = new Function('registerSource', 'host', code + '\\n//# sourceURL=extension.js');
      factory(registerSource, host);
      if (!source) {
        send({ type: 'loadError', error: 'Extension did not call registerSource(...)' });
        return;
      }
      send({
        type: 'loaded',
        manifest: {
          id: source.id,
          name: source.name,
          version: source.version,
          lang: source.lang || 'en',
          baseUrl: source.baseUrl,
          capabilities: source.capabilities,
          description: source.description,
          nsfw: source.nsfw,
        },
      });
    } catch (error) {
      send({ type: 'loadError', error: errorText(error) });
    }
  }

  function callSource(message) {
    try {
      if (!source) throw new Error('Extension is not loaded');
      var fn = source[message.method];
      if (typeof fn !== 'function') throw new Error('Extension has no method: ' + message.method);
      Promise.resolve(fn.apply(source, message.args || []))
        .then(function (result) {
          send({ type: 'result', id: message.id, ok: true, result: result === undefined ? null : result });
        })
        .catch(function (error) {
          send({ type: 'result', id: message.id, ok: false, error: errorText(error) });
        });
    } catch (error) {
      send({ type: 'result', id: message.id, ok: false, error: errorText(error) });
    }
  }

  function handle(raw) {
    var message;
    try { message = JSON.parse(raw); } catch (error) { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'load') { load(message.code); return; }
    if (message.type === 'call') { callSource(message); return; }
    if (message.type === 'httpResult') {
      var pending = pendingHttp[message.id];
      if (pending) { delete pendingHttp[message.id]; pending.resolve(message.response); }
      return;
    }
    if (message.type === 'httpError') {
      var failed = pendingHttp[message.id];
      if (failed) { delete pendingHttp[message.id]; failed.reject(new Error(message.error)); }
    }
  }

  function onMessage(handler) {
    document.addEventListener('message', function (event) { handler(event.data); });
    window.addEventListener('message', function (event) { handler(event.data); });
  }

  onMessage(handle);
  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
