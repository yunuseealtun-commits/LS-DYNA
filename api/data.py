import json
import os
import hashlib
from urllib.parse import urlparse
from http.server import BaseHTTPRequestHandler

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Database')
USER_DB = os.path.join(DB_DIR, 'users.json')

def get_db_path(query_string):
    from urllib.parse import parse_qs
    query_params = parse_qs(query_string)
    file_type = query_params.get('file', ['keywords'])[0]
        
    files = {
        'keywords': 'lsdyna_keywords.json',
        'mindmap': 'lsdyna_mindmap.json',
        'onenote': 'lsdyna_onenote.json'
    }
    
    filename = files.get(file_type, 'lsdyna_keywords.json')
    return os.path.join(DB_DIR, filename)

def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if parsed_url.path == '/api/data':
            target_db = get_db_path(parsed_url.query)
            if os.path.exists(target_db):
                with open(target_db, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b'{"error": "Database not found. Using defaults."}')
        else:
            self.wfile.write(json.dumps({"error": "Unknown endpoint"}).encode('utf-8'))

    def do_POST(self):
        parsed_url = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if parsed_url.path == '/api/data':
            target_db = get_db_path(parsed_url.query)
            try:
                json_data = json.loads(post_data.decode('utf-8'))
                if not os.path.exists(DB_DIR):
                    try:
                        os.makedirs(DB_DIR)
                    except OSError:
                        pass
                try:
                    with open(target_db, 'w', encoding='utf-8') as f:
                        json.dump(json_data, f, indent=4)
                    self.wfile.write(b'{"status": "success", "message": "Saved successfully"}')
                except OSError:
                    self.wfile.write(json.dumps({"error": "Vercel uses a read-only filesystem. Save is ignored.", "status": "ephemeral_success"}).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif parsed_url.path == '/api/auth/register':
            try:
                data = json.loads(post_data.decode('utf-8'))
                username = data.get('username')
                password = data.get('password')
                
                if not username or not password:
                    raise ValueError("Username and password are required.")
                
                users = {}
                if os.path.exists(USER_DB):
                    with open(USER_DB, 'r', encoding='utf-8') as f:
                        users = json.load(f)
                
                if username in users:
                    raise ValueError("Username already exists.")
                
                users[username] = hash_password(password)
                
                if not os.path.exists(DB_DIR):
                    try: os.makedirs(DB_DIR)
                    except: pass
                    
                try:
                    with open(USER_DB, 'w', encoding='utf-8') as f:
                        json.dump(users, f, indent=4)
                except OSError:
                    pass # Ignore on Vercel read-only FS
                    
                self.wfile.write(b'{"status": "success", "message": "User registered"}')
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif parsed_url.path == '/api/auth/login':
            try:
                data = json.loads(post_data.decode('utf-8'))
                username = data.get('username')
                password = data.get('password')
                
                users = {}
                if os.path.exists(USER_DB):
                    with open(USER_DB, 'r', encoding='utf-8') as f:
                        users = json.load(f)
                
                if username in users and users[username] == hash_password(password):
                    self.wfile.write(json.dumps({
                        "status": "success",
                        "username": username,
                        "token": f"session_{username}_{hash(username)}"
                    }).encode('utf-8'))
                else:
                    self.wfile.write(json.dumps({"error": "Invalid credentials", "status": "failed"}).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif parsed_url.path == '/api/drive/login':
            try:
                # Local Drive logic
                # Import dynamically to avoid crashing Vercel if google-auth doesn't exist
                import sys
                app_dir = os.path.join(os.path.dirname(DB_DIR), 'App')
                if app_dir not in sys.path:
                    sys.path.append(app_dir)
                try:
                    from google_drive import GoogleDriveManager
                    drive_manager = GoogleDriveManager(
                        credentials_path=os.path.join(app_dir, 'credentials.json'),
                        tokens_dir=os.path.join(app_dir, 'tokens')
                    )
                    drive_manager.authenticate()
                    
                    self.wfile.write(json.dumps({
                        "email": drive_manager.user_email,
                        "status": "authenticated"
                    }).encode('utf-8'))
                except ImportError:
                    self.wfile.write(json.dumps({"error": "Google API libraries are not installed in this environment. Please run the server locally."}).encode('utf-8'))
                except Exception as e:
                    self.wfile.write(json.dumps({"error": f"Google SSO failed. Ensure you are running locally and have credentials.json. Details: {e}"}).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif parsed_url.path == '/api/drive/sync':
            try:
                import sys
                app_dir = os.path.join(os.path.dirname(DB_DIR), 'App')
                if app_dir not in sys.path:
                    sys.path.append(app_dir)
                from google_drive import GoogleDriveManager
                drive_manager = GoogleDriveManager(
                    credentials_path=os.path.join(app_dir, 'credentials.json'),
                    tokens_dir=os.path.join(app_dir, 'tokens')
                )
                
                data = json.loads(post_data.decode('utf-8'))
                path_steps = data.get('path', [])
                content_html = data.get('content', '')
                user_email = data.get('email')
                
                if not path_steps:
                    raise ValueError("Missing 'path' in request body.")

                drive_manager.authenticate(user_email)
                result = drive_manager.sync_path_to_doc(path_steps, content_html)
                
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        else:
            self.wfile.write(json.dumps({"error": f"Endpoint not found: {parsed_url.path}"}).encode('utf-8'))
