import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  GraduationCap, 
  Users, 
  UserCog, 
  Shield,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { ToastContainer, useToast } from '../components/Toast';

const roles = [
  {
    id: 'student',
    name: 'Student',
    description: 'Request gate passes',
    icon: GraduationCap,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'advisor',
    name: 'Class Advisor',
    description: 'Approve student requests',
    icon: Users,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'hod',
    name: 'HOD',
    description: 'Final approval authority',
    icon: UserCog,
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Verify gate passes',
    icon: Shield,
    color: 'from-emerald-500 to-green-500',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginWithEmail, registerWithEmail, loginWithGoogle, setSelectedRole, refreshUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [step, setStep] = useState('role'); // role, login, register
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Registration form
  const [regForm, setRegForm] = useState({
    name: '',
    department: '',
    batch: '',
    section: '',
    registerNo: '',
    phone: '',
  });

  const handleRoleSelect = (roleId) => {
    setSelectedRoleId(roleId);
    setStep('login');
  };

  const handleBack = () => {
    if (step === 'register') {
      setStep('login');
      setGoogleUser(null);
    } else {
      setStep('role');
      setSelectedRoleId(null);
    }
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.endsWith('@smvec.ac.in')) {
        addToast('Please use your @smvec.ac.in college email.', 'error');
        setLoading(false);
        return;
      }

      const { auth } = await import('../config/firebase');
      if (auth.currentUser && (auth.currentUser.email || '').trim().toLowerCase() !== normalizedEmail) {
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
      }

      // 1. Check if user profile exists in backend for the selected role
      let roleCheck = null;
      try {
        roleCheck = await api.validateRole(normalizedEmail, selectedRoleId);
      } catch (err) {
        console.error('Role validation check:', err);
      }

      // 2. Attempt Firebase login
      let firebaseUser = null;
      try {
        firebaseUser = await loginWithEmail(normalizedEmail, password);
      } catch (loginErr) {
        console.error('Login attempt failed:', loginErr);

        if (loginErr.code === 'auth/user-not-found') {
          // Firebase Auth user does not exist. Check if user is pre-seeded in Firestore:
          if (roleCheck && roleCheck.user) {
            try {
              // Create Firebase Auth user for pre-seeded account and link it
              const newAuthUser = await registerWithEmail(normalizedEmail, password);
              await api.linkFirebase(normalizedEmail, newAuthUser.uid);
              setSelectedRole(selectedRoleId);
              await refreshUser();
              addToast('Login successful! Account initialized.', 'success');
              navigateToDashboard(selectedRoleId);
              return;
            } catch (autoRegErr) {
              console.error('Auto-registration error for seeded user:', autoRegErr);
              addToast('Failed to initialize account credentials.', 'error');
              return;
            }
          } else {
            if (selectedRoleId === 'student') {
              addToast('No account found with this email. If you are a new student, please click "Register here".', 'error');
            } else {
              addToast('No faculty account found for this email. Please contact administrator.', 'error');
            }
            return;
          }
        } else if (loginErr.code === 'auth/wrong-password' || loginErr.code === 'auth/invalid-credential') {
          addToast('Incorrect email or password.', 'error');
          return;
        } else {
          throw loginErr;
        }
      }

      // 3. Validate role / ensure user has Firestore profile after successful Firebase login
      if (!roleCheck || !roleCheck.valid) {
        if (roleCheck?.needsRegistration && selectedRoleId === 'student') {
          addToast('Please complete your student registration details.', 'info');
          setStep('register');
          return;
        }
        addToast(roleCheck?.error || 'Invalid role for this account', 'error');
        return;
      }

      // Link Firebase UID if needed
      if (auth.currentUser) {
        await api.linkFirebase(normalizedEmail, auth.currentUser.uid);
      }

      setSelectedRole(selectedRoleId);
      await refreshUser();

      addToast('Login successful!', 'success');
      navigateToDashboard(selectedRoleId);
    } catch (error) {
      console.error('Login error:', error);
      addToast(error.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      const user = await loginWithGoogle();
      
      // Check if user exists and validate role
      const emailCheck = await api.checkEmail(user.email);
      
      if (emailCheck.exists) {
        // User exists, validate role
        const roleCheck = await api.validateRole(user.email, selectedRoleId);
        
        if (!roleCheck.valid) {
          addToast(roleCheck.error || 'Invalid role for this account', 'error');
          const { auth } = await import('../config/firebase');
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        // Link Firebase UID
        await api.linkFirebase(user.email, user.uid);
        setSelectedRole(selectedRoleId);
        await refreshUser();
        
        addToast('Login successful!', 'success');
        navigateToDashboard(selectedRoleId);
      } else {
        // New user - only students can register
        if (selectedRoleId !== 'student') {
          addToast('Only students can register. Please contact admin for faculty/staff accounts.', 'error');
          const { auth } = await import('../config/firebase');
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        // Validate email domain for students
        if (!user.email.endsWith('@smvec.ac.in')) {
          addToast('Only @smvec.ac.in email addresses are allowed for student registration', 'error');
          const { auth } = await import('../config/firebase');
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        // Proceed to registration
        const googleEmail = (user.email || '').trim().toLowerCase();
        if (!googleEmail.endsWith('@smvec.ac.in')) {
          addToast('Please use your @smvec.ac.in college email.', 'error');
          const { auth } = await import('../config/firebase');
          await auth.signOut();
          setLoading(false);
          return;
        }

        setGoogleUser(user);
        setEmail(googleEmail);
        setRegForm((prev) => ({ ...prev, name: user.displayName || '' }));
        setStep('register');
      }
    } catch (error) {
      console.error('Google login error:', error);
      addToast(error.message || 'Google login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.endsWith('@smvec.ac.in')) {
        addToast('Please use your @smvec.ac.in college email.', 'error');
        setLoading(false);
        return;
      }

      if (!googleUser && password !== confirmPassword) {
        addToast('Passwords do not match', 'error');
        setLoading(false);
        return;
      }

      if (!regForm.name || !regForm.department || !regForm.batch || !regForm.section || !regForm.registerNo || !regForm.phone) {
        addToast('Please fill all required fields', 'error');
        setLoading(false);
        return;
      }

      let firebaseUid;
      const { auth } = await import('../config/firebase');

      const currentEmail = (auth.currentUser?.email || '').trim().toLowerCase();
      const isSameUser = auth.currentUser && currentEmail === normalizedEmail;

      if (isSameUser) {
        firebaseUid = auth.currentUser.uid;
      } else if (googleUser && (googleUser.email || '').trim().toLowerCase() === normalizedEmail) {
        firebaseUid = googleUser.uid;
      } else {
        if (auth.currentUser) {
          const { signOut } = await import('firebase/auth');
          await signOut(auth);
        }

        try {
          const user = await registerWithEmail(normalizedEmail, password);
          firebaseUid = user.uid;
        } catch (regAuthErr) {
          if (regAuthErr.code === 'auth/email-already-in-use') {
            try {
              const existingAuthUser = await loginWithEmail(normalizedEmail, password);
              firebaseUid = existingAuthUser.uid;
            } catch (loginErr) {
              addToast('This email address is already registered. Please go back and log in with your password.', 'error');
              setLoading(false);
              return;
            }
          } else {
            throw regAuthErr;
          }
        }
      }

      // Register in backend
      const result = await api.registerStudent({
        email: normalizedEmail,
        name: regForm.name,
        department: regForm.department,
        batch: regForm.batch,
        section: regForm.section,
        registerNo: regForm.registerNo,
        phone: regForm.phone,
        firebaseUid,
      });

      if (result.warnings?.noAdvisor) {
        addToast(result.warnings.noAdvisor, 'warning');
      }
      if (result.warnings?.noHod) {
        addToast(result.warnings.noHod, 'warning');
      }

      setSelectedRole('student');
      await refreshUser();
      
      addToast('Registration successful!', 'success');
      navigateToDashboard('student');
    } catch (error) {
      console.error('Registration error:', error);

      const isEmailDuplicate = error?.code === 'auth/email-already-in-use' || 
        (error?.message && error.message.toLowerCase().includes('email') && error.message.toLowerCase().includes('already'));

      if (isEmailDuplicate) {
        try {
          const { auth } = await import('../config/firebase');
          if (auth.currentUser) {
            const linkResult = await api.linkFirebase(normalizedEmail, auth.currentUser.uid);
            if (linkResult?.success) {
              setSelectedRole('student');
              await refreshUser();
              addToast('Registration completed by linking existing account.', 'success');
              navigateToDashboard('student');
              return;
            }
          }
        } catch (linkErr) {
          console.error('Linking existing user failed:', linkErr);
        }

        addToast('This email address is already registered. Please log in.', 'error');
      } else {
        addToast(error.message || 'Registration failed', 'error');
      }

      try {
        const { auth } = await import('../config/firebase');
        if (auth.currentUser && !isEmailDuplicate) {
          await auth.currentUser.delete();
          await auth.signOut();
          console.log('Rolled back orphaned Firebase user after failed registration');
        }
      } catch (delErr) {
        console.error('Failed to delete orphaned firebase user:', delErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateToDashboard = (role) => {
    const routes = {
      student: '/student',
      advisor: '/advisor',
      hod: '/hod',
      security: '/security',
    };
    navigate(routes[role] || '/');
  };

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          
          {/* Branding Side */}
          <motion.div 
            className="flex-1 text-center lg:text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">Digital Student Gatepass</h1>
                <p className="text-sm text-gray-400 font-medium">SMVEC Gate Pass System</p>
              </div>
            </div>
            
            <p className="text-gray-400 max-w-md mx-auto lg:mx-0 mb-8">
              Secure and efficient gate pass management for Sri Manakula Vinayagar Engineering College
            </p>

            <div className="hidden lg:flex flex-col gap-3">
              {[
                'Multi-level approval workflow',
                'One-time QR code passes',
                'Real-time status tracking',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Form Side */}
          <motion.div 
            className="w-full max-w-md"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="glass-card rounded-4xl p-8">
              <AnimatePresence mode="wait">
                {/* Role Selection */}
                {step === 'role' && (
                  <motion.div
                    key="role"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <h2 className="text-2xl font-bold text-white mb-2">Select Your Role</h2>
                    <p className="text-gray-400 mb-6">Choose your portal to continue</p>

                    <div className="grid grid-cols-2 gap-3">
                      {roles.map((role) => {
                        const Icon = role.icon;
                        return (
                          <button
                            key={role.id}
                            onClick={() => handleRoleSelect(role.id)}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                          >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="font-bold text-white text-sm">{role.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Login Form */}
                {step === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <button 
                      onClick={handleBack}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                      {(() => {
                        const role = roles.find((r) => r.id === selectedRoleId);
                        const Icon = role?.icon || GraduationCap;
                        return (
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role?.color || 'from-blue-500 to-cyan-500'} flex items-center justify-center`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                        );
                      })()}
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {roles.find((r) => r.id === selectedRoleId)?.name} Login
                        </h2>
                        <p className="text-sm text-gray-400">Enter your credentials</p>
                      </div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your.email@smvec.ac.in"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            Access Portal
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="px-2 bg-surface text-gray-500">or continue with</span>
                      </div>
                    </div>

                    <button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition-all disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </button>

                    {selectedRoleId === 'student' && (
                      <p className="text-center text-sm text-gray-500 mt-4">
                        New student?{' '}
                        <button 
                          onClick={() => setStep('register')}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Register here
                        </button>
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Registration Form */}
                {step === 'register' && (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <button 
                      onClick={handleBack}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>

                    <h2 className="text-xl font-bold text-white mb-1">Student Registration</h2>
                    <p className="text-sm text-gray-400 mb-6">
                      {googleUser ? `Complete your profile for ${googleUser.email}` : 'Create your account'}
                    </p>

                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <p className="text-xs text-amber-300">Only @smvec.ac.in emails are allowed</p>
                    </div>

                    <form onSubmit={handleRegistration} className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                      {!googleUser && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">College Email</label>
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="yourname@smvec.ac.in"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Password</label>
                              <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                required
                                minLength={6}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Confirm</label>
                              <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                required
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Full Name</label>
                        <input
                          type="text"
                          value={regForm.name}
                          onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                          placeholder="Your full name"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Register Number</label>
                        <input
                          type="text"
                          value={regForm.registerNo}
                          onChange={(e) => setRegForm({ ...regForm, registerNo: e.target.value.toUpperCase() })}
                          placeholder="e.g., 24IT101"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Department</label>
                        <select
                          value={regForm.department}
                          onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                          required
                        >
                          <option value="" className="bg-gray-900">Select Department</option>
                          <option value="AIDS" className="bg-gray-900">AIDS - Artificial Intelligence and Data Science</option>
                          <option value="CSE" className="bg-gray-900">CSE - Computer Science Engineering</option>
                          <option value="CCE" className="bg-gray-900">CCE - Computer and Communication Engineering</option>
                          <option value="IT" className="bg-gray-900">IT - Information Technology</option>
                          <option value="MECH" className="bg-gray-900">MECH - Mechanical Engineering</option>
                          <option value="EEE" className="bg-gray-900">EEE - Electrical and Electronics Engineering</option>
                          <option value="ECE" className="bg-gray-900">ECE - Electronics and Communication Engineering</option>
                          
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Batch</label>
                          <select
                            value={regForm.batch}
                            onChange={(e) => setRegForm({ ...regForm, batch: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                            required
                          >
                            <option value="" className="bg-gray-900">Select</option>
                            <option value="2024-2028" className="bg-gray-900">2024-2028</option>
                            <option value="2023-2027" className="bg-gray-900">2023-2027</option>
                            <option value="2022-2026" className="bg-gray-900">2022-2026</option>
                            <option value="2021-2025" className="bg-gray-900">2021-2025</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Section</label>
                          <select
                            value={regForm.section}
                            onChange={(e) => setRegForm({ ...regForm, section: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                            required
                          >
                            <option value="" className="bg-gray-900">Select</option>
                            <option value="A" className="bg-gray-900">Section A</option>
                            <option value="B" className="bg-gray-900">Section B</option>
                            <option value="C" className="bg-gray-900">Section C</option>
                            <option value="D" className="bg-gray-900">Section D</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Phone Number</label>
                        <input
                          type="tel"
                          value={regForm.phone}
                          onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                          placeholder="+91 9876543210"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            Complete Registration
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
