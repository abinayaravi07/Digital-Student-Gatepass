# Digital Student Gatepass

Digital Student Gatepass is a secure gate pass workflow for SMVEC built with React, Vite, Express, and Firebase.

## Status

- GitHub repo: [Digital-Student-Gatepass](https://github.com/abinayaravi07/Digital-Student-Gatepass)
- Production deploy: create a fresh Vercel project from this GitHub repo after deleting the old one
- Login domain: only `@smvec.ac.in` accounts are allowed for student access

## What this app does

- Students request gate passes from the web app
- Class Advisors approve or reject requests
- HODs give final approval
- Security scans QR codes at the gate

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion
- Backend: Node.js, Express
- Auth and data: Firebase Authentication and Firestore
- Deployment: Vercel

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/abinayaravi07/Digital-Student-Gatepass.git
cd Digital-Student-Gatepass
```

### 2. Install dependencies

```bash
cd frontend
npm install

cd ../backend
npm install
```

### 3. Configure local env files

Copy the example files and fill in your real values locally:

- [backend/.env.example](backend/.env.example) -> `backend/.env`
- [frontend/.env.example](frontend/.env.example) -> `frontend/.env`

Do not commit real `.env` files to GitHub.

### 4. Run locally

```bash
# terminal 1
cd backend
npm start

# terminal 2
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

### Backend `backend/.env`

Use these keys locally and in Vercel:

```env
PORT=5000
ALLOWED_EMAIL_DOMAIN=smvec.ac.in
FRONTEND_URL=http://localhost:5173
ADMIN_SECRET=change-me
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### Frontend `frontend/.env`

For local development:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

For Vercel production, set `VITE_API_URL=/api`.

## Deploying on Vercel

If the current Vercel app is the wrong or old deployment, delete that Vercel project first, then create a new one from this GitHub repository.

### Vercel steps

1. Go to Vercel and delete the old project.
2. Import the GitHub repo `Digital-Student-Gatepass`.
3. Set these environment variables in Vercel for Production, Preview, and Development:
   - `FIREBASE_SERVICE_ACCOUNT`
   - `ALLOWED_EMAIL_DOMAIN=smvec.ac.in`
   - `FRONTEND_URL=https://your-new-vercel-domain.vercel.app`
   - `ADMIN_SECRET`
   - `VITE_API_URL=/api`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Redeploy.

The backend is exposed through `api/index.js`, and `vercel.json` routes `/api/*` correctly.

## Security Checklist

- Never commit `backend/.env`, `frontend/.env`, or Firebase service account JSON files.
- Keep only the example env files in GitHub.
- Use a strong `ADMIN_SECRET`.
- Rotate the Firebase service account if it was ever exposed publicly.
- Keep `ALLOWED_EMAIL_DOMAIN=smvec.ac.in` unless you intentionally want to support a different domain.
- Use Firebase Auth and Firestore security rules that only allow the expected roles and documents.
- Set `FRONTEND_URL` to the real Vercel URL so CORS and redirects match production.

## Login Rules

This project intentionally blocks non-`@smvec.ac.in` student emails. If a login fails, check:

1. The email really ends with `@smvec.ac.in`
2. The user exists in Firebase Auth or the seeded Firestore profile
3. Vercel environment variables are set correctly
4. The app was redeployed after the environment changes

## Project Structure

```text
digital-student-gatepass/
├── api/
├── backend/
├── frontend/
├── vercel.json
└── package.json
```

## Notes

- The old Vercel deployment should be removed before creating the new one.
- After pushing code to GitHub, Vercel should be connected to this repo so future commits redeploy automatically.