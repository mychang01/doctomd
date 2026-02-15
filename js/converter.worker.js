/* ========================================
   DocToMD — Web Worker: Pyodide + MarkItDown
   ======================================== */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide = null;

async function initEngine() {
  try {
    postMessage({ type: 'init-progress', percent: 5, label: 'Loading Pyodide runtime…' });

    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
    });

    postMessage({ type: 'init-progress', percent: 25, label: 'Loading built-in packages…' });

    // Load Pyodide built-in compiled packages first (these have C extensions)
    await pyodide.loadPackage(['micropip', 'lxml']);

    postMessage({ type: 'init-progress', percent: 35, label: 'Stubbing native deps…' });

    // Stub modules that require native code unavailable in Pyodide
    await pyodide.runPythonAsync(`
import sys, types

def _make_stub(name):
    mod = types.ModuleType(name)
    mod.__version__ = '0.0.0'
    mod.__path__ = []
    sys.modules[name] = mod
    return mod

# --- onnxruntime stub ---
ort = _make_stub('onnxruntime')
class _InferenceSession:
    def __init__(self, *a, **kw): pass
    def run(self, *a, **kw): return []
ort.InferenceSession = _InferenceSession
ort.SessionOptions = type('SessionOptions', (), {'__init__': lambda s: None})
ort.GraphOptimizationLevel = type('GraphOptimizationLevel', (), {'ORT_ENABLE_ALL': 0})
_make_stub('onnxruntime.capi')
_make_stub('onnxruntime.capi._pybind_state')

# --- magika stub ---
magika_mod = _make_stub('magika')
class _MagikaOutput:
    def __init__(self):
        self.label = 'unknown'
        self.ct_label = 'unknown'
        self.score = 0.0
class _MagikaPrediction:
    def __init__(self):
        self.output = _MagikaOutput()
class _MagikaResult:
    def __init__(self):
        self.status = 'ok'
        self.output = _MagikaOutput()
        self.prediction = _MagikaPrediction()
class Magika:
    def identify_bytes(self, data):
        return _MagikaResult()
    def identify_stream(self, stream, **kwargs):
        return _MagikaResult()
magika_mod.Magika = Magika
_make_stub('magika.types')
_make_stub('magika.content_types')

# --- audio stubs ---
for n in ['speech_recognition', 'pydub', 'audioop', 'audioop_lts']:
    if n not in sys.modules:
        _make_stub(n)
`);

    postMessage({ type: 'init-progress', percent: 45, label: 'Installing Python packages…' });

    // Install pure Python deps manually, then markitdown with deps=False
    await pyodide.runPythonAsync(`
import micropip

# Core pure-Python dependencies of markitdown 0.1.4
await micropip.install([
    'beautifulsoup4',
    'charset-normalizer',
    'defusedxml',
    'markdownify',
    'requests',
], keep_going=True)
`);

    postMessage({ type: 'init-progress', percent: 65, label: 'Installing format plugins…' });

    await pyodide.runPythonAsync(`
import micropip

# Optional format-specific deps (all pure Python or Pyodide built-in)
await micropip.install([
    'mammoth',
    'pdfminer.six',
    'python-pptx',
    'openpyxl',
    'olefile',
], keep_going=True)
`);

    postMessage({ type: 'init-progress', percent: 80, label: 'Installing markitdown…' });

    await pyodide.runPythonAsync(`
import micropip
# Install markitdown itself without pulling deps (we already handled them)
await micropip.install('markitdown==0.1.4', deps=False)
`);

    postMessage({ type: 'init-progress', percent: 92, label: 'Verifying engine…' });

    // Diagnostic: check which modules are importable
    const diag = await pyodide.runPythonAsync(`
import json
_diag = {}
for _mod_name in ['markitdown', 'pdfminer', 'mammoth', 'pptx', 'openpyxl', 'olefile', 'bs4', 'markdownify']:
    try:
        __import__(_mod_name)
        _diag[_mod_name] = 'ok'
    except Exception as e:
        _diag[_mod_name] = str(e)
json.dumps(_diag)
`);
    console.log('[DocToMD] Module diagnostics:', diag);

    await pyodide.runPythonAsync(`
from markitdown import MarkItDown
_md = MarkItDown()
`);

    postMessage({ type: 'init-progress', percent: 100, label: 'Ready' });
    postMessage({ type: 'ready' });

  } catch (err) {
    postMessage({ type: 'error', error: 'Engine init failed: ' + err.message });
  }
}

async function convertFile(id, fileName, fileBytes) {
  try {
    postMessage({ type: 'convert-progress', id, percent: 10, label: 'Preparing…' });

    // Use a safe temp name to avoid issues with spaces/special chars
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
    const safeName = '_doctomd_' + id + ext;

    const uint8 = new Uint8Array(fileBytes);
    pyodide.FS.writeFile('/tmp/' + safeName, uint8);

    postMessage({ type: 'convert-progress', id, percent: 30, label: 'Converting…' });

    // Pass the path via a Python variable to avoid string escaping issues
    pyodide.globals.set('_convert_path', '/tmp/' + safeName);
    const result = await pyodide.runPythonAsync(`
import traceback as _tb
try:
    from markitdown import MarkItDown
    _converter = MarkItDown()
    _result = _converter.convert(_convert_path)
    _convert_out = _result.text_content if _result.text_content else ""
    _convert_err = ""
except Exception as _e:
    _convert_out = ""
    _convert_err = _tb.format_exc()
_convert_err or _convert_out
`);

    // Check if it was an error
    const errPrefix = 'Traceback (most recent call last)';
    if (result.startsWith(errPrefix)) {
      throw new Error(result);
    }

    // Cleanup
    try { pyodide.FS.unlink('/tmp/' + safeName); } catch (e) { /* ignore */ }

    postMessage({ type: 'convert-progress', id, percent: 100, label: 'Done' });
    postMessage({ type: 'result', id, fileName, markdown: result });

  } catch (err) {
    postMessage({ type: 'error', id, fileName, error: err.message });
  }
}

// Message handler
onmessage = async function(e) {
  const { type, id, fileName, fileBytes } = e.data;

  if (type === 'init') {
    await initEngine();
  } else if (type === 'convert') {
    await convertFile(id, fileName, fileBytes);
  }
};
