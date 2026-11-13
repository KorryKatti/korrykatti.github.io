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
                # Handle both single-line and multiline JSON
                # Strip whitespace and normalize newlines
                cleaned = env_creds.strip()
                info = json.loads(cleaned)
                creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
            except json.JSONDecodeError as e:
                print(f"Error: GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: {e}")
                # Try to normalize - replace escaped newlines
                try:
                    cleaned = env_creds.replace('\\n', '\n').strip()
                    info = json.loads(cleaned)
                    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
                except Exception as e2:
                    print(f"Error: Failed JSON cleanup: {e2}")
        
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

def append_log_row(user_prompt: str, ai_text: str, ai_code: str, model: str, code_output: str, status: int, review: int = 0):
    """Appends a new log row to the Google Sheet with basic sanitization."""
    # Sanitization
    user_prompt = str(user_prompt)
    ai_text = str(ai_text)
    ai_code = str(ai_code)
    model = str(model)
    code_output = str(code_output)
    
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
        
    values = [[ # triggered when code executor ran
        user_prompt,  # what user aksed
        ai_text, # text part of the output ai provided
        ai_code, # code part of the output ai provided
        model, # model used
        code_output, # output of the code even if its error
        status, # status of the code execution , like exit code : 0 is good others bad
        review # review of the code execution, 1 good 0 bad , get from thumbsup or down on frontend
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

def update_last_review(review: int):
    """Updates the review column (column G) of the last row in the sheet."""
    service = get_sheets_service()
    spreadsheet_id = get_spreadsheet_id()

    if not service or not spreadsheet_id:
        return False

    try:
        # First, find the last row with data
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range="Sheet1!A:A"
        ).execute()

        values = result.get('values', [])
        last_row = len(values)

        if last_row < 2:  # No data rows yet
            return False

        # Update column G (7th column) of the last row
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"Sheet1!G{last_row + 1}",  # +1 because sheet is 1-indexed and row 1 is header
            valueInputOption="RAW",
            body={'values': [[review]]}
        ).execute()
        return True
    except Exception as e:
        print(f"Error updating review in Google Sheets: {e}")
        return False
