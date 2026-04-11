import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

CREDENTIALS_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    """Returns a Google Sheets service object using file or env credentials."""
    try:
        creds = None
        
        env_creds = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        if env_creds:
            try:
                info = json.loads(env_creds)
                creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
            except json.JSONDecodeError:
                print("Error: GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
        
        if not creds and os.path.exists(CREDENTIALS_FILE):
            creds = service_account.Credentials.from_service_account_file(
                CREDENTIALS_FILE, scopes=SCOPES)
        
        if not creds:
            return None
            
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        print(f"Error connecting to Google Sheets: {e}")
        return None

def get_spreadsheet_id():
    return os.environ.get("SPREADSHEET_ID")

def append_log_row(user_prompt: str, ai_text: str, ai_code: str, model: str, status: int, review: int = 0):
    """Appends a new log row to the Google Sheet with basic sanitization."""
    # Sanitization
    user_prompt = str(user_prompt)
    ai_text = str(ai_text)
    ai_code = str(ai_code)
    model = str(model)
    
    try:
        status = int(status)
        review = int(review)
    except (ValueError, TypeError):
        status = 0
        review = 0

    service = get_sheets_service()
    spreadsheet_id = get_spreadsheet_id()
    
    if not service or not spreadsheet_id:
        return False
        
    values = [[
        user_prompt,
        ai_text,
        ai_code,
        model,
        status,
        review
    ]]
    
    body = {'values': values}
    
    try:
        service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range="Sheet1!A2",  # Starts looking from A2 to append to the end
            valueInputOption="RAW",
            body=body
        ).execute()
        return True
    except Exception as e:
        print(f"Error appending to Google Sheets: {e}")
        return False
