import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import sys
from fastapi import HTTPException

# --- PART 1: MOCK GOOGLE CLOUD LIBRARIES ---
# We must mock these BEFORE importing main, or it will crash looking for credentials.
mock_firestore = MagicMock()
mock_storage = MagicMock()
mock_auth = MagicMock()

sys.modules["firebase_admin"] = MagicMock()
sys.modules["firebase_admin.auth"] = mock_auth
sys.modules["firebase_admin.firestore"] = mock_firestore
sys.modules["firebase_admin.storage"] = mock_storage
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.storage"] = mock_storage

# Now it is safe to import your app
from main import app, validate_file, is_admin, get_current_user

client = TestClient(app)

# --- TEST SET 1: LOGIC UNIT TESTS ---

def test_validate_file_valid():
    """Unit Test: Accepts valid files."""
    try:
        validate_file("test.pdf")
        validate_file("test.json")
    except HTTPException:
        pytest.fail("Valid file was rejected!")

def test_validate_file_invalid():
    """Unit Test: Rejects .exe files."""
    with pytest.raises(HTTPException):
        validate_file("virus.exe")

def test_is_admin_logic():
    """Unit Test: Checks if the admin email list works."""
    admin_email = "idoasaf.ia@gmail.com" 
    assert is_admin(admin_email) == True
    assert is_admin("random@hacker.com") == False

# --- TEST SET 2: API INTEGRATION TESTS ---

def test_unauthorized_access():
    """Security Test: Try to list files without logging in."""
    # We clear any overrides just in case
    app.dependency_overrides = {}
    
    response = client.get("/files")
    # Should fail because we provided no token
    assert response.status_code in [401, 422, 403]

def test_upload_flow_mocked():
    """
    Integration Test: Simulates a file upload.
    We use 'dependency_overrides' to bypass the complex Auth logic.
    """
    # 1. DEFINE THE FAKE USER
    # Instead of mocking Firebase, we just tell FastAPI: 
    # "When someone asks for 'get_current_user', give them this dict."
    def mock_get_current_user_override():
        return {
            "uid": "test-user-123", 
            "email": "test@user.com"
        }

    # 2. APPLY THE OVERRIDE
    app.dependency_overrides[get_current_user] = mock_get_current_user_override

    # 3. MOCK THE STORAGE BUCKET
    # We still need to trick the app into thinking Google Storage is working
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    # When the app asks for a bucket, give it our mock
    mock_storage.Client.return_value.bucket.return_value = mock_bucket
    # When the app asks for a file blob, give it our mock blob
    mock_bucket.blob.return_value = mock_blob
    
    # Make sure generate_signed_url returns a real string, not a Mock
    mock_blob.generate_signed_url.return_value = "https://fake-signed-url.com"

    # 4. SEND THE FILE
    # We send a fake PDF file
    files = {'file': ('test.pdf', b'%PDF-1.4 content...', 'application/pdf')}
    
    # We don't need a real token header because of the override
    response = client.post("/upload", files=files)

    # 5. CLEAN UP
    app.dependency_overrides = {}

    # 6. VERIFY SUCCESS
    # If this fails with 500, check the terminal for the error
    assert response.status_code == 200
    data = response.json()
    
    # Check if the response matches our fake user
    assert data["filename"] == "test.pdf"
    assert data["userId"] == "test-user-123"