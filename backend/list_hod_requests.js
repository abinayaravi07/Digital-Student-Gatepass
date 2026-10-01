const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const hodsSnap = await db.collection('users').where('role', 'in', ['hod','headOfDepartment']).get();
        const hodMap = {};
        hodsSnap.docs.forEach(d => { hodMap[d.id] = d.data().email || ('<no-email-'+d.id+'>'); });

        const pendingSnap = await db.collection('gate_requests').where('status', '==', 'pending_hod').get();
        console.log(`Total pending_hod requests: ${pendingSnap.size}`);

        const grouped = {};
        for (const r of pendingSnap.docs) {
            const data = r.data();
            const hid = data.hodId || '<no-hod>';
            if (!grouped[hid]) grouped[hid] = [];
            grouped[hid].push({ id: r.id, studentEmail: data.studentEmail, advisorId: data.advisorId, appliedAt: data.appliedAt?.toDate?.()?.toISOString?.() || null });
        }

        for (const hid of Object.keys(grouped)) {
            console.log('\nHOD ID:', hid, 'email:', hodMap[hid] || '<unknown>');
            console.log('Count:', grouped[hid].length);
            grouped[hid].slice(0,10).forEach(x => console.log('-', x));
        }

        if (pendingSnap.empty) {
            console.log('No pending_hod requests found.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
