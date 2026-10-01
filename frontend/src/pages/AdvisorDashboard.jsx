import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users,
  FileText,
  Loader2,
  RefreshCw,
  MapPin,
  Calendar,
  Phone,
  User,
  MessageSquare,
  History,
  QrCode,
  Filter,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { StatusBadge } from '../components/RequestCard';
import { ToastContainer, useToast } from '../components/Toast';

export default function AdvisorDashboard() {
  const { dbUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  // Tab state: 'pending' | 'history'
  const [activeTab, setActiveTab] = useState('pending');

  // Pending requests
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Action modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  // Detail modal (for history view)
  const [detailRequest, setDetailRequest] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  // Load history when switching to history tab (lazy)
  useEffect(() => {
    if (activeTab === 'history' && !historyLoaded) {
      loadHistory();
    }
  }, [activeTab, historyLoaded]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { requests: data } = await api.getAdvisorRequests();
      setRequests(data);
    } catch (error) {
      addToast(error.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const { requests: data } = await api.getAdvisorHistory();
      setHistory(data);
      setHistoryLoaded(true);
    } catch (error) {
      addToast(error.message || 'Failed to load history', 'error');
    } finally {
      setHistoryLoading(false);
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
        await api.approveAsAdvisor(selectedRequest.id, remarks || 'Approved by Class Advisor');
        addToast('Request approved and forwarded to HOD', 'success');
      } else {
        await api.rejectAsAdvisor(selectedRequest.id, remarks);
        addToast('Request rejected', 'success');
      }
      
      setSelectedRequest(null);
      setActionType(null);
      setRemarks('');
      loadRequests();
      // Refresh history if it has already been loaded
      if (historyLoaded) {
        setHistoryLoaded(false);
        loadHistory();
      }
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  // Filtered history
  const filteredHistory = statusFilter === 'all'
    ? history
    : history.filter(r => r.status === statusFilter);

  // History stats
  const historyStats = {
    total: history.length,
    pending: history.filter(r => r.status === 'pending_advisor' || r.status === 'pending_hod').length,
    approved: history.filter(r => r.status === 'approved' || r.status === 'used').length,
    rejected: history.filter(r => r.status === 'rejected').length,
    used: history.filter(r => r.status === 'used').length,
  };

  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'pending_advisor', label: 'Awaiting Advisor' },
    { value: 'pending_hod', label: 'Awaiting HOD' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'used', label: 'Used' },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Navbar />
      
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-32 w-96 h-96 bg-pink-600/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Class Advisor Dashboard</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium border border-purple-500/20">
              {dbUser?.handlesDepartment || dbUser?.department}
            </span>
            {(dbUser?.handlesYear || dbUser?.batchStart) && (
              <span className="px-3 py-1 rounded-full bg-pink-500/10 text-pink-400 text-sm font-medium border border-pink-500/20">
                {dbUser?.batchStart && dbUser?.batchEnd ? `Batch ${dbUser.batchStart}-${dbUser.batchEnd}` : `Year ${dbUser.handlesYear || dbUser.year}`} • Sec {dbUser?.handlesSection || dbUser?.section}
              </span>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          className="flex gap-2 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Approvals
            {requests.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-400'
              }`}>
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Class History
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ==================== PENDING TAB ==================== */}
          {activeTab === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Stats card */}
              <div className="glass-card rounded-4xl p-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-white">{requests.length}</p>
                    <p className="text-gray-400">Pending Approvals</p>
                  </div>
                  <div className="ml-auto">
                    <button
                      onClick={loadRequests}
                      disabled={loading}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pending list */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">All Caught Up!</h3>
                  <p className="text-gray-500">No pending requests to review</p>
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
                          <CheckCircle2 className="w-5 h-5" />
                          Approve & Forward
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
          )}

          {/* ==================== HISTORY TAB ==================== */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* History Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total', value: historyStats.total, color: 'blue', icon: FileText },
                  { label: 'Pending', value: historyStats.pending, color: 'amber', icon: Clock },
                  { label: 'Approved / Used', value: historyStats.approved, color: 'emerald', icon: CheckCircle2 },
                  { label: 'Rejected', value: historyStats.rejected, color: 'rose', icon: XCircle },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    className="glass-card rounded-3xl p-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center mb-3`}>
                      <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                    </div>
                    <p className="text-2xl font-black text-white">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Filter + Refresh Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-white">Complete Gate Pass History</h2>
                <div className="flex items-center gap-3">
                  {/* Status filter */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="appearance-none bg-white/5 border border-white/10 rounded-xl py-2 pl-4 pr-10 text-white text-sm focus:border-purple-500 focus:outline-none cursor-pointer"
                    >
                      {STATUS_FILTER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-gray-900">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={() => { setHistoryLoaded(false); loadHistory(); }}
                    disabled={historyLoading}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-400 ${historyLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <History className="w-10 h-10 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Records Found</h3>
                  <p className="text-gray-500">
                    {statusFilter === 'all'
                      ? 'No gate pass requests from your class yet'
                      : `No ${STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label} records`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((request, index) => (
                    <motion.div
                      key={request.id}
                      className="glass-card rounded-3xl p-5 hover:bg-white/[0.08] transition-all cursor-pointer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => setDetailRequest(request)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Student avatar + info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-white truncate">{request.studentName}</h3>
                            <p className="text-xs text-gray-400 truncate">
                              {request.studentRollNumber} • Sec {request.section}
                            </p>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="flex-1 min-w-0 hidden sm:block">
                          <p className="text-sm text-gray-300 truncate">{request.reason}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {request.destination}
                          </p>
                        </div>

                        {/* Date + Status */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-gray-500">{formatDate(request.exitDate)}</p>
                            <p className="text-xs text-gray-600">{formatDateTime(request.createdAt)}</p>
                          </div>
                          <StatusBadge status={request.status} />
                        </div>
                      </div>

                      {/* Mobile: reason */}
                      <div className="mt-3 pt-3 border-t border-white/5 sm:hidden">
                        <p className="text-sm text-gray-300">{request.reason}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {request.destination} &nbsp;•&nbsp;
                          <Calendar className="w-3 h-3" /> {formatDate(request.exitDate)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ==================== ACTION MODAL (Approve / Reject) ==================== */}
      <Modal
        isOpen={!!selectedRequest && !!actionType}
        onClose={() => {
          setSelectedRequest(null);
          setActionType(null);
          setRemarks('');
        }}
        title={actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Student Info */}
            <div className="p-4 rounded-xl bg-white/5">
              <p className="font-bold text-white">{selectedRequest.studentName}</p>
              <p className="text-sm text-gray-400">{selectedRequest.studentRollNumber}</p>
            </div>

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
              {actionType === 'reject' && (
                <p className="text-xs text-gray-500 mt-1">Minimum 5 characters required</p>
              )}
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
                    Confirm Approval
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

      {/* ==================== DETAIL MODAL (History View) ==================== */}
      <Modal
        isOpen={!!detailRequest}
        onClose={() => setDetailRequest(null)}
        title="Gate Pass Details"
        size="md"
      >
        {detailRequest && (
          <div className="space-y-5">
            {/* Status + Date */}
            <div className="flex items-center justify-between">
              <StatusBadge status={detailRequest.status} />
              <span className="text-sm text-gray-500">{formatDateTime(detailRequest.createdAt)}</span>
            </div>

            {/* Student */}
            <div className="p-4 rounded-xl bg-white/5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-white">{detailRequest.studentName}</p>
                <p className="text-sm text-gray-400">
                  {detailRequest.studentRollNumber} • {detailRequest.department} • Sec {detailRequest.section}
                </p>
                <p className="text-xs text-gray-500">{detailRequest.studentEmail}</p>
              </div>
            </div>

            {/* Request Info */}
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Reason</p>
                <p className="text-white">{detailRequest.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Destination</p>
                  <p className="text-sm text-gray-300 flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {detailRequest.destination}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Contact</p>
                  <p className="text-sm text-gray-300 flex items-center gap-1">
                    <Phone className="w-4 h-4" /> {detailRequest.contactNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Exit Date/Time</p>
                  <p className="text-sm text-gray-300 flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> {formatDateTime(detailRequest.exitDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Return Time</p>
                  <p className="text-sm text-gray-300 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {detailRequest.expectedReturnTime || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Approval Timeline */}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Approval Timeline</p>
              <div className="space-y-3">
                {/* Advisor status */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    detailRequest.advisorStatus === 'approved' ? 'bg-emerald-500/20' :
                    detailRequest.advisorStatus === 'rejected' ? 'bg-rose-500/20' : 'bg-amber-500/20'
                  }`}>
                    {detailRequest.advisorStatus === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                     detailRequest.advisorStatus === 'rejected' ? <XCircle className="w-4 h-4 text-rose-400" /> :
                     <Clock className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">Class Advisor</p>
                    <p className="text-xs text-gray-500">
                      {detailRequest.advisorStatus === 'approved' ? `Approved${detailRequest.advisorActionAt ? ' • ' + formatDateTime(detailRequest.advisorActionAt) : ''}` :
                       detailRequest.advisorStatus === 'rejected' ? `Rejected${detailRequest.advisorActionAt ? ' • ' + formatDateTime(detailRequest.advisorActionAt) : ''}` :
                       'Pending'}
                    </p>
                    {detailRequest.advisorRemarks && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{detailRequest.advisorRemarks}"</p>
                    )}
                  </div>
                </div>

                {/* HOD status */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    detailRequest.hodStatus === 'approved' ? 'bg-emerald-500/20' :
                    detailRequest.hodStatus === 'rejected' ? 'bg-rose-500/20' : 'bg-gray-500/20'
                  }`}>
                    {detailRequest.hodStatus === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                     detailRequest.hodStatus === 'rejected' ? <XCircle className="w-4 h-4 text-rose-400" /> :
                     <Clock className="w-4 h-4 text-gray-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">Head of Department (HOD)</p>
                    <p className="text-xs text-gray-500">
                      {detailRequest.hodStatus === 'approved' ? `Approved${detailRequest.hodActionAt ? ' • ' + formatDateTime(detailRequest.hodActionAt) : ''}` :
                       detailRequest.hodStatus === 'rejected' ? `Rejected${detailRequest.hodActionAt ? ' • ' + formatDateTime(detailRequest.hodActionAt) : ''}` :
                       'Pending'}
                    </p>
                    {detailRequest.hodRemarks && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{detailRequest.hodRemarks}"</p>
                    )}
                  </div>
                </div>

                {/* Gate used status */}
                {detailRequest.status === 'used' && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <QrCode className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">Gate Pass Used</p>
                      <p className="text-xs text-gray-500">
                        {detailRequest.usedAt ? formatDateTime(detailRequest.usedAt) : 'Used at gate'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
