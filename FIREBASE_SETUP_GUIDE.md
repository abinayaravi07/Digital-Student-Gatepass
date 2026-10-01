# Firebase Setup Guide

This guide is for the cloned project in `digital student gatepass` and does not change the original Smartgate folder.

## 1. Create a Firebase project

1. Open the Firebase console.
2. Create a new project.
3. Enable **Firestore Database**.
4. Enable **Authentication**.
5. In Authentication, turn on the sign-in methods this project uses:
   - Email/Password
   - Google

## 2. Create a Web app

1. In Firebase, add a **Web app**.
2. Copy the config values.
3. Copy `frontend/.env.example` to `frontend/.env`.
4. Replace the placeholder values with your Firebase web app config.

Use this format:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 3. Create the backend service account

The backend reads Firebase Admin credentials from the `FIREBASE_SERVICE_ACCOUNT` environment variable.

1. In Firebase, open **Project settings**.
2. Go to **Service accounts**.
3. Generate a new private key.
4. Copy `backend/.env.example` to `backend/.env`.
5. Replace the placeholder service account value with your JSON on one line.

Use this format:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
PORT=5000
ALLOWED_EMAIL_DOMAIN=your-domain.com
```

Do not commit the service account JSON to Git.

## 4. Firestore structure

The backend stores users and gatepass data in Firestore. The exact collections are created by the app when needed, so you usually do not need to create them manually.

If you want to pre-check access, make sure Firestore rules are set correctly for your use case.

## 5. Install and run the project

Open two terminals.

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app should open on the Vite local URL, usually `http://localhost:5173`.

## 6. Important files

- Frontend Firebase client config: `frontend/src/config/firebase.js`
- Backend Firebase Admin init: `backend/server.js`
- Frontend environment variables: `frontend/.env`
- Backend environment variables: `backend/.env`

## 7. If login does not work

Check these first:

1. Firebase Authentication is enabled.
2. The frontend `.env` values match the Firebase web app.
3. `FIREBASE_SERVICE_ACCOUNT` is valid JSON in the backend `.env`.
4. `ALLOWED_EMAIL_DOMAIN` matches the email domain you want to allow.
5. The backend is running before the frontend tries to authenticate.

## 8. Optional deployment notes

If you deploy later:

- Set the same environment variables in your hosting platform.
- Add your production frontend URL to CORS in the backend if needed.
- Keep the service account secret private.

If you want, I can also create `.env.example` files for both frontend and backend in the new folder.
