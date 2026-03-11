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
        from urllib.parse import parse_qs
        query_params = parse_qs(parsed_url.query)
        route = query_params.get('route', [None])[0]
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if route == 'drive_callback' or parsed_url.path == '/api/drive/callback':
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
                
                # Reconstruct full callback URL
                protocol = self.headers.get('x-forwarded-proto', 'http')
                host = self.headers.get('host', 'localhost:3001')
                full_url = f"{protocol}://{host}{self.path}"
                redirect_uri = f"{protocol}://{host}/api/drive/callback"
                if "vercel.app" in host:
                    redirect_uri = f"https://{host}/api/drive/callback"
                
                user_email, token_json = drive_manager.fetch_token(full_url, redirect_uri)
                
                # HTML response that posts message to opener window
                html = f"""
                <html>
                <head><title>Authentication Successful</title></head>
                <body>
                <script>
                    window.opener.postMessage({{
                        type: 'GOOGLE_AUTH_SUCCESS',
                        email: '{user_email}',
                        token: {json.dumps(token_json)}
                    }}, '*');
                    window.close();
                </script>
                <p>Authentication complete. You can close this window.</p>
                </body>
                </html>
                """
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(html.encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'text/html')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(f"Authentication failed: {e}".encode('utf-8'))
                
        elif parsed_url.path == '/api/data' and not route:
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
        from urllib.parse import parse_qs
        query_params = parse_qs(parsed_url.query)
        route = query_params.get('route', [None])[0]

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if route == 'register' or parsed_url.path == '/api/auth/register':
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
                
        elif route == 'login' or parsed_url.path == '/api/auth/login':
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
                
        elif route == 'drive_login' or parsed_url.path == '/api/drive/login':
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
                
                protocol = self.headers.get('x-forwarded-proto', 'http')
                host = self.headers.get('host', 'localhost:3001')
                redirect_uri = f"{protocol}://{host}/api/drive/callback"
                if "vercel.app" in host:
                    redirect_uri = f"https://{host}/api/drive/callback"
                
                auth_url = drive_manager.get_auth_url(redirect_uri)
                
                self.wfile.write(json.dumps({
                    "url": auth_url
                }).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif route == 'drive_sync' or parsed_url.path == '/api/drive/sync':
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
                token_json = data.get('googleToken')
                
                if not path_steps:
                    raise ValueError("Missing 'path' in request body.")

                drive_manager.authenticate(user_email, token_json)
                result = drive_manager.sync_path_to_doc(path_steps, content_html)
                
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif parsed_url.path == '/api/data':
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
                
        else:
            self.wfile.write(json.dumps({"error": f"Endpoint not found: {parsed_url.path}"}).encode('utf-8'))
