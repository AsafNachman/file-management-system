import os
import datetime
import uuid
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import auth, credentials, firestore, storage as firebase_storage
from google.cloud import storage

# --- Configuration ---

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
storage_client = storage.Client()

app = FastAPI(title="File Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# *** HARDCODED CONFIGURATION ***
BUCKET_NAME = "file-manager-uploads-asaf"
ADMIN_EMAILS = ["idoasaf.ia@gmail.com"]

# --- Models ---

class FileMetadata(BaseModel):
    id: str
    filename: str
    contentType: str
    size: int
    uploadDate: datetime.datetime
    userId: str
    userEmail: str

# --- Dependencies ---

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authentication header")
    
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# --- Helper Functions ---

def is_admin(user_email: str) -> bool:
    return user_email in ADMIN_EMAILS

ALLOWED_EXTENSIONS = {".json", ".txt", ".pdf"}

def validate_file(filename: str):
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed.")

# --- Routes ---

@app.post("/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    validate_file(file.filename)
    
    file_id = str(uuid.uuid4())
    blob_name = f"{user['uid']}/{file_id}_{file.filename}"
    
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(blob_name)
        
        contents = await file.read()
        blob.upload_from_string(contents, content_type=file.content_type)
        
        file_data = {
            "id": file_id,
            "filename": file.filename,
            "contentType": file.content_type,
            "size": len(contents),
            "uploadDate": datetime.datetime.now(datetime.timezone.utc),
            "userId": user["uid"],
            "userEmail": user.get("email", "unknown"),
            "gcsPath": blob_name
        }
        
        db.collection("files").document(file_id).set(file_data)
        return file_data

    except Exception as e:
        print(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during upload")

@app.get("/files", response_model=List[FileMetadata])
async def list_files(
    sort_by: Optional[str] = Query("date", enum=["date", "size"]),
    file_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    user_id = user["uid"]
    user_email = user.get("email", "")
    is_user_admin = is_admin(user_email)
    
    files_ref = db.collection("files")
    
    if not is_user_admin:
        query = files_ref.where(field_path="userId", op_string="==", value=user_id)
    else:
        query = files_ref

    docs = query.stream()
    results = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)

    # In-memory filtering/sorting
    if file_type:
        results = [f for f in results if f["contentType"] == file_type or f["filename"].endswith(file_type)]

    if search:
        results = [f for f in results if search.lower() in f["filename"].lower()]

    if sort_by == "size":
        results.sort(key=lambda x: x["size"], reverse=True)
    else:
        results.sort(key=lambda x: x["uploadDate"], reverse=True)

    return results

@app.delete("/files/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("files").document(file_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found")
        
    file_data = doc.to_dict()
    
    if file_data["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this file.")

    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(file_data["gcsPath"])
        if blob.exists():
            blob.delete()
        
        doc_ref.delete()
        return {"message": "File deleted successfully"}

    except Exception as e:
        print(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete file")

# --- NEW ENDPOINT: Secure File Stream ---
@app.get("/files/{file_id}/download")
async def download_file(file_id: str, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("files").document(file_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_data = doc.to_dict()
    
    # Security: Only Owner or Admin can download
    user_email = user.get("email", "")
    if file_data["userId"] != user["uid"] and not is_admin(user_email):
        raise HTTPException(status_code=403, detail="Access Denied")

    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(file_data["gcsPath"])
        
        # Open blob as a stream
        file_stream = blob.open("rb")
        
        return StreamingResponse(
            file_stream, 
            media_type=file_data["contentType"],
            headers={"Content-Disposition": f'attachment; filename="{file_data["filename"]}"'}
        )
    except Exception as e:
        print(f"Download Error: {e}")
        raise HTTPException(status_code=500, detail="Could not download file")