import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  UserCog,
  Loader2,
  RefreshCw,
  MapPin,
  Calendar,
  Phone,
  User,
  MessageSquare,
  QrCode
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { StatusBadge } from '../components/RequestCard';
import { ToastContainer, useToast } from '../components/Toast';

export default function HodDashboard() {
  const { dbUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { requests: data } = await api.getHodRequests();
      setRequests(data);
    } catch (error) {
      addToast(error.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (actionType === 'reject' && (!remarks || remarks.length < 5)) {
      addToast('Please provide rejection remarks (at least 5 characters)', 'warning');
      return;
    }

    setProcessing(true);
    try {
      if (actionType === 'approve') {
        await api.approveAsHod(selectedRequest.id, remarks || 'Approved by HOD');
        addToast('Request approved. QR code generated for student!', 'success');
      } else {
        await api.rejectAsHod(selectedRequest.id, remarks);
        addToast('Request rejected', 'success');
      }
      
      setSelectedRequest(null);
      setActionType(null);
      setRemarks('');
      loadRequests();
    } catch (error) {
      addToast(error.message || 'Action failed', 'error');
    } finally {
      setProcessing(false);
    }
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
    // If already a plain "HH:MM" time string, return as-is
    if (/^\d{1,2}:\d{2}$/.test(String(dateStr).trim())) return String(dateStr).trim();
    try {
      return new Date(dateStr).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
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
        <div className="absolute top-0 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-32 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">HOD Dashboard</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-sm font-medium border border-amber-500/20">
              {dbUser?.handlesDepartment || dbUser?.department || (dbUser?.email?.match(/(?:hod|ca)\.([a-z]+)/i)?.[1]?.toUpperCase()) || 'IT'} Department
            </span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div 
          className="glass-card rounded-4xl p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <UserCog className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-3xl font-black text-white">{requests.length}</p>
              <p className="text-gray-400">Awaiting Final Approval</p>
            </div>
          </div>
        </motion.div>

        {/* Requests List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">CA-Approved Requests</h2>
            <button
              onClick={loadRequests}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">All Caught Up!</h3>
              <p className="text-gray-500">No pending requests for final approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request, index) => (
                <motion.div
                  key={request.id}
                  className="glass-card rounded-3xl p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* Student Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{request.studentName}</h3>
                        <p className="text-sm text-gray-400">
                          {request.studentRollNumber} • {request.department} • {request.batchStart && request.batchEnd ? `Batch ${request.batchStart}-${request.batchEnd}` : `Batch ${request.year || 'N/A'}`} Sec {request.section}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>

                  {/* CA Approval Info */}
                  {request.advisorRemarks && (
                    <div className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <p className="text-xs text-purple-400 uppercase tracking-widest mb-1">Class Advisor Remarks</p>
                      <p className="text-sm text-gray-300">{request.advisorRemarks}</p>
                    </div>
                  )}

                  {/* Request Details */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Reason</p>
                    <p className="text-white">{request.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Destination</p>
                      <p className="text-sm text-gray-300 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {request.destination}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Exit Date</p>
                      <p className="text-sm text-gray-300 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(request.exitDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Exit Time</p>
                      <p className="text-sm text-gray-300 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {request.exitTime ? formatTime(request.exitTime) : formatTime(request.exitDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Return Time</p>
                      <p className="text-sm text-gray-300 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {request.expectedReturnTime ? formatTime(request.expectedReturnTime) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Contact</p>
                      <p className="text-sm text-gray-300 flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {request.contactNumber}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setActionType('approve');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 transition-all"
                    >
                      <QrCode className="w-5 h-5" />
                      Approve & Generate QR
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setActionType('reject');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold border border-rose-500/20 transition-all"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Action Modal */}
      <Modal
        isOpen={!!selectedRequest && !!actionType}
        onClose={() => {
          setSelectedRequest(null);
          setActionType(null);
          setRemarks('');
        }}
        title={actionType === 'approve' ? 'Final Approval' : 'Reject Request'}
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Student Info */}
            <div className="p-4 rounded-xl bg-white/5">
              <p className="font-bold text-white">{selectedRequest.studentName}</p>
              <p className="text-sm text-gray-400">{selectedRequest.studentRollNumber}</p>
            </div>

            {/* Approval Notice */}
            {actionType === 'approve' && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <QrCode className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="font-medium text-emerald-400">QR Code will be generated</p>
                    <p className="text-sm text-gray-400">Student will receive a one-time gate pass QR code</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reason Preview */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Request Reason</p>
              <p className="text-sm text-gray-300">{selectedRequest.reason}</p>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                {actionType === 'approve' ? 'Remarks (Optional)' : 'Rejection Reason *'}
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-gray-500" />
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={actionType === 'approve' 
                    ? 'Add any comments...' 
                    : 'Explain why you are rejecting this request...'
                  }
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                  required={actionType === 'reject'}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setRemarks('');
                }}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={processing}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                } disabled:opacity-50`}
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : actionType === 'approve' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Approve & Generate QR
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
