const admin = require('firebase-admin');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
    const studentEmail = process.argv[2];
    if (!studentEmail) {
        console.error('Usage: node simulate_flow.js <studentEmail>');
        process.exit(1);
    }

    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        const normalized = String(studentEmail).trim().toLowerCase();
        const usersSnapshot = await db.collection('users').where('email', '==', normalized).limit(1).get();
        if (usersSnapshot.empty) {
            console.error('Student not found:', normalized);
            process.exit(2);
        }

        const studentDoc = usersSnapshot.docs[0];
        const student = { id: studentDoc.id, ...studentDoc.data() };
        if (!student.assignedAdvisorId) {
            console.error('Student has no assignedAdvisorId; cannot forward to CA.');
        }
        if (!student.assignedHodId) {
            console.error('Student has no assignedHodId; cannot forward to HOD.');
        }

        // Create request
        const now = admin.firestore.FieldValue.serverTimestamp();
        const requestData = {
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            studentRollNumber: student.rollNumber || student.registerNo || null,
            department: student.department || null,
            year: student.year || null,
            section: student.section || null,

            reason: 'Simulated request - testing full flow',
            destination: 'Home',
            exitDate: new Date().toISOString(),
            exitTime: null,
            expectedReturnDate: null,
            expectedReturnTime: null,
            contactNumber: student.phone || '',

            status: 'pending_advisor',

            advisorId: student.assignedAdvisorId || null,
            advisorStatus: 'pending',
            advisorRemarks: null,
            advisorActionAt: null,

            hodId: student.assignedHodId || null,
            hodStatus: 'pending',
            hodRemarks: null,
            hodActionAt: null,

            qrToken: null,
            qrUsed: false,
            usedAt: null,
            usedBy: null,

            appliedAt: now,
            createdAt: now
        };

        const docRef = await db.collection('gate_requests').add(requestData);
        console.log('Created request:', docRef.id);

        // Simulate CA approval (advisor)
        if (requestData.advisorId) {
            await docRef.update({
                status: 'pending_hod',
                advisorStatus: 'approved',
                advisorRemarks: 'Auto-approved by simulation',
                advisorActionAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('Advisor approved and forwarded to HOD');
        } else {
            console.warn('No advisorId on request; cannot perform advisor approval step');
        }

        // Simulate HOD approval
        if (requestData.hodId) {
            const qr = uuidv4();
            await docRef.update({
                status: 'approved',
                hodStatus: 'approved',
                hodRemarks: 'Auto-approved by simulation',
                hodActionAt: admin.firestore.FieldValue.serverTimestamp(),
                qrToken: qr
            });
            console.log('HOD approved and QR generated:', qr);
        } else {
            console.warn('No hodId on request; cannot perform HOD approval step');
        }

        // Print final doc
        const finalDoc = await docRef.get();
        console.log('Final request data:', { id: finalDoc.id, ...finalDoc.data() });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
