const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'smvec.ac.in';

// ==================== FIREBASE INITIALIZATION ====================
let db;

function initializeFirebase() {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log('✅ Firebase Admin initialized');
        console.log('✅ Firestore connected');
        autoSeedFaculty();
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
        return false;
    }
}

initializeFirebase();

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeRegisterNo(value) {
    return String(value || '').trim().toUpperCase();
}

function isSmvecEmail(email) {
    return /^[^\s@]+@smvec\.ac\.in$/i.test(String(email || '').trim());
}

function parseBatch(batchValue) {
    const raw = String(batchValue || '').trim();
    if (!raw) {
        return { batchStart: null, batchEnd: null };
    }

    const normalized = raw.replace(/\s+/g, '').replace(/\//g, '-');
    const match = normalized.match(/^(\d{4})-(\d{4})$/);
    if (match) {
        return {
            batchStart: Number(match[1]),
            batchEnd: Number(match[2])
        };
    }

    const singleYearMatch = normalized.match(/^(\d{4})$/);
    if (singleYearMatch) {
        const start = Number(singleYearMatch[1]);
        return {
            batchStart: start,
            batchEnd: start + 4
        };
    }

    return { batchStart: null, batchEnd: null };
}

function normalizeRole(role) {
    if (role === 'classAdvisor') return 'advisor';
    return role;
}

function getDepartmentFromUser(user) {
    if (!user) return '';
    let dept = (user.department || user.handlesDepartment || '').toString().trim().toUpperCase();
    if (dept) return dept;

    const email = String(user.email || '').trim().toLowerCase();
    const match = email.match(/(?:hod|ca|advisor)\.([a-z]+)/i);
    if (match && match[1]) {
        return match[1].toUpperCase();
    }
    return '';
}

async function findMatchingAdvisor({ department, batchStart, batchEnd, section }) {
    try {
        const usersSnapshot = await db.collection('users')
            .where('role', 'in', ['classAdvisor', 'advisor'])
            .get();

        // 1. Try exact match (dept + batchStart + batchEnd + section)
        let match = usersSnapshot.docs.find((doc) => {
            const data = doc.data();
            const dept = getDepartmentFromUser(data);
            const sec = (data.section || data.handlesSection || '').toString();
            const dataBatchStart = data.batchStart ?? data.handlesBatchStart ?? null;
            const dataBatchEnd = data.batchEnd ?? data.handlesBatchEnd ?? null;

            if (dept && sec && dataBatchStart && dataBatchEnd) {
                return dept === department && Number(dataBatchStart) === Number(batchStart) && Number(dataBatchEnd) === Number(batchEnd) && sec === section;
            }

            const handlesYear = data.handlesYear ?? null;
            const handlesSection = data.handlesSection ?? null;
            return dept === department && handlesYear === String(batchStart) && handlesSection === section;
        });

        // 2. Fallback: match by department and section
        if (!match) {
            match = usersSnapshot.docs.find((doc) => {
                const data = doc.data();
                const dept = getDepartmentFromUser(data);
                const sec = (data.section || data.handlesSection || '').toString();
                return dept === department && sec === section;
            });
        }

        // 3. Fallback: match by department alone
        if (!match) {
            match = usersSnapshot.docs.find((doc) => {
                const data = doc.data();
                const dept = getDepartmentFromUser(data);
                return dept === department;
            });
        }

        if (!match) {
            return null;
        }

        return { id: match.id, ...match.data() };
    } catch (err) {
        console.error('findMatchingAdvisor error:', err);
        return null;
    }
}

async function findMatchingHod({ department }) {
    try {
        const usersSnapshot = await db.collection('users')
            .where('role', 'in', ['hod', 'headOfDepartment'])
            .get();

        let match = usersSnapshot.docs.find((doc) => {
            const data = doc.data();
            const dept = getDepartmentFromUser(data);
            return dept === department;
        });

        // Fallback: any HOD if specific department HOD is not found
        if (!match) {
            match = usersSnapshot.docs[0] || null;
        }

        if (!match) {
            return null;
        }

        return { id: match.id, ...match.data() };
    } catch (err) {
        console.error('findMatchingHod error:', err);
        return null;
    }
}

async function autoSeedFaculty() {
    try {
        const existingSnapshot = await db.collection('users')
            .where('role', 'in', ['classAdvisor', 'advisor', 'hod'])
            .limit(1)
            .get();

        if (!existingSnapshot.empty) {
            return; // Faculty already seeded!
        }

        console.log('🌱 Auto-seeding initial faculty accounts...');
        const departments = ['AIDS', 'CSE', 'CCE', 'IT', 'MECH', 'EEE', 'ECE'];
        const batches = [
            { start: 2024, end: 2028 },
            { start: 2023, end: 2027 },
            { start: 2022, end: 2026 },
            { start: 2021, end: 2025 }
        ];

        for (const dept of departments) {
            // Seed HOD
            await db.collection('users').add({
                email: `hod.${dept.toLowerCase()}@smvec.ac.in`,
                name: `Dr. HOD ${dept}`,
                role: 'hod',
                department: dept,
                handlesDepartment: dept,
                phone: '+91 9876543000',
                employeeId: `HOD-${dept}-001`,
                firebaseUid: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Seed CA
            for (const batch of batches) {
                for (const sec of ['A', 'B', 'C', 'D']) {
                    await db.collection('users').add({
                        email: `ca.${dept.toLowerCase()}.${batch.start}.${sec.toLowerCase()}@smvec.ac.in`,
                        name: `Prof. Advisor ${dept} ${sec}`,
                        role: 'classAdvisor',
                        department: dept,
                        handlesDepartment: dept,
                        batchStart: batch.start,
                        batchEnd: batch.end,
                        section: sec,
                        handlesSection: sec,
                        phone: '+91 9876543100',
                        employeeId: `CA-${dept}-${batch.start}-${sec}`,
                        firebaseUid: null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }
        console.log('✅ Faculty auto-seeding completed!');
    } catch (err) {
        console.error('Auto-seed faculty error:', err.message);
    }
}

// ==================== MIDDLEWARE ====================
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_URL
    ],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts. Please try again later.' }
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Verify Firebase ID Token middleware
async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Get user data from Firestore
        const usersSnapshot = await db.collection('users')
            .where('firebaseUid', '==', decodedToken.uid)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            if (decodedToken.email) {
                const normalizedDecodedEmail = normalizeEmail(decodedToken.email);
                const emailSnapshot = await db.collection('users')
                    .where('email', '==', normalizedDecodedEmail)
                    .limit(1)
                    .get();

                if (!emailSnapshot.empty) {
                    const userDoc = emailSnapshot.docs[0];
                    await userDoc.ref.update({ firebaseUid: decodedToken.uid });
                    req.user = {
                        ...decodedToken,
                        dbUser: { id: userDoc.id, ...userDoc.data(), firebaseUid: decodedToken.uid }
                    };
                    return next();
                }
            }
            return res.status(404).json({ error: 'User not found in database' });
        }

        req.user = {
            ...decodedToken,
            dbUser: { id: usersSnapshot.docs[0].id, ...usersSnapshot.docs[0].data() }
        };
        next();
    } catch (error) {
        console.error('Token verification error:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Role check middleware
function requireRole(...roles) {
    const normalizedRoles = roles.map(normalizeRole);

    return (req, res, next) => {
        if (!req.user?.dbUser?.role) {
            return res.status(403).json({ error: 'User role not found' });
        }

        const userRole = normalizeRole(req.user.dbUser.role);
        if (!normalizedRoles.includes(userRole)) {
            return res.status(403).json({
                error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.dbUser.role}`
            });
        }
        next();
    };
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Digital Student Gatepass SMVEC API', timestamp: new Date().toISOString() });
});

// ==================== AUTH ROUTES ====================

// Register student (with @smvec.ac.in validation)
app.post('/api/auth/register-student', authLimiter, async (req, res) => {
    try {
        const {
            email,
            name,
            department,
            batch,
            year,
            semester,
            section,
            registerNo,
            rollNumber,
            phone,
            firebaseUid
        } = req.body;

        const normalizedEmail = normalizeEmail(email);
        const normalizedRegisterNo = normalizeRegisterNo(registerNo || rollNumber);
        const parsedBatch = parseBatch(batch || year);
        const { batchStart, batchEnd } = parsedBatch;

        if (!normalizedEmail || !name || !department || !batchStart || !batchEnd || !section || !normalizedRegisterNo || !phone || !firebaseUid) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!isSmvecEmail(normalizedEmail)) {
            return res.status(400).json({
                error: 'Please use your @smvec.ac.in college email.'
            });
        }

        const existingEmailUser = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
        if (!existingEmailUser.empty) {
            const existingUser = existingEmailUser.docs[0].data();
            const existingFirebaseUid = existingUser.firebaseUid || null;

            if (existingFirebaseUid && existingFirebaseUid !== firebaseUid) {
                return res.status(409).json({ error: 'This email address is already registered to another account.' });
            }

            if (existingFirebaseUid === firebaseUid || !existingFirebaseUid) {
                const existingDoc = existingEmailUser.docs[0];
                await existingDoc.ref.update({
                    name,
                    phone,
                    department,
                    batchStart,
                    batchEnd,
                    section,
                    registerNo: normalizedRegisterNo,
                    rollNumber: normalizedRegisterNo,
                    year: String(batchStart),
                    semester: semester || String(batchStart),
                    firebaseUid,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                return res.status(200).json({
                    success: true,
                    message: 'Registration refreshed successfully',
                    user: { id: existingDoc.id, email: normalizedEmail, firebaseUid, name, department, batchStart, batchEnd, section }
                });
            }
        }

        const existingRegisterNoUser = await db.collection('users')
            .where('registerNo', '==', normalizedRegisterNo)
            .limit(1)
            .get();

        if (!existingRegisterNoUser.empty) {
            return res.status(409).json({ error: 'This registration number is already registered.' });
        }

        const legacyRegisterNoUser = await db.collection('users')
            .where('rollNumber', '==', normalizedRegisterNo)
            .limit(1)
            .get();

        if (!legacyRegisterNoUser.empty) {
            return res.status(409).json({ error: 'This registration number is already registered.' });
        }

        const matchedAdvisor = await findMatchingAdvisor({
            department,
            batchStart,
            batchEnd,
            section
        });

        const matchedHod = await findMatchingHod({ department });

        const assignedAdvisorId = matchedAdvisor ? matchedAdvisor.id : null;
        const assignedHodId = matchedHod ? matchedHod.id : null;

        const userData = {
            email: normalizedEmail,
            name,
            phone,
            role: 'student',
            department,
            batchStart,
            batchEnd,
            section,
            registerNo: normalizedRegisterNo,
            rollNumber: normalizedRegisterNo,
            year: String(batchStart),
            semester: semester || String(batchStart),
            firebaseUid,
            assignedAdvisorId,
            assignedHodId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('users').add(userData);

        console.log(`✅ Student registered: ${name} (${normalizedEmail})`);
        console.log(`   Assigned CA: ${assignedAdvisorId || 'None'}, HOD: ${assignedHodId || 'None'}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: { id: docRef.id, ...userData },
            warnings: {
                noAdvisor: !assignedAdvisorId ? `No CA found for ${department} Batch ${batchStart}-${batchEnd} Section ${section}` : null,
                noHod: !assignedHodId ? `No HOD found for ${department}` : null
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check if email exists (for Google OAuth registration flow)
app.post('/api/auth/check-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const normalizedEmail = normalizeEmail(email);
        const usersSnapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();

        res.json({
            exists: !usersSnapshot.empty,
            user: usersSnapshot.empty ? null : { id: usersSnapshot.docs[0].id, ...usersSnapshot.docs[0].data() }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current user profile
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const user = req.user.dbUser;
        const inferredDept = getDepartmentFromUser(user);
        if (inferredDept && (!user.department || !user.handlesDepartment)) {
            user.department = user.department || inferredDept;
            user.handlesDepartment = user.handlesDepartment || inferredDept;
            await db.collection('users').doc(user.id).update({
                department: user.department,
                handlesDepartment: user.handlesDepartment
            }).catch(e => console.error('Failed to auto-patch user department:', e.message));
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate role before login
app.post('/api/auth/validate-role', async (req, res) => {
    try {
        const { email, expectedRole } = req.body;

        if (!email || !expectedRole) {
            return res.status(400).json({ error: 'Email and expected role are required' });
        }

        const normalizedEmail = normalizeEmail(email);
        const usersSnapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();

        if (usersSnapshot.empty) {
            // For students, they might not exist yet (need to register)
            if (expectedRole === 'student') {
                return res.json({ valid: false, needsRegistration: true });
            }
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = usersSnapshot.docs[0].data();
        const normalizedUserRole = normalizeRole(userData.role);
        const normalizedExpectedRole = normalizeRole(expectedRole);
        const isValid = normalizedUserRole === normalizedExpectedRole;

        if (!isValid) {
            const roleNames = {
                student: 'Student',
                advisor: 'Class Advisor',
                classAdvisor: 'Class Advisor',
                hod: 'Head of Department',
                security: 'Security Staff'
            };
            return res.json({
                valid: false,
                error: `You are registered as ${roleNames[userData.role] || userData.role}, not ${roleNames[normalizedExpectedRole] || normalizedExpectedRole}. Please select the correct portal.`
            });
        }

        res.json({ valid: true, user: { id: usersSnapshot.docs[0].id, ...userData } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Link Firebase UID to existing user (for faculty login)
app.post('/api/auth/link-firebase', async (req, res) => {
    try {
        const { email, firebaseUid } = req.body;

        const normalizedEmail = normalizeEmail(email);
        const usersSnapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();

        if (usersSnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDoc = usersSnapshot.docs[0];
        await userDoc.ref.update({ firebaseUid });

        res.json({ success: true, user: { id: userDoc.id, ...userDoc.data(), firebaseUid } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STUDENT ROUTES ====================

function normalizeDateTime(dateValue, timeValue) {
    if (!dateValue) return null;

    // Allow already-combined ISO timestamps from the frontend.
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
        return dateValue;
    }

    if (!timeValue) {
        return dateValue;
    }

    const combined = new Date(`${dateValue}T${timeValue}:00`);
    return Number.isNaN(combined.getTime()) ? dateValue : combined.toISOString();
}

// Create gate pass request
app.post('/api/student/request', verifyToken, requireRole('student'), async (req, res) => {
    try {
        const {
            reason,
            destination,
            exitDate,
            exitTime,
            expectedReturnTime,
            contactNumber
        } = req.body;
        const student = req.user.dbUser;

        // Validation
        if (!reason) return res.status(400).json({ error: 'Reason is required' });
        if (!destination) return res.status(400).json({ error: 'Destination is required' });
        if (!exitDate) return res.status(400).json({ error: 'Exit date is required' });
        if (!exitTime) return res.status(400).json({ error: 'Exit time is required' });
        if (!contactNumber) return res.status(400).json({ error: 'Contact number is required' });

        if (reason.length < 10) {
            return res.status(400).json({ error: 'Reason must be at least 10 characters' });
        }

        const normalizedExitDate = normalizeDateTime(exitDate, exitTime);

        // Dynamically resolve advisor and HOD IDs if missing on student record
        let advisorId = student.assignedAdvisorId || null;
        let hodId = student.assignedHodId || null;

        if (!advisorId) {
            const matchedAdvisor = await findMatchingAdvisor({
                department: student.department,
                batchStart: student.batchStart || student.year,
                batchEnd: student.batchEnd,
                section: student.section
            });
            if (matchedAdvisor) advisorId = matchedAdvisor.id;
        }

        if (!hodId) {
            const matchedHod = await findMatchingHod({ department: student.department });
            if (matchedHod) hodId = matchedHod.id;
        }

        // Create request
        const requestData = {
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            studentRollNumber: student.rollNumber || student.registerNo || '',
            department: student.department,
            year: student.year || String(student.batchStart || ''),
            section: student.section,

            reason,
            destination,
            exitDate: normalizedExitDate,
            exitTime: exitTime || null,
            expectedReturnDate: null,
            expectedReturnTime: expectedReturnTime || null,
            contactNumber,

            status: 'pending_advisor',

            advisorId,
            advisorStatus: 'pending',
            advisorRemarks: null,
            advisorActionAt: null,

            hodId,
            hodStatus: 'pending',
            hodRemarks: null,
            hodActionAt: null,

            qrToken: null,
            qrUsed: false,
            usedAt: null,
            usedBy: null,

            appliedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('gate_requests').add(requestData);

        console.log(`📝 New gate pass request: ${student.name} (${student.rollNumber || student.registerNo})`);

        res.status(201).json({
            success: true,
            message: 'Gate pass request submitted to your Class Advisor',
            request: { id: docRef.id, ...requestData }
        });
    } catch (error) {
        console.error('Create request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get student's own requests
app.get('/api/student/requests', verifyToken, requireRole('student'), async (req, res) => {
    try {
        const student = req.user.dbUser;

        const requestsSnapshot = await db.collection('gate_requests')
            .where('studentId', '==', student.id)
            .get();

        const requests = requestsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || null,
                appliedAt: doc.data().appliedAt?.toDate?.() || null
            }))
            .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });

        res.json({ requests });
    } catch (error) {
        console.error('Get student requests error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADVISOR (CA) ROUTES ====================

// Get pending requests for advisor's class
app.get('/api/advisor/requests', verifyToken, requireRole('advisor'), async (req, res) => {
    try {
        const advisor = req.user.dbUser;
        const advisorDept = getDepartmentFromUser(advisor);
        const advisorSec = (advisor.section || advisor.handlesSection || '').toString().toUpperCase();

        const requestsSnapshot = await db.collection('gate_requests')
            .where('status', '==', 'pending_advisor')
            .get();

        const requests = requestsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || null,
                appliedAt: doc.data().appliedAt?.toDate?.() || null
            }))
            .filter(r => {
                if (r.advisorId && r.advisorId === advisor.id) return true;
                const reqDept = (r.department || '').toString().toUpperCase();
                const reqSec = (r.section || '').toString().toUpperCase();
                if (advisorDept && reqDept && advisorDept !== reqDept) return false;
                if (advisorSec && reqSec && advisorSec !== reqSec) return false;
                return true;
            })
            .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });

        res.json({ requests });
    } catch (error) {
        console.error('Get advisor requests error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get complete history of all gate pass requests for advisor's class (all statuses)
app.get('/api/advisor/history', verifyToken, requireRole('advisor'), async (req, res) => {
    try {
        const advisor = req.user.dbUser;
        const advisorDept = getDepartmentFromUser(advisor);
        const advisorSec = (advisor.section || advisor.handlesSection || '').toString().toUpperCase();

        // Fetch ALL requests (no status filter)
        const requestsSnapshot = await db.collection('gate_requests').get();

        const requests = requestsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || null,
                appliedAt: doc.data().appliedAt?.toDate?.() || null,
                advisorActionAt: doc.data().advisorActionAt?.toDate?.() || null,
                hodActionAt: doc.data().hodActionAt?.toDate?.() || null,
                usedAt: doc.data().usedAt?.toDate?.() || null
            }))
            .filter(r => {
                // Match by assigned advisorId first (most accurate)
                if (r.advisorId && r.advisorId === advisor.id) return true;
                // Fall back to dept + section match
                const reqDept = (r.department || '').toString().toUpperCase();
                const reqSec = (r.section || '').toString().toUpperCase();
                if (advisorDept && reqDept && advisorDept !== reqDept) return false;
                if (advisorSec && reqSec && advisorSec !== reqSec) return false;
                return true;
            })
            .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });

        res.json({ requests });
    } catch (error) {
        console.error('Get advisor history error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Advisor approve request
app.post('/api/advisor/approve/:id', verifyToken, requireRole('advisor'), async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const advisor = req.user.dbUser;

        const requestRef = db.collection('gate_requests').doc(id);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const requestData = requestDoc.data();
        const advisorDept = getDepartmentFromUser(advisor);
        const reqDept = (requestData.department || '').toString().toUpperCase();
        const isAuthorizedAdvisor = (requestData.advisorId === advisor.id) || (!requestData.advisorId) || (!advisorDept) || (advisorDept && reqDept && advisorDept === reqDept);

        if (!isAuthorizedAdvisor) {
            return res.status(403).json({ error: 'Not authorized to approve this request' });
        }

        // Dynamically resolve HOD ID if missing
        let targetHodId = requestData.hodId || null;
        if (!targetHodId) {
            const matchedHod = await findMatchingHod({ department: requestData.department });
            if (matchedHod) targetHodId = matchedHod.id;
        }

        // Update request - forward to HOD
        await requestRef.update({
            status: 'pending_hod',
            advisorStatus: 'approved',
            advisorRemarks: remarks || 'Approved',
            advisorActionAt: admin.firestore.FieldValue.serverTimestamp(),
            hodId: targetHodId || requestData.hodId || null
        });

        console.log(`✅ CA approved request ${id} - forwarded to HOD (assigned HOD ID: ${targetHodId || 'All HODs in dept'})`);

        res.json({ success: true, message: 'Request approved and forwarded to HOD' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Advisor reject request
app.post('/api/advisor/reject/:id', verifyToken, requireRole('advisor'), async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const advisor = req.user.dbUser;

        if (!remarks || remarks.length < 5) {
            return res.status(400).json({ error: 'Rejection remarks are required (min 5 characters)' });
        }

        const requestRef = db.collection('gate_requests').doc(id);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const requestData = requestDoc.data();
        const advisorDept = getDepartmentFromUser(advisor);
        const reqDept = (requestData.department || '').toString().toUpperCase();
        const isAuthorizedAdvisor = (requestData.advisorId === advisor.id) || (!requestData.advisorId) || (!advisorDept) || (advisorDept && reqDept && advisorDept === reqDept);

        if (!isAuthorizedAdvisor) {
            return res.status(403).json({ error: 'Not authorized to reject this request' });
        }

        await requestRef.update({
            status: 'rejected',
            advisorStatus: 'rejected',
            advisorRemarks: remarks,
            advisorActionAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`❌ CA rejected request ${id}`);

        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== HOD ROUTES ====================

// Get pending requests for HOD's department
app.get('/api/hod/requests', verifyToken, requireRole('hod'), async (req, res) => {
    try {
        const hod = req.user.dbUser;
        const hodDept = getDepartmentFromUser(hod);

        const requestsSnapshot = await db.collection('gate_requests')
            .where('status', '==', 'pending_hod')
            .get();

        const requests = requestsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || null,
                appliedAt: doc.data().appliedAt?.toDate?.() || null
            }))
            .filter(r => {
                if (r.hodId && r.hodId === hod.id) return true;
                const reqDept = (r.department || '').toString().toUpperCase();
                if (hodDept) {
                    return !reqDept || reqDept === hodDept;
                }
                return true;
            })
            .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });

        res.json({ requests });
    } catch (error) {
        console.error('Get HOD requests error:', error);
        res.status(500).json({ error: error.message });
    }
});

// HOD approve request - generates QR code
app.post('/api/hod/approve/:id', verifyToken, requireRole('hod'), async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const hod = req.user.dbUser;

        const requestRef = db.collection('gate_requests').doc(id);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const requestData = requestDoc.data();
        const hodDept = getDepartmentFromUser(hod);
        const reqDept = (requestData.department || '').toString().toUpperCase();
        const isAuthorizedHod = (requestData.hodId === hod.id) || (!requestData.hodId) || (!hodDept) || (hodDept && reqDept && hodDept === reqDept);

        if (!isAuthorizedHod) {
            return res.status(403).json({ error: 'Not authorized to approve this request' });
        }

        // Generate unique QR token
        const qrToken = uuidv4();

        // Update request
        await requestRef.update({
            status: 'approved',
            hodStatus: 'approved',
            hodRemarks: remarks || 'Approved',
            hodActionAt: admin.firestore.FieldValue.serverTimestamp(),
            qrToken
        });

        console.log(`✅ HOD approved request ${id} - QR generated`);

        res.json({
            success: true,
            message: 'Request approved. QR code generated for student.',
            qrToken
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// HOD reject request
app.post('/api/hod/reject/:id', verifyToken, requireRole('hod'), async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const hod = req.user.dbUser;

        if (!remarks || remarks.length < 5) {
            return res.status(400).json({ error: 'Rejection remarks are required (min 5 characters)' });
        }

        const requestRef = db.collection('gate_requests').doc(id);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const requestData = requestDoc.data();
        const hodDept = getDepartmentFromUser(hod);
        const reqDept = (requestData.department || '').toString().toUpperCase();
        const isAuthorizedHod = (requestData.hodId === hod.id) || (!requestData.hodId) || (!hodDept) || (hodDept && reqDept && hodDept === reqDept);

        if (!isAuthorizedHod) {
            return res.status(403).json({ error: 'Not authorized to reject this request' });
        }

        await requestRef.update({
            status: 'rejected',
            hodStatus: 'rejected',
            hodRemarks: remarks,
            hodActionAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`❌ HOD rejected request ${id}`);

        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SECURITY ROUTES ====================

// Verify and mark QR as used
app.post('/api/security/verify-qr', verifyToken, requireRole('security'), async (req, res) => {
    try {
        const { qrToken } = req.body;
        const security = req.user.dbUser;

        if (!qrToken) {
            return res.status(400).json({ error: 'QR token is required' });
        }

        // Find request by QR token
        const requestsSnapshot = await db.collection('gate_requests')
            .where('qrToken', '==', qrToken)
            .limit(1)
            .get();

        if (requestsSnapshot.empty) {
            return res.status(404).json({ error: 'Invalid QR code', valid: false });
        }

        const requestDoc = requestsSnapshot.docs[0];
        const requestData = requestDoc.data();

        // Check if already used
        if (requestData.qrUsed) {
            return res.json({
                valid: false,
                error: 'This QR code has already been used',
                usedAt: requestData.usedAt?.toDate?.(),
                request: requestData
            });
        }

        // Check if approved
        if (requestData.status !== 'approved') {
            return res.json({
                valid: false,
                error: `Request is not approved. Current status: ${requestData.status}`,
                request: requestData
            });
        }

        // Mark as used
        await requestDoc.ref.update({
            status: 'used',
            qrUsed: true,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            usedBy: security.id
        });

        // Log the scan
        await db.collection('scan_logs').add({
            requestId: requestDoc.id,
            studentId: requestData.studentId,
            studentName: requestData.studentName,
            studentRollNumber: requestData.studentRollNumber,
            scannedBy: security.id,
            scannedByName: security.name,
            scanTime: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`🔓 Gate pass used: ${requestData.studentName} (${requestData.studentRollNumber})`);

        res.json({
            valid: true,
            message: 'Gate pass verified successfully',
            student: {
                name: requestData.studentName,
                rollNumber: requestData.studentRollNumber,
                department: requestData.department,
                year: requestData.year,
                section: requestData.section
            },
            request: {
                reason: requestData.reason,
                destination: requestData.destination,
                exitDate: requestData.exitDate,
                expectedReturnDate: requestData.expectedReturnDate
            }
        });
    } catch (error) {
        console.error('QR verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get scan history
app.get('/api/security/scan-history', verifyToken, requireRole('security'), async (req, res) => {
    try {
        const security = req.user.dbUser;

        const logsSnapshot = await db.collection('scan_logs')
            .where('scannedBy', '==', security.id)
            .get();

        const logs = logsSnapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                scanTime: doc.data().scanTime?.toDate?.() || null
            }))
            .sort((a, b) => {
                const timeA = a.scanTime ? new Date(a.scanTime).getTime() : 0;
                const timeB = b.scanTime ? new Date(b.scanTime).getTime() : 0;
                return timeB - timeA;
            })
            .slice(0, 50);

        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN ROUTES ====================

// Middleware: protect admin endpoints with a secret key
function requireAdminSecret(req, res, next) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
        // If no secret is configured, block all admin access
        return res.status(403).json({ error: 'Admin endpoint is disabled (ADMIN_SECRET not configured)' });
    }
    const provided = req.headers['x-admin-secret'] || req.body?.adminSecret;
    if (provided !== secret) {
        return res.status(403).json({ error: 'Invalid admin secret' });
    }
    next();
}

// Import faculty (CA/HOD) - bulk or single
app.post('/api/admin/import-faculty', requireAdminSecret, async (req, res) => {
    try {
        const { faculty } = req.body;

        if (!Array.isArray(faculty) || faculty.length === 0) {
            return res.status(400).json({ error: 'Faculty array is required' });
        }

        const results = [];

        for (const f of faculty) {
            const { email, name, phone, role, department, year, section, batchStart, batchEnd, employeeId, password } = f;

            if (!email || !name || !role || !department) {
                results.push({ email, success: false, error: 'Missing required fields' });
                continue;
            }

            // Check if exists
            const existing = await db.collection('users').where('email', '==', email).limit(1).get();
            if (!existing.empty) {
                results.push({ email, success: false, error: 'User already exists' });
                continue;
            }

            const normalizedRole = role === 'advisor' ? 'classAdvisor' : role;
            const userData = {
                email,
                name,
                phone: phone || '',
                role: normalizedRole,
                employeeId: employeeId || '',
                department,
                batchStart: batchStart ?? null,
                batchEnd: batchEnd ?? null,
                handlesDepartment: department,
                handlesYear: year || null,
                handlesSection: section || null,
                section: section || null,
                firebaseUid: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('users').add(userData);
            results.push({ email, success: true, id: docRef.id });

            console.log(`✅ Faculty added: ${name} (${role}) - ${department}`);
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all faculty
app.get('/api/admin/faculty', requireAdminSecret, async (req, res) => {
    try {
        const facultySnapshot = await db.collection('users')
            .where('role', 'in', ['classAdvisor', 'advisor', 'hod', 'security'])
            .get();

        const faculty = facultySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ faculty });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seed sample faculty data
app.post('/api/admin/seed-faculty', requireAdminSecret, async (req, res) => {
    try {
        const sampleFaculty = [
            // HODs
            { email: 'hod.cse@smvec.ac.in', name: 'Dr. Ramesh Kumar', role: 'hod', department: 'CSE', phone: '+91 9876543001', employeeId: 'HOD-CSE-001' },
            { email: 'hod.ece@smvec.ac.in', name: 'Dr. Sunita Devi', role: 'hod', department: 'ECE', phone: '+91 9876543002', employeeId: 'HOD-ECE-001' },
            { email: 'hod.it@smvec.ac.in', name: 'Dr. Vijay Sharma', role: 'hod', department: 'IT', phone: '+91 9876543003', employeeId: 'HOD-IT-001' },
            { email: 'hod.eee@smvec.ac.in', name: 'Dr. Lakshmi Priya', role: 'hod', department: 'EEE', phone: '+91 9876543004', employeeId: 'HOD-EEE-001' },
            { email: 'hod.mech@smvec.ac.in', name: 'Dr. Arun Kumar', role: 'hod', department: 'MECH', phone: '+91 9876543005', employeeId: 'HOD-MECH-001' },

            // Class Advisors - CSE
            { email: 'ca.cse.3a@smvec.ac.in', name: 'Prof. Deepa Krishnan', role: 'classAdvisor', department: 'CSE', batchStart: 2024, batchEnd: 2028, section: 'A', phone: '+91 9876543101', employeeId: 'CA-CSE-3A' },
            { email: 'ca.cse.3b@smvec.ac.in', name: 'Prof. Karthik Rajan', role: 'classAdvisor', department: 'CSE', batchStart: 2024, batchEnd: 2028, section: 'B', phone: '+91 9876543102', employeeId: 'CA-CSE-3B' },
            { email: 'ca.cse.2a@smvec.ac.in', name: 'Prof. Meena Sundari', role: 'classAdvisor', department: 'CSE', batchStart: 2023, batchEnd: 2027, section: 'A', phone: '+91 9876543103', employeeId: 'CA-CSE-2A' },
            { email: 'ca.cse.4a@smvec.ac.in', name: 'Prof. Sanjay Kumar', role: 'classAdvisor', department: 'CSE', batchStart: 2025, batchEnd: 2029, section: 'A', phone: '+91 9876543104', employeeId: 'CA-CSE-4A' },

            // Class Advisors - IT
            { email: 'ca.it.2428a@smvec.ac.in', name: 'Prof. Arun Kumar', role: 'classAdvisor', department: 'IT', batchStart: 2024, batchEnd: 2028, section: 'A', phone: '+91 9876543401', employeeId: 'CA-IT-2428A' },

            // Class Advisors - ECE
            { email: 'ca.ece.3a@smvec.ac.in', name: 'Prof. Anitha Raj', role: 'classAdvisor', department: 'ECE', batchStart: 2024, batchEnd: 2028, section: 'A', phone: '+91 9876543201', employeeId: 'CA-ECE-3A' },
            { email: 'ca.ece.2a@smvec.ac.in', name: 'Prof. Bala Murugan', role: 'classAdvisor', department: 'ECE', batchStart: 2023, batchEnd: 2027, section: 'A', phone: '+91 9876543202', employeeId: 'CA-ECE-2A' },

            // Security (four gate security accounts)
            { email: 'security.gate1@smvec.ac.in', name: 'Gate Security 1', role: 'security', department: 'Security', phone: '+91 9876543301', employeeId: 'SEC-G1' },
            { email: 'security.gate2@smvec.ac.in', name: 'Gate Security 2', role: 'security', department: 'Security', phone: '+91 9876543302', employeeId: 'SEC-G2' },
            { email: 'security.gate3@smvec.ac.in', name: 'Gate Security 3', role: 'security', department: 'Security', phone: '+91 9876543303', employeeId: 'SEC-G3' },
            { email: 'security.gate4@smvec.ac.in', name: 'Gate Security 4', role: 'security', department: 'Security', phone: '+91 9876543304', employeeId: 'SEC-G4' }
        ];

        const results = [];

        for (const f of sampleFaculty) {
            const existing = await db.collection('users').where('email', '==', f.email).limit(1).get();
            if (!existing.empty) {
                results.push({ email: f.email, status: 'exists' });
                continue;
            }

            await db.collection('users').add({
                ...f,
                department: f.department,
                batchStart: f.batchStart ?? null,
                batchEnd: f.batchEnd ?? null,
                section: f.section || null,
                handlesDepartment: f.department,
                handlesYear: f.year || (f.batchStart ? String(f.batchStart) : null),
                handlesSection: f.section || null,
                firebaseUid: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            results.push({ email: f.email, status: 'created' });
        }

        res.json({ success: true, message: 'Sample faculty seeded', results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ERROR HANDLING ====================
app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.path}` });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Digital Student Gatepass SMVEC Server running on port ${PORT}`);
        console.log(`📡 API URL: http://localhost:${PORT}/api`);
        console.log(`📧 Allowed email domain: @${ALLOWED_EMAIL_DOMAIN}`);
        console.log(`\n✨ Ready to accept requests!\n`);
    });
}

module.exports = app;
