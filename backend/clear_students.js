require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    const db = admin.firestore();
    const auth = admin.auth();

    async function clearStudents() {
        console.log('🔍 Finding students to delete...');
        
        // Get all students
        const snapshot = await db.collection('users')
            .where('role', '==', 'student')
            .get();

        if (snapshot.empty) {
            console.log('✅ No student accounts found to delete.');
            return;
        }

        console.log(`Found ${snapshot.size} students. Starting deletion...`);
        console.log('----------------------------------------');

        let deletedCount = 0;
        let errorCount = 0;

        // Process in chunks to avoid memory issues if there are many
        const students = snapshot.docs;

        for (const doc of students) {
            const userData = doc.data();
            const email = userData.email || 'Unknown Email';
            const uid = userData.firebaseUid;

            try {
                // 1. Delete from Firebase Authentication
                if (uid) {
                    try {
                        await auth.deleteUser(uid);
                        console.log(`🗑️  Auth Deleted: ${email}`);
                    } catch (authError) {
                        if (authError.code === 'auth/user-not-found') {
                            console.log(`⚠️  Auth Missing: ${email} (Already deleted?)`);
                        } else {
                            console.error(`❌ Auth Error (${email}): ${authError.message}`);
                        }
                    }
                } else {
                    console.log(`⚠️  No UID for: ${email}`);
                }

                // 2. Delete from Firestore
                await doc.ref.delete();
                console.log(`🔥 Firestore Deleted: ${email}`);
                deletedCount++;

            } catch (error) {
                console.error(`❌ Error deleting ${email}:`, error.message);
                errorCount++;
            }
        }

        console.log('----------------------------------------');
        console.log(`✅ Operation Complete`);
        console.log(`   Deleted: ${deletedCount}`);
        console.log(`   Errors:  ${errorCount}`);
    }

    clearStudents().catch(console.error);

} catch (error) {
    console.error('Error initializing:', error.message);
}
