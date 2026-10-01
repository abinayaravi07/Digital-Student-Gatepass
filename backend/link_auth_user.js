const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    const email = process.argv[2];
    const password = process.argv[3] || 'password123';

    if (!email) {
        console.error('Usage: node link_auth_user.js <email> [password]');
        process.exit(1);
    }

    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const auth = admin.auth();
        const db = admin.firestore();

        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log(`Auth user exists for ${email} (uid: ${userRecord.uid})`);
        } catch (e) {
            if (e.code && e.code.includes('user-not-found')) {
                userRecord = await auth.createUser({ email, password, emailVerified: true });
                console.log(`Created auth user for ${email} (uid: ${userRecord.uid})`);
            } else {
                throw e;
            }
        }

        // Find Firestore user doc
        const normalized = String(email).trim().toLowerCase();
        const usersSnapshot = await db.collection('users').where('email', '==', normalized).limit(1).get();
        if (usersSnapshot.empty) {
            // Create a HOD doc by inferring department from email if possible
            let dept = null;
            const m = normalized.match(/^hod\.([^.@]+)@/);
            if (m) dept = m[1].toUpperCase();

            const created = await db.collection('users').add({
                email: normalized,
                name: 'HOD ' + (dept || ''),
                role: 'hod',
                department: dept || 'Unknown',
                handlesDepartment: dept || 'Unknown',
                phone: '',
                employeeId: 'HOD-' + (dept || 'UNK'),
                firebaseUid: userRecord.uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Created Firestore user doc ${created.id} for ${email} and linked firebaseUid ${userRecord.uid}`);
        } else {
            const userDoc = usersSnapshot.docs[0];
            await userDoc.ref.update({ firebaseUid: userRecord.uid });
            console.log(`Linked Firestore user ${userDoc.id} -> firebaseUid ${userRecord.uid}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
