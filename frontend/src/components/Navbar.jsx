import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, LogOut, User, Bell } from 'lucide-react';

export default function Navbar() {
  const { dbUser, logout, selectedRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getRoleLabel = () => {
    switch (selectedRole) {
      case 'student': return 'Student';
      case 'advisor': return 'Class Advisor';
      case 'hod': return 'Head of Department';
      case 'security': return 'Security';
      default: return '';
    }
  };

  return (
    <motion.nav
      className="sticky top-0 z-40 glass-card border-b border-white/5"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-black text-white tracking-tight">Digital Student Gatepass</h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest">{getRoleLabel()}</p>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-3">
            {/* User Info */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{dbUser?.name}</p>
                <p className="text-xs text-gray-400">
                  {dbUser?.department} {dbUser?.rollNumber ? `• ${dbUser.rollNumber}` : ''}
                </p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-3 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 transition-all group"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-400 group-hover:text-rose-400" />
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
