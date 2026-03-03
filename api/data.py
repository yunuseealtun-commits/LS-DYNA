import json
import os
from http.server import BaseHTTPRequestHandler

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Database')
DB_FILE = os.path.join(DB_DIR, 'database.json')

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                self.wfile.write(f.read().encode('utf-8'))
        else:
            self.wfile.write(b'{"error": "Database not found. Using default keywords."}')

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        try:
            # Validate JSON
            json_data = json.loads(post_data.decode('utf-8'))
            
            # Vercel Serverless Functions have a Read-Only filesystem (except /tmp).
            # This save will only work locally. In production Vercel, this will throw an internal OSError.
            # We catch it so it doesn't crash completely, but data won't persist across requests.
            if not os.path.exists(DB_DIR):
                try:
                    os.makedirs(DB_DIR)
                except OSError:
                    pass
                    
            try:
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, indent=4)
                self.wfile.write(b'{"status": "success", "message": "Saved successfully (Locally only, Ephemeral on Vercel)"}')
            except OSError:
                self.wfile.write(json.dumps({"error": "Vercel uses a read-only filesystem. Save is ignored.", "status": "ephemeral_success"}).encode('utf-8'))
                
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
