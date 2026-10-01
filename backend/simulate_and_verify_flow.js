const admin = require('firebase-admin');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run(email) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnap.empty) throw new Error('Student not found');
        const studentDoc = usersSnap.docs[0];
        const student = { id: studentDoc.id, ...studentDoc.data() };

        if (!student.assignedAdvisorId) throw new Error('Student has no assignedAdvisorId');
        if (!student.assignedHodId) throw new Error('Student has no assignedHodId');

        // Create request
        const now = admin.firestore.FieldValue.serverTimestamp();
        const req = {
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            studentRollNumber: student.rollNumber || null,
            department: student.department || null,
            year: student.year || null,
            section: student.section || null,

            reason: 'Verify flow test',
            destination: 'Home',
            exitDate: new Date().toISOString(),
            exitTime: null,
            expectedReturnDate: null,
            expectedReturnTime: null,
            contactNumber: student.phone || '',

            status: 'pending_advisor',

            advisorId: student.assignedAdvisorId,
            advisorStatus: 'pending',

            hodId: student.assignedHodId,
            hodStatus: 'pending',

            qrToken: null,
            qrUsed: false,
            usedAt: null,
            usedBy: null,

            appliedAt: now,
            createdAt: now
        };

        const docRef = await db.collection('gate_requests').add(req);
        console.log('Request created:', docRef.id);

        // Confirm CA sees it
        const pendingForAdvisor = await db.collection('gate_requests')
            .where('advisorId', '==', student.assignedAdvisorId)
            .where('status', '==', 'pending_advisor')
            .get();

        if (!pendingForAdvisor.docs.find(d => d.id === docRef.id)) {
            throw new Error('Advisor does not see the new request');
        }
        console.log('Advisor pending check: PASS');

        // Approve as CA
        await docRef.update({
            status: 'pending_hod',
            advisorStatus: 'approved',
            advisorRemarks: 'Accepted by test',
            advisorActionAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Advisor approved');

        // Confirm HOD sees it
        const pendingForHod = await db.collection('gate_requests')
            .where('hodId', '==', student.assignedHodId)
            .where('status', '==', 'pending_hod')
            .get();

        if (!pendingForHod.docs.find(d => d.id === docRef.id)) {
            throw new Error('HOD does not see the forwarded request');
        }
        console.log('HOD pending check: PASS');

        // Approve as HOD
        const qr = uuidv4();
        await docRef.update({
            status: 'approved',
            hodStatus: 'approved',
            hodRemarks: 'Accepted by test',
            hodActionAt: admin.firestore.FieldValue.serverTimestamp(),
            qrToken: qr
        });
        console.log('HOD approved and QR generated:', qr);

        // Final check
        const final = await docRef.get();
        const data = final.data();
        if (data.status !== 'approved' || !data.qrToken) {
            throw new Error('Final status/QR not set correctly');
        }

        console.log('End-to-end flow verification: PASS');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err.message || err);
        process.exit(1);
    }
}

const email = process.argv[2];
if (!email) {
    console.error('Usage: node simulate_and_verify_flow.js <studentEmail>');
    process.exit(1);
}
run(email);
