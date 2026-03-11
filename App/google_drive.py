import os.path
import json
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

class GoogleDriveManager:
    def __init__(self, credentials_path='credentials.json', tokens_dir='tokens'):
        self.credentials_path = credentials_path
        self.tokens_dir = tokens_dir
        self.service = None
        self.docs_service = None
        self.user_email = None

        if os.environ.get('VERCEL') == '1' or not os.path.exists(self.tokens_dir):
            try:
                os.makedirs(self.tokens_dir, exist_ok=True)
            except OSError:
                self.tokens_dir = '/tmp/tokens'
                try: os.makedirs(self.tokens_dir, exist_ok=True)
                except: pass

    def get_token_path(self, email=None):
        if not email:
            return os.path.join(self.tokens_dir, 'default_token.json')
        return os.path.join(self.tokens_dir, f"{email}.json")

    def get_client_config(self):
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
        if client_id and client_secret:
            return {
                "web": {
                    "client_id": client_id,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_secret": client_secret,
                }
            }
        
        if not os.path.exists(self.credentials_path):
            raise FileNotFoundError(f"Missing {self.credentials_path} or Environment Variables. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.")
            
        with open(self.credentials_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_auth_url(self, redirect_uri):
        client_config = self.get_client_config()
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        return auth_url

    def fetch_token(self, authorization_response_url, redirect_uri):
        client_config = self.get_client_config()
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        # Fetch token using the full callback URL containing the code
        flow.fetch_token(authorization_response=authorization_response_url)
        creds = flow.credentials
        
        # Identify the user
        user_info_service = build('oauth2', 'v2', credentials=creds)
        user_info = user_info_service.userinfo().get().execute()
        self.user_email = user_info.get('email')
        
        # Save token locally or to temp folder for the current active request
        actual_token_path = self.get_token_path(self.user_email)
        try:
            with open(actual_token_path, 'w', encoding='utf-8') as token:
                token.write(creds.to_json())
        except OSError:
            pass
            
        return self.user_email, json.loads(creds.to_json())
        
    def authenticate(self, email=None, token_json=None):
        token_path = self.get_token_path(email)
        creds = None
        
        # Priority to provided token JSON
        if token_json:
            creds = Credentials.from_authorized_user_info(token_json, SCOPES)
        elif os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
            
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                client_config = self.get_client_config()
                client_id = client_config.get('web', client_config.get('installed', {})).get('client_id')
                client_secret = client_config.get('web', client_config.get('installed', {})).get('client_secret')
                creds.client_id = client_id
                creds.client_secret = client_secret
                creds.refresh(Request())
            else:
                raise Exception("Token expired and could not be refreshed. Please re-authenticate via Google SSO.")

        self.user_email = email
        self.service = build('drive', 'v3', credentials=creds)
        self.docs_service = build('docs', 'v1', credentials=creds)
        return self.service

    def get_or_create_folder(self, name, parent_id=None):
        """Finds or creates a folder by name under a parent."""
        query = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if parent_id:
            query += f" and '{parent_id}' in parents"
        
        results = self.service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = results.get('files', [])

        if files:
            return files[0]['id']
        
        file_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id:
            file_metadata['parents'] = [parent_id]
        
        folder = self.service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')

    def get_or_create_doc(self, name, parent_id, initial_content=None):
        """Finds or creates a Google Doc by name under a parent."""
        query = f"name = '{name}' and mimeType = 'application/vnd.google-apps.document' and trashed = false and '{parent_id}' in parents"
        results = self.service.files().list(q=query, spaces='drive', fields='files(id, name, webViewLink)').execute()
        files = results.get('files', [])

        if files:
            return files[0]['id'], files[0]['webViewLink']

        file_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.document',
            'parents': [parent_id]
        }
        doc = self.service.files().create(body=file_metadata, fields='id, webViewLink').execute()
        
        # If we have initial content, we'd need to use docs_service to update it.
        # For simplicity in this first step, we just create the empty doc.
        return doc.get('id'), doc.get('webViewLink')

    def sync_path_to_doc(self, path_steps, content_html=None):
        """
        Recursively creates folders for each step in path_steps and 
        a Google Doc at the target leaf.
        Example: path_steps = ["LS-DYNA Research", "CONTACT", "CONTROL_SPH", "QL"]
        """
        if not self.service:
            self.authenticate()

        current_parent = None
        for step in path_steps[:-1]:
            current_parent = self.get_or_create_folder(step, current_parent)
        
        doc_name = path_steps[-1]
        doc_id, web_link = self.get_or_create_doc(doc_name, current_parent)
        
        # Sync HTML content
        if content_html:
            self.update_doc_content(doc_id, content_html)
        
        return {
            "id": doc_id,
            "url": web_link,
            "path": " / ".join(path_steps)
        }

    def update_doc_content(self, doc_id, html_content):
        """
        Updates the Google Doc with new content.
        For simplicity, we convert basic HTML to plain text.
        """
        if not self.docs_service:
            return

        import re
        # Basic HTML to Text conversion (Removing tags)
        text_content = re.sub('<[^<]+?>', '', html_content)
        # Handle some common HTML entities
        text_content = text_content.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')

        try:
            # 1. Get current document length to delete everything
            doc = self.docs_service.documents().get(documentId=doc_id).execute()
            content = doc.get('body').get('content')
            last_index = content[-1].get('endIndex')
            
            requests = []
            
            # 2. Delete existing content (except for the very last newline which is mandatory)
            if last_index > 2:
                requests.append({
                    'deleteContentRange': {
                        'range': {
                            'startIndex': 1,
                            'endIndex': last_index - 1
                        }
                    }
                })

            # 3. Insert new text
            requests.append({
                'insertText': {
                    'location': {
                        'index': 1,
                    },
                    'text': text_content
                }
            })

            self.docs_service.documents().batchUpdate(
                documentId=doc_id, body={'requests': requests}).execute()
        except Exception as e:
            print(f"Error updating Google Doc content: {e}")
            raise
