const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    const hodEmail = 'hod.it@smvec.ac.in';
    const dept = 'IT';
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const hodSnap = await db.collection('users').where('email', '==', hodEmail).limit(1).get();
        if (hodSnap.empty) {
            console.error('HOD not found:', hodEmail);
            process.exit(2);
        }
        const hodDoc = hodSnap.docs[0];
        const hodId = hodDoc.id;
        console.log('Found HOD', hodEmail, 'id=', hodId);

        // Find students in dept
        const studentsSnap = await db.collection('users').where('role', '==', 'student').where('department', '==', dept).get();
        console.log('Students in', dept, ':', studentsSnap.size);

        let changedStudents = 0;
        let changedRequests = 0;
        const studentIds = [];
        for (const s of studentsSnap.docs) {
            const data = s.data();
            studentIds.push(s.id);
            if (data.assignedHodId !== hodId) {
                await s.ref.update({ assignedHodId: hodId, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                changedStudents++;
                console.log('Updated student', s.id);
            }
        }

        if (studentIds.length === 0) {
            console.log('No students found to update.');
        } else {
            // Update requests for these students where hodId is different or missing and status is pending_hod
            const requestsSnap = await db.collection('gate_requests')
                .where('studentId', 'in', studentIds.slice(0, 10))
                .get();
            // Note: Firestore `in` accepts max 10 items; for large sets this should be batched.

            for (const r of requestsSnap.docs) {
                const rd = r.data();
                if (rd.status === 'pending_hod' && rd.hodId !== hodId) {
                    await r.ref.update({ hodId: hodId });
                    changedRequests++;
                    console.log('Updated request', r.id);
                }
            }
        }

        console.log('Done. Students updated:', changedStudents, 'Requests updated (first batch):', changedRequests);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
