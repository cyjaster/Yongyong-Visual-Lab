import http.server
import socketserver
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            pass

class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Ignore client disconnect errors cleanly
        pass

if __name__ == '__main__':
    port = 8089
    server = ThreadingServer(('0.0.0.0', port), NoCacheHandler)
    sys.stderr.write(f"Serving HTTP on 0.0.0.0 port {port} (threading, no-cache) ...\n")
    sys.stderr.flush()
    server.serve_forever()
