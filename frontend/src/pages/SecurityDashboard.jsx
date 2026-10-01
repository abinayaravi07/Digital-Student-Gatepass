import { useState, useEffect, useRef } from 'react';
import QrScanner from 'react-qr-scanner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  QrCode,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
  MapPin,
  Calendar,
  Clock,
  Camera,
  Keyboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import { ToastContainer, useToast } from '../components/Toast';

export default function SecurityDashboard() {
  const { dbUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [scanHistory, setScanHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrInput, setQrInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [inputMode, setInputMode] = useState('manual'); // 'manual' or 'camera'
  
  const inputRef = useRef(null);

  const handleScan = (data) => {
    if (data) {
      // react-qr-scanner returns an object with text property, or sometimes just the text depending on version/config
      const token = data?.text || data;
      if (token) {
        setQrInput(token);
        // Automatically verify if we get a scan
        verifyToken(token);
        // Switch back to manual to show result and stop scanning
        setInputMode('manual');
      }
    }
  };

  const handleError = (err) => {
    console.error(err);
    addToast('Camera access error: ' + err.message, 'error');
  };

  const verifyToken = async (token) => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const result = await api.verifyQr(token);
      
      if (result.valid) {
        setVerificationResult({
          success: true,
          message: 'Gate pass verified successfully!',
          student: result.student,
          request: result.request
        });
        addToast('Gate pass verified! Student can exit.', 'success');
        loadScanHistory();
      } else {
        setVerificationResult({
          success: false,
          message: result.error || 'Invalid or expired QR code',
          request: result.request
        });
        addToast(result.error || 'Invalid QR code', 'error');
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        message: error.message || 'Verification failed'
      });
      addToast(error.message || 'Verification failed', 'error');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadScanHistory();
  }, []);

  useEffect(() => {
    // Focus input when in manual mode
    if (inputMode === 'manual' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

  const loadScanHistory = async () => {
    try {
      setLoading(true);
      const { logs } = await api.getScanHistory();
      setScanHistory(logs);
    } catch (error) {
      addToast(error.message || 'Failed to load scan history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    
    if (!qrInput.trim()) {
      addToast('Please enter or scan a QR code', 'warning');
      return;
    }

    verifyToken(qrInput.trim());
    setQrInput('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Navbar />
      
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-32 w-96 h-96 bg-green-600/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Security Dashboard</h1>
          <p className="text-gray-400 mt-2">Verify student gate passes</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scanner Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="glass-card rounded-4xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Scan QR Code</h2>
                  <p className="text-sm text-gray-400">Enter or scan the student's gate pass</p>
                </div>
              </div>

              {/* Input Mode Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setInputMode('manual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                    inputMode === 'manual'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <Keyboard className="w-4 h-4" />
                  Manual Input
                </button>
                <button
                  onClick={() => setInputMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                    inputMode === 'camera'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Camera Scan
                </button>
              </div>

              {inputMode === 'manual' ? (
                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                      QR Code Token
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="Paste or type QR code value..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none font-mono text-lg"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Tip: Use a barcode scanner to automatically input the QR code
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || !qrInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    {verifying ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Verify Pass
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="overflow-hidden rounded-3xl bg-black relative">
                  <QrScanner
                    delay={300}
                    onError={handleError}
                    onScan={handleScan}
                    style={{ width: '100%', height: '100%', borderRadius: '1.5rem' }}
                    constraints={{
                      video: { facingMode: 'environment' }
                    }}
                  />
                  <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-3xl pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                      Point camera at QR code
                    </p>
                  </div>
                </div>
              )}

              {/* Verification Result */}
              <AnimatePresence>
                {verificationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mt-6 p-6 rounded-2xl border ${
                      verificationResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-rose-500/10 border-rose-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {verificationResult.success ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      ) : (
                        <XCircle className="w-8 h-8 text-rose-400" />
                      )}
                      <div>
                        <h3 className={`font-bold ${verificationResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {verificationResult.success ? 'Pass Verified!' : 'Verification Failed'}
                        </h3>
                        <p className="text-sm text-gray-400">{verificationResult.message}</p>
                      </div>
                    </div>

                    {verificationResult.student && (
                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{verificationResult.student.name}</p>
                            <p className="text-sm text-gray-400">
                              {verificationResult.student.rollNumber} • {verificationResult.student.department}
                            </p>
                          </div>
                        </div>
                        
                        {verificationResult.request && (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Destination</p>
                              <p className="text-white">{verificationResult.request.destination}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Exit Date</p>
                              <p className="text-white">{formatDate(verificationResult.request.exitDate)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setVerificationResult(null)}
                      className="w-full mt-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-all"
                    >
                      Clear & Scan Next
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Scan History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="glass-card rounded-4xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Scan History</h2>
                    <p className="text-sm text-gray-400">Recent verifications</p>
                  </div>
                </div>
                <button
                  onClick={loadScanHistory}
                  disabled={loading}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : scanHistory.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No scans yet today</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {scanHistory.map((log, index) => (
                    <motion.div
                      key={log.id}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/[0.08] transition-all"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white">{log.studentName}</p>
                          <p className="text-sm text-gray-400">{log.studentRollNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-emerald-400 font-medium">Verified</p>
                          <p className="text-xs text-gray-500">{formatTime(log.scanTime)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
