// Replace the top section of your sync.js with this:
const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

// Initialize the app using the new SDK methods
const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

async function syncUsersToFirestore() {
  try {
    console.log("Fetching users from Firebase Authentication...");
    
    // 1. List all users currently in Firebase Auth
    const listUsersResult = await auth.listUsers(1000); 
    const authUsers = listUsersResult.users;
    
    console.log(`Found ${authUsers.length} users in Auth. Syncing to Firestore...`);

    // 2. Use a Firestore batch to write documents efficiently
    let batch = db.batch();
    let counter = 0;
    const batchLimit = 500; 

    for (const user of authUsers) {
      const userDocRef = db.collection('users').doc(user.uid);

      // Determine the role based on their email prefix
      let role = 'student';
      if (user.email && user.email.startsWith('hod.')) {
        role = 'hod';
      } else if (user.email && user.email.startsWith('ca.')) {
        role = 'advisor';
      }

      // Create the default fields structure
      const userData = {
        email: user.email || "",
        firebaseUid: user.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        role: role,
        name: user.displayName || (user.email ? user.email.split('@')[0] : "User"), 
        phone: user.phoneNumber || "",
        department: "", 
        employeeId: "",
        section: "",
        year: ""
      };

      batch.set(userDocRef, userData, { merge: true });
      counter++;

      if (counter % batchLimit === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${counter} users...`);
      }
    }

    if (counter % batchLimit !== 0) {
      await batch.commit();
    }

    console.log(`Successfully synced ${counter} users to the Firestore 'users' collection!`);
  } catch (error) {
    console.error("Error syncing users:", error);
  }
}

syncUsersToFirestore();