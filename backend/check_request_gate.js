const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    const id = process.argv[2];
    if (!id) {
        console.error('Usage: node check_request_gate.js <requestId>');
        process.exit(1);
    }

    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const reqRef = db.collection('gate_requests').doc(id);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) {
            console.error('Request not found:', id);
            process.exit(2);
        }

        const data = reqDoc.data();
        console.log('Request:', { id: reqDoc.id, status: data.status, qrUsed: data.qrUsed, usedAt: data.usedAt?.toDate?.()?.toISOString?.() || null, usedBy: data.usedBy || null });

        if (data.usedBy) {
            const userDoc = await db.collection('users').doc(data.usedBy).get();
            if (userDoc.exists) {
                console.log('Used by security user:', { id: userDoc.id, ...userDoc.data() });
            } else {
                console.log('UsedBy id present but user doc not found:', data.usedBy);
            }
        } else {
            console.log('No usedBy on request. Checking scan_logs for requestId...');
            const logs = await db.collection('scan_logs').where('requestId', '==', id).orderBy('scanTime', 'desc').limit(10).get();
            if (logs.empty) {
                console.log('No scan_logs found for this request.');
            } else {
                console.log('Recent scan_logs:');
                for (const l of logs.docs) {
                    console.log({ id: l.id, ...l.data(), scanTime: l.data().scanTime?.toDate?.()?.toISOString?.() || null });
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
