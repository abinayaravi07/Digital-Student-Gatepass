const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
        console.log(`Found ${studentsSnap.size} students`);

        const hodsSnap = await db.collection('users').where('role', 'in', ['hod','headOfDepartment']).get();
        const hods = hodsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        let updatedStudents = 0;
        let updatedRequests = 0;

        for (const s of studentsSnap.docs) {
            const data = s.data();
            if (data.assignedHodId) continue;

            // find HOD by department
            const dept = data.department || data.handlesDepartment || null;
            let match = hods.find(h => (h.department || h.handlesDepartment || '') === dept);
            if (!match && hods.length > 0) match = hods[0];
            if (!match) continue;

            await s.ref.update({ assignedHodId: match.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            updatedStudents++;

            // update existing requests for student
            const requestsSnap = await db.collection('gate_requests').where('studentId', '==', s.id).get();
            for (const r of requestsSnap.docs) {
                const rd = r.data();
                if (!rd.hodId) {
                    await r.ref.update({ hodId: match.id });
                    updatedRequests++;
                }
            }

            console.log(`Assigned HOD ${match.id} to student ${s.id}`);
        }

        console.log(`Done. Students updated: ${updatedStudents}, Requests updated: ${updatedRequests}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
