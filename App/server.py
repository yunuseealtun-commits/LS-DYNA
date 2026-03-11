import json
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Database')
DB_FILE = os.path.join(DB_DIR, 'database.json')

if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

class KeywordManagerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow CORS if needed, and disable caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def get_db_path(self, qs):
        from urllib.parse import parse_qs
        parsed = parse_qs(qs)
        file_param = parsed.get('file', ['database'])[0]
        # Sanitize to prevent directory traversal
        clean_name = ''.join(c for c in file_param if c.isalnum() or c in ['_', '-'])
        if not clean_name:
            clean_name = 'database'
        return os.path.join(DB_DIR, f"{clean_name}.json")

    def do_GET(self):
        from urllib.parse import urlparse
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == '/api/data':
            target_db = self.get_db_path(parsed_url.query)
            if os.path.exists(target_db):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                with open(target_db, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "Database not found"}')
        else:
            super().do_GET()

    def do_POST(self):
        from urllib.parse import urlparse
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == '/api/data':
            target_db = self.get_db_path(parsed_url.query)
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Validate JSON before saving
                json_data = json.loads(post_data.decode('utf-8'))
                with open(target_db, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    port = 3001
    print(f"Starting server at http://localhost:{port}")
    server = HTTPServer(('localhost', port), KeywordManagerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()
