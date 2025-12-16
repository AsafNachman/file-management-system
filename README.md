<img width="1898" height="152" alt="image" src="https://github.com/user-attachments/assets/ccd8b3e6-d55d-4a4e-8660-afe7f15b03df" />

# 📂 File Management System

A Full Stack application for secure file uploading, storage, and management. Built with **FastAPI (Python)** on the backend and **React (Vite)** on the frontend.

🔗 **Live Demo:** [https://file-manager-task.web.app/](https://file-manager-task.web.app/)

## 🚀 Features
* **Secure Uploads:** Validates file types (.pdf, .json, .txt) and prevents malicious uploads.
* **Google Cloud Integration:** Uses Cloud Storage for files and Firestore for metadata.
* **Authentication:** Full Google Sign-In integration via Firebase Auth.
* **Smart Filtering:** Sort by size/date and filter by file type.
* **Dark Mode:** Persists user preference for Light/Dark theme.

## 🛠 Architecture & Decisions

### 1. Compute: Google Cloud Run vs Cloud Functions
I chose **Cloud Run** over Cloud Functions for the backend.
* **Why?** Cloud Run allows me to containerize the entire FastAPI application using Docker. This ensures environment consistency between development and production. It also handles concurrent requests better than Cloud Functions, which is vital for file uploads.

### 2. Database: Firestore + Cloud Storage
* **Split Architecture:** I separated the file content (Cloud Storage) from the metadata (Firestore).
* **Why?** Storing file metadata (size, upload date, owner) in Firestore allows for instant searching, sorting, and filtering without needing to touch the heavy file blobs in storage. This makes the UI snappy and reduces costs.

### 3. Security
* **Identity Awareness:** The backend is stateless but verifies the Firebase Auth Token on every request using a Dependency Injection pattern in FastAPI.
* **Signed URLs:** Files are not public. The backend generates a temporary "Signed URL" that grants access for only 1 hour, ensuring only authorized users can download files.

## 📸 Bonus Implementations

### ✅ 1. Testing (Unit & Integration)
Implemented `pytest` suite covering:
* **Unit Tests:** Validates file extension logic and admin permission helpers.
* **Integration Tests:** Simulates a full user flow (Login -> Upload -> Verify DB) using `unittest.mock` to simulate Google Cloud services.
* **Proof:**
    !<img width="1894" height="156" alt="5 Tests Passed" src="https://github.com/user-attachments/assets/3fa327e2-3d21-43c5-82bf-6105e956578d" />



### ✅ 2. Monitoring & Alerting
Configured Google Cloud Monitoring to track system health.
* **Metrics:** Tracking Request Latency and Error Counts (5xx responses).
* **Alerting:** Set up an **Email Alert Policy** that triggers immediately if the application crashes (500 Error).
* **Proof:**
    !<img width="1902" height="926" alt="Alert Policy" src="https://github.com/user-attachments/assets/010a9dc1-a88e-4891-886d-736af336a572" />


### ✅ 3. UI/UX Design
* Implemented a modern "Card-based" UI with responsive design.
* Added a **Dark Mode** toggle that saves the user's preference to LocalStorage.

## ⚙️ Setup Instructions

### Prerequisites
* Node.js & npm
* Python 3.10+
* Google Cloud Project with Firestore & Storage enabled

### Local Backend Setup
1.  Navigate to `backend/`
2.  Install dependencies: `pip install -r requirements.txt`
3.  Run the server: `uvicorn main:app --reload`

### Local Frontend Setup
1.  Navigate to `frontend/`
2.  Install packages: `npm install`
3.  Start React: `npm run dev`

### Deployment
* **Backend:** Deployed via `gcloud run deploy` using the included Dockerfile.
* **Frontend:** Deployed via `firebase deploy`.
