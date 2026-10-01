const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function parseBatchFromRoll(roll) {
    // Example roll: 24UIT004 or similar where leading two digits are year (24 -> 2024)
    if (!roll) return null;
    const m = String(roll).match(/^(\d{2})/);
    if (!m) return null;
    const yy = Number(m[1]);
    const year = yy > 50 ? 1900 + yy : 2000 + yy; // naive century
    return { batchStart: year, batchEnd: year + 4 };
}

async function main() {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        const db = admin.firestore();

        // Load all students without assignedAdvisorId
        const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
        console.log(`Found ${studentsSnap.size} students`);

        let updated = 0;
        for (const s of studentsSnap.docs) {
            const data = s.data();
            const needsAdvisor = !data.assignedAdvisorId;
            if (!needsAdvisor) continue;

            // Try to compute batchStart/batchEnd
            let batchStart = data.batchStart ?? null;
            let batchEnd = data.batchEnd ?? null;

            if (!batchStart && data.rollNumber) {
                const parsed = parseBatchFromRoll(data.rollNumber);
                if (parsed) {
                    batchStart = parsed.batchStart;
                    batchEnd = parsed.batchEnd;
                }
            }

            if (!batchStart && data.year) {
                // year may be '3' meaning 3rd year; infer admission year from current year - (year-1)
                const numericYear = Number(data.year);
                if (!Number.isNaN(numericYear)) {
                    const currentYear = new Date().getFullYear();
                    const admission = currentYear - (numericYear + 0); // rough
                    batchStart = admission;
                    batchEnd = admission + 4;
                }
            }

            if (!batchStart) {
                // can't determine
                continue;
            }

            // Find advisor matching dept + batchStart + section
            const advisorsSnap = await db.collection('users').where('role', 'in', ['classAdvisor','advisor']).get();
            let match = advisorsSnap.docs.find((doc) => {
                const ad = doc.data();
                const dept = (ad.department || ad.handlesDepartment || '').toString();
                const sec = (ad.section || ad.handlesSection || '').toString();
                const adBatchStart = ad.batchStart ?? ad.handlesBatchStart ?? null;
                const adBatchEnd = ad.batchEnd ?? ad.handlesBatchEnd ?? null;
                if (dept && sec && adBatchStart && adBatchEnd) {
                    return dept === data.department && Number(adBatchStart) === Number(batchStart) && Number(adBatchEnd) === Number(batchEnd) && sec === data.section;
                }
                const handlesYear = ad.handlesYear ?? null;
                const handlesSection = ad.handlesSection ?? null;
                return dept === data.department && handlesYear === String(batchStart) && handlesSection === data.section;
            });

            if (!match) {
                match = advisorsSnap.docs.find((doc) => {
                    const ad = doc.data();
                    const dept = (ad.department || ad.handlesDepartment || '').toString();
                    const sec = (ad.section || ad.handlesSection || '').toString();
                    return dept === data.department && sec === data.section;
                });
            }

            if (!match) {
                match = advisorsSnap.docs.find((doc) => {
                    const ad = doc.data();
                    const dept = (ad.department || ad.handlesDepartment || '').toString();
                    return dept === data.department;
                });
            }

            if (!match) continue;

            const advisorId = match.id;

            await s.ref.update({
                batchStart,
                batchEnd,
                assignedAdvisorId: advisorId,
                assignedHodId: match.data().assignedHodId || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update existing requests for student to set advisorId if null
            const requestsSnap = await db.collection('gate_requests').where('studentId', '==', s.id).get();
            for (const r of requestsSnap.docs) {
                const rd = r.data();
                if (!rd.advisorId) {
                    await r.ref.update({ advisorId });
                }
            }

            updated++;
            console.log(`Updated student ${s.id} assignedAdvisorId=${advisorId}`);
        }

        console.log(`Done. Updated ${updated} students`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

main();
