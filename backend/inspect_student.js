const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: node inspect_student.js <email>');
        process.exit(1);
    }

    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const normalized = String(email).trim().toLowerCase();
        const usersSnapshot = await db.collection('users').where('email', '==', normalized).limit(1).get();
        if (usersSnapshot.empty) {
            console.error('No user found with email:', normalized);
            process.exit(2);
        }

        const userDoc = usersSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };
        console.log('Student record:', user);

        // Show assigned advisor
        if (user.assignedAdvisorId) {
            const advDoc = await db.collection('users').doc(user.assignedAdvisorId).get();
            if (advDoc.exists) {
                console.log('Assigned Advisor:', { id: advDoc.id, ...advDoc.data() });
            } else {
                console.log('assignedAdvisorId present but not found:', user.assignedAdvisorId);
            }
        } else {
            console.log('No assignedAdvisorId found on student. Will try to compute advisor match.');

            // Try to find advisor by similar logic
            const advisorsSnapshot = await db.collection('users').where('role', 'in', ['classAdvisor','advisor']).get();
            const matches = advisorsSnapshot.docs.filter(d => {
                const data = d.data();
                const dept = (data.department || data.handlesDepartment || '').toString();
                const sec = (data.section || data.handlesSection || '').toString();
                const dataBatchStart = data.batchStart ?? data.handlesBatchStart ?? null;
                const dataBatchEnd = data.batchEnd ?? data.handlesBatchEnd ?? null;
                if (dept && sec && dataBatchStart && dataBatchEnd) {
                    return dept === user.department && Number(dataBatchStart) === Number(user.batchStart) && Number(dataBatchEnd) === Number(user.batchEnd) && sec === user.section;
                }
                const handlesYear = data.handlesYear ?? null;
                const handlesSection = data.handlesSection ?? null;
                return dept === user.department && handlesYear === String(user.batchStart) && handlesSection === user.section;
            });

            console.log('Computed advisor matches count:', matches.length);
            matches.slice(0,5).forEach(m => console.log({ id: m.id, ...m.data() }));
        }

        // List gate requests for this student
        const requestsSnap = await db.collection('gate_requests').where('studentId', '==', user.id).get();
        if (requestsSnap.empty) {
            console.log('No gate_requests found for this student.');
        } else {
            console.log('Gate requests for student:');
            for (const r of requestsSnap.docs) {
                const d = r.data();
                console.log({ id: r.id, status: d.status, advisorId: d.advisorId, hodId: d.hodId, qrToken: d.qrToken || null, appliedAt: d.appliedAt?.toDate?.()?.toISOString?.() || null });
            }
        }

        // If advisor exists, list pending requests count for that advisor
        const advisorId = user.assignedAdvisorId || (requestsSnap.empty ? null : requestsSnap.docs[0].data().advisorId);
        if (advisorId) {
            const pending = await db.collection('gate_requests').where('advisorId', '==', advisorId).where('status', '==', 'pending_advisor').get();
            console.log(`Advisor ${advisorId} has ${pending.size} pending_advisor requests.`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
