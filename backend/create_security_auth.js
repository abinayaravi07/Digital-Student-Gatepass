const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const auth = admin.auth();
        const db = admin.firestore();

        const securities = [
            { email: 'security.gate1@smvec.ac.in', password: 'password123', name: 'Gate Security 1' },
            { email: 'security.gate2@smvec.ac.in', password: 'password123', name: 'Gate Security 2' },
            { email: 'security.gate3@smvec.ac.in', password: 'password123', name: 'Gate Security 3' },
            { email: 'security.gate4@smvec.ac.in', password: 'password123', name: 'Gate Security 4' }
        ];

        for (const s of securities) {
            try {
                // Check if auth user exists
                let userRecord;
                try {
                    userRecord = await auth.getUserByEmail(s.email);
                    console.log(`Auth user exists for ${s.email} (uid: ${userRecord.uid})`);
                } catch (e) {
                    if (e.code === 'auth/user-not-found' || e.code === 'auth/user-not-found') {
                        userRecord = await auth.createUser({ email: s.email, password: s.password, displayName: s.name });
                        console.log(`Created auth user for ${s.email} (uid: ${userRecord.uid})`);
                    } else {
                        throw e;
                    }
                }

                // Link to Firestore users doc
                    const usersSnapshot = await db.collection('users').where('email', '==', s.email).limit(1).get();
                    if (usersSnapshot.empty) {
                        // Create Firestore user doc for security if missing
                        const created = await db.collection('users').add({
                            email: s.email,
                            name: s.name,
                            role: 'security',
                            department: 'Security',
                            phone: '',
                            employeeId: `SEC-${s.email.split('@')[0]}`,
                            firebaseUid: userRecord.uid,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`Created Firestore user doc ${created.id} for ${s.email} and linked firebaseUid ${userRecord.uid}`);
                    } else {
                        const userDoc = usersSnapshot.docs[0];
                        await userDoc.ref.update({ firebaseUid: userRecord.uid });
                        console.log(`Linked Firestore user ${userDoc.id} -> firebaseUid ${userRecord.uid}`);
                    }
            } catch (err) {
                console.error(`Error processing ${s.email}:`, err.message || err);
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err.message || err);
        process.exit(1);
    }
}

main();
