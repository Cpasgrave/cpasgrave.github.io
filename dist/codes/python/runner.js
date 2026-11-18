'use strict';

// Serialised into a Blob so the same worker works on GitHub Pages and in file previews.
function pythonWorker() {
  // This version supports classic Blob workers even when the page is opened via file://.
  const runtime = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
  const outputLimit = 48_000;

  self.addEventListener('message', async ({ data: { source, input, options } }) => {
    let buffer = '';
    let remaining = outputLimit;
    let truncated = false;
    let lastFlush = -Infinity;

    function flush() {
      if (buffer) self.postMessage({ type: 'output', text: buffer });
      buffer = '';
      lastFlush = performance.now();
    }

    function write(line) {
      if (!remaining) return;
      const text = `${line}\n`;
      buffer += text.slice(0, remaining);
      remaining = Math.max(0, remaining - text.length);
      if (!remaining) {
        truncated = true;
        buffer += '\n[Sortie tronquée]\n';
      }
      if (buffer.length >= 4096 || performance.now() - lastFlush >= 100) flush();
    }

    try {
      self.importScripts(`${runtime}pyodide.js`);
      const pyodide = await self.loadPyodide({ indexURL: runtime });
      if (options.packages?.length) await pyodide.loadPackage(options.packages);
      pyodide.FS.mkdir('/work');
      await Promise.all((options.files ?? []).map(async ({ name, text, url }) => {
        let content = text;
        if (url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Impossible de charger ${name} (HTTP ${response.status}).`);
          content = new Uint8Array(await response.arrayBuffer());
        }
        const path = `/work/${name}`;
        pyodide.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
        pyodide.FS.writeFile(path, content);
      }));

      pyodide.setStdout({ batched: write });
      pyodide.setStderr({ batched: write });
      pyodide.globals.set('_site_source', options.code ?? source);
      pyodide.globals.set('_site_filename', options.filename);
      pyodide.globals.set('_site_input', input);
      pyodide.globals.set('_site_urls', JSON.stringify(options.urls ?? {}));
      self.postMessage({ type: 'running' });

      pyodide.runPython(`
import io, json, os, sys

os.chdir('/work')
sys.path.insert(0, '/work')
sys.argv = [_site_filename]
sys.stdin = io.StringIO(_site_input)

_site_resource_paths = json.loads(_site_urls)
if _site_resource_paths:
    import urllib.request
    _site_urlopen = urllib.request.urlopen

    def _site_read_url(url, *args, **kwargs):
        if url in _site_resource_paths:
            return open(_site_resource_paths[url], 'rb')
        return _site_urlopen(url, *args, **kwargs)

    urllib.request.urlopen = _site_read_url

try:
    exec(compile(_site_source, _site_filename, 'exec'), {
        '__name__': '__main__',
        '__file__': os.path.join('/work', _site_filename),
    })
except SystemExit as exc:
    if exc.code not in (None, 0):
        raise RuntimeError(f'Le script a quitté avec le statut {exc.code}.') from None
finally:
    sys.stdout.flush()
    sys.stderr.flush()
`);
      flush();
      self.postMessage({ type: 'done', truncated });
    } catch (error) {
      flush();
      self.postMessage({ type: 'error', text: String(error.message ?? error) });
    }
  }, { once: true });
}

const form = document.querySelector('#python-console');
const run = document.querySelector('#python-run');
const stop = document.querySelector('#python-stop');
const status = document.querySelector('#python-status');
const output = document.querySelector('#python-output');
const input = document.querySelector('#python-input');
const options = JSON.parse(document.querySelector('#python-options').textContent);
const source = document.querySelector('#python-source').textContent;
let worker;
let workerURL;
let timer;

function finish(message) {
  clearTimeout(timer);
  worker?.terminate();
  if (workerURL) URL.revokeObjectURL(workerURL);
  worker = undefined;
  workerURL = undefined;
  status.textContent = message;
  run.disabled = false;
  stop.disabled = true;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (worker) return;
  output.textContent = '';
  status.textContent = 'Chargement de Python…';
  run.disabled = true;
  stop.disabled = false;

  try {
    const script = new Blob([`(${pythonWorker.toString()})();`], { type: 'text/javascript' });
    workerURL = URL.createObjectURL(script);
    worker = new Worker(workerURL);
    worker.addEventListener('message', (event) => {
      if (worker !== event.currentTarget) return;
      const { type, text, truncated } = event.data;
      if (type === 'output') {
        output.append(document.createTextNode(text));
      } else if (type === 'running') {
        clearTimeout(timer);
        status.textContent = 'Exécution en cours…';
      } else if (type === 'done') {
        finish(truncated ? 'Terminé. Sortie tronquée.' : output.textContent ? 'Terminé.' : 'Terminé, sans sortie.');
      } else if (type === 'error') {
        output.append(document.createTextNode(text));
        finish('Erreur pendant l’exécution.');
      }
    });
    worker.addEventListener('error', (event) => {
      if (worker === event.currentTarget) finish('Impossible de démarrer Python.');
    });
    timer = setTimeout(() => finish('Le chargement de Python a expiré.'), 75_000);
    const stdin = input?.value ?? '';
    worker.postMessage({ source, input: stdin ? `${stdin}\n` : '', options });
  } catch (error) {
    output.textContent = error.message;
    finish('Impossible de démarrer Python.');
  }
});

stop.addEventListener('click', () => finish('Exécution arrêtée.'));
window.addEventListener('pagehide', () => {
  if (worker) finish('Exécution arrêtée.');
});
run.disabled = false;
