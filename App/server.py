import json
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer
import sys
import hashlib

try:
    from google_drive import GoogleDriveManager
    drive_manager = GoogleDriveManager()
except ImportError:
    print("WARNING: Google Drive dependencies not found. Run 'pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib'")
    drive_manager = None

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Database')
DB_FILE = os.path.join(DB_DIR, 'database.json')
USER_DB = os.path.join(DB_DIR, 'users.json')

if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

if not os.path.exists(USER_DB):
    with open(USER_DB, 'w', encoding='utf-8') as f:
        json.dump({}, f)

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

    def hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()

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
        elif parsed_url.path == '/api/drive/login':
            if not drive_manager:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'{"error": "Google Drive manager not initialized."}')
                return
            
            try:
                # Trigger authentication flow
                # This will open a browser window on the server machine
                drive_manager.authenticate()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "email": drive_manager.user_email,
                    "status": "authenticated"
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif parsed_url.path == '/api/drive/sync':
            if not drive_manager:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b'{"error": "Google Drive manager not initialized."}')
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                path_steps = data.get('path', [])
                content_html = data.get('content', '')
                user_email = data.get('email')
                
                if not path_steps:
                    raise ValueError("Missing 'path' in request body.")

                # Use the provided email to load specific credentials
                drive_manager.authenticate(user_email)
                result = drive_manager.sync_path_to_doc(path_steps, content_html)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif parsed_url.path == '/api/auth/register':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                username = data.get('username')
                password = data.get('password')
                
                if not username or not password:
                    raise ValueError("Username and password are required.")
                
                with open(USER_DB, 'r', encoding='utf-8') as f:
                    users = json.load(f)
                
                if username in users:
                    raise ValueError("Username already exists.")
                
                users[username] = self.hash_password(password)
                
                with open(USER_DB, 'w', encoding='utf-8') as f:
                    json.dump(users, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success", "message": "User registered"}')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        
        elif parsed_url.path == '/api/auth/login':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                username = data.get('username')
                password = data.get('password')
                
                with open(USER_DB, 'r', encoding='utf-8') as f:
                    users = json.load(f)
                
                if username in users and users[username] == self.hash_password(password):
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "status": "success",
                        "username": username,
                        "token": f"session_{username}_{hash(username)}" # Dummy token
                    }).encode('utf-8'))
                else:
                    self.send_response(401)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Invalid credentials"}')
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
