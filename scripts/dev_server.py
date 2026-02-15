#!/usr/bin/env python3
"""
Local dev server with COOP/COEP headers for SharedArrayBuffer support.
Usage: python scripts/dev_server.py [port]
"""

import http.server
import sys
import os
import functools

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class COOPCOEPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

handler = functools.partial(COOPCOEPHandler, directory='.')
with http.server.HTTPServer(('', PORT), handler) as httpd:
    print(f'DocToMD dev server running at http://localhost:{PORT}')
    print('Press Ctrl+C to stop')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
