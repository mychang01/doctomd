# DocToMD

Convert documents to Markdown — entirely in your browser.

**[Try it live →](https://mychang01.github.io/doctomd/)**

![DocToMD Screenshot](https://img.shields.io/badge/status-live-brightgreen) ![No Server](https://img.shields.io/badge/backend-none-blue) ![License](https://img.shields.io/badge/license-MIT-yellow)

## What is this?

DocToMD is a free, open-source web tool that converts documents to clean Markdown. It runs **100% client-side** — your files never leave your browser. No uploads, no servers, no accounts.

Powered by [Microsoft MarkItDown](https://github.com/microsoft/markitdown) running on [Pyodide](https://pyodide.org) (Python in WebAssembly).

## Supported Formats

| Format | Extensions |
|--------|-----------|
| PDF | `.pdf` |
| Word | `.docx` |
| Excel | `.xlsx` |
| PowerPoint | `.pptx` |
| HTML | `.html`, `.htm` |
| CSV / TSV | `.csv`, `.tsv` |
| EPUB | `.epub` |
| Plain text | `.txt`, `.md`, `.rst`, `.json`, `.xml` |

## Features

- **Drag & drop** files or entire folders
- **Batch conversion** — process multiple files at once
- **Markdown preview** with syntax highlighting
- **One-click copy** to clipboard
- **Download** individual `.md` files or all as ZIP
- **Conversion history** saved in your browser (localStorage)
- **Mobile friendly** responsive design
- **Zero installation** — just open the URL

## How It Works

1. Open the site — the Python engine loads in the background (~10s on first visit)
2. Drop your files onto the page
3. Get clean Markdown output instantly
4. Copy, download, or preview the result

The entire conversion pipeline runs in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) using Pyodide, so the UI stays responsive even during heavy conversions.

## Privacy

Your files are processed **locally in your browser**. Nothing is sent to any server. You can verify this by checking the Network tab in DevTools — the only network requests are for loading the Pyodide runtime and Python packages on first visit.

## Local Development

```bash
python3 scripts/dev_server.py
# Open http://localhost:8080
```

The dev server adds `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers required for `SharedArrayBuffer` (which Pyodide needs). On GitHub Pages, this is handled by `coi-serviceworker.js`.

## Tech Stack

- [Pyodide](https://pyodide.org) — Python runtime compiled to WebAssembly
- [Microsoft MarkItDown](https://github.com/microsoft/markitdown) — document-to-Markdown conversion engine
- [marked.js](https://marked.js.org) — Markdown rendering
- [highlight.js](https://highlightjs.org) — syntax highlighting
- [JSZip](https://stuk.github.io/jszip/) — ZIP file generation
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) — COOP/COEP header injection for GitHub Pages

No build tools, no bundler, no npm — just plain HTML, CSS, and JavaScript.

## License

MIT
