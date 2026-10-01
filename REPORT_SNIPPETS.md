# Project Report Snippets

This file collects four representative code snippets for the report: one frontend dashboard, one backend gate-check, one Firebase config, and one UI component. Each snippet includes a short explanation and redaction notes.

---

## 1) Frontend — Student Dashboard (`frontend/src/pages/StudentDashboard.jsx`)

Purpose: student-facing view to create and view gate pass requests; shows request list, status counts, and the request creation modal.

Key snippet (form submission + request loading):

```jsx
  const loadRequests = async () => {
    try {
      setLoading(true);
      const { requests: data } = await api.getStudentRequests();
      setRequests(data);
    } catch (error) {
      addToast(error.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.reason.length < 10) {
      addToast('Please provide a detailed reason (at least 10 characters)', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (formData.exitDate && formData.exitTime) {
        const d = new Date(`${formData.exitDate}T${formData.exitTime}:00`);
        payload.exitDate = d.toISOString();
      }
      payload.expectedReturnTime = formData.expectedReturnTime || null;

      await api.createRequest(payload);
      addToast('Gate pass request submitted successfully!', 'success');
      setIsModalOpen(false);
      setFormData({
        reason: '',
        destination: '',
        exitDate: '',
        exitTime: '',
        expectedReturnTime: '',
        contactNumber: dbUser?.phone || '',
      });
      loadRequests();
    } catch (error) {
      addToast(error.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };
```

Notes: include this full function in the report and explain the payload transformation and validation.

---

## 2) Backend — Gate Check (`backend/check_request_gate.js`)

Purpose: server-side logic to validate a gate pass request when a student tries to exit—performs authorization and expiry checks.

(Include the file's core function in the report; show DB query, status checks, and response shapes.)

Example pattern (pseudocode to include):

```js
// get request by id / token
const request = await getRequestByIdOrToken(tokenOrId);
if (!request) return res.status(404).json({ error: 'Not found' });
if (request.status !== 'approved') return res.status(400).json({ valid: false, error: 'Not approved' });
if (request.used) return res.status(400).json({ valid: false, error: 'Already used' });
// mark used
await markRequestUsed(request.id, securityUserId);
return res.json({ valid: true, student: request.student, request });
```

Redaction: remove any internal logging or environment-specific paths.

---

## 3) Firebase — Config (`frontend/src/config/firebase.js`)

Purpose: initialize Firebase in the frontend app and export auth helpers.

Snippet (redacted keys):

```js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'REDACTED', // use env vars in real project
  authDomain: 'REDACTED',
  projectId: 'REDACTED',
  storageBucket: 'REDACTED',
  messagingSenderId: 'REDACTED',
  appId: 'REDACTED'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
```

Note: In the repo, env vars are used. In the report, explicitly say that secrets are redacted.

---

## 4) UI Component — Request Card (`frontend/src/components/RequestCard.jsx`)

Purpose: small presentational component used in dashboards to show request summary and status badge.

Key snippet (status badge export and usage):

```jsx
export function StatusBadge({ status }) {
  const map = {
    pending_advisor: { label: 'Pending (Advisor)', color: 'amber' },
    pending_hod: { label: 'Pending (HOD)', color: 'amber' },
    approved: { label: 'Approved', color: 'emerald' },
    rejected: { label: 'Rejected', color: 'rose' },
    used: { label: 'Used', color: 'gray' }
  };
  const s = map[status] || { label: status, color: 'gray' };
  return <span className={`px-3 py-1 rounded-full bg-${s.color}-500/10 text-${s.color}-400 text-sm font-medium border border-${s.color}-500/20`}>{s.label}</span>;
}
```

Suggestion: include the component and a screenshot of the rendered card in the report.

---

## How I prepared these snippets

- I picked one representative file from each category as requested.
- Secrets (API keys, service account JSON) were redacted — include a note in the report to obtain them from environment variables.

## Next steps

- I can extract the exact full functions (copiable code blocks) from the repo and place them into a single formatted Markdown or Word document.
- Tell me whether you want a single Markdown file (`REPORT_SNIPPETS.md`) (current) or a formatted PDF/Word export.
