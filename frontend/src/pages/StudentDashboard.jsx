import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  QrCode,
  MapPin,
  Calendar,
  Phone,
  FileText,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { StatusBadge } from '../components/RequestCard';
import { ToastContainer, useToast } from '../components/Toast';

export default function StudentDashboard() {
  const { dbUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    reason: '',
    destination: '',
    exitDate: '',
    exitTime: '',
    expectedReturnTime: '',
    contactNumber: dbUser?.phone || '',
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { requests: data } = await api.getStudentRequests();
      setRequests(data);
    } catch (error) {
      addToast(error.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.reason.length < 10) {
      addToast('Please provide a detailed reason (at least 10 characters)', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Combine date + time into ISO datetimes when provided
      const payload = { ...formData };
      if (formData.exitDate && formData.exitTime) {
        const d = new Date(`${formData.exitDate}T${formData.exitTime}:00`);
        payload.exitDate = d.toISOString();
      }
      payload.expectedReturnTime = formData.expectedReturnTime || null;

      await api.createRequest(payload);
      addToast('Gate pass request submitted successfully!', 'success');
      setIsModalOpen(false);
      setFormData({
        reason: '',
        destination: '',
        exitDate: '',
        exitTime: '',
        expectedReturnTime: '',
        contactNumber: dbUser?.phone || '',
      });
      loadRequests();
    } catch (error) {
      addToast(error.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusCounts = () => {
    const counts = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending_advisor' || r.status === 'pending_hod').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    };
    return counts;
  };

  const counts = getStatusCounts();

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = typeof dateStr?.toDate === 'function' ? dateStr.toDate() : new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
        <div className="absolute top-0 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">My Gate Passes</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20">
                  {dbUser?.department}
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium border border-purple-500/20">
                  {dbUser?.batchStart && dbUser?.batchEnd ? `Batch ${dbUser.batchStart}-${dbUser.batchEnd}` : `Batch ${dbUser?.batch || dbUser?.year || 'N/A'}`} • Sec {dbUser?.section}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold shadow-lg shadow-blue-500/25 transition-all"
            >
              <Plus className="w-5 h-5" />
              New Request
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {[
            { label: 'Total', value: counts.total, icon: FileText, color: 'blue' },
            { label: 'Pending', value: counts.pending, icon: Clock, color: 'amber' },
            { label: 'Approved', value: counts.approved, icon: CheckCircle2, color: 'emerald' },
            { label: 'Rejected', value: counts.rejected, icon: XCircle, color: 'rose' },
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-3xl p-5">
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Requests List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Requests</h2>
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
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Requests Yet</h3>
              <p className="text-gray-500 mb-6">Create your first gate pass request</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all"
              >
                <Plus className="w-5 h-5" />
                New Request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((request, index) => (
                <motion.div
                  key={request.id}
                  className="glass-card rounded-4xl p-6 hover:bg-white/[0.08] transition-all cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedRequest(request)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <StatusBadge status={request.status} />
                    <span className="text-xs text-gray-500">{formatDate(request.createdAt)}</span>
                  </div>

                  {/* Reason */}
                  <h3 className="font-bold text-white mb-2 line-clamp-2">{request.reason}</h3>
                  
                  {/* Destination */}
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{request.destination}</span>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(request.exitDate)}</span>
                  </div>

                  {/* QR Code Preview for approved requests */}
                  {request.status === 'approved' && request.qrToken && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white">
                        <QRCodeSVG value={request.qrToken} size={40} />
                      </div>
                      <span className="text-sm text-emerald-400 font-medium">QR Ready</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* New Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Gate Pass Request"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
              Reason / Purpose *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Explain why you need to leave campus..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
              Destination *
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Where are you going?"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                Exit Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="time"
                  value={formData.exitTime}
                  onChange={(e) => setFormData({ ...formData, exitTime: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                Return Time
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="time"
                  value={formData.expectedReturnTime}
                  onChange={(e) => setFormData({ ...formData, expectedReturnTime: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Optional</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                Exit Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  value={formData.exitDate}
                  onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
              Contact Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Submit Request'
            )}
          </button>
        </form>
      </Modal>

      {/* Request Details Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Request Details"
        size="md"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedRequest.status} />
              <span className="text-sm text-gray-500">{formatDate(selectedRequest.createdAt)}</span>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Applied On</p>
              <p className="text-white">{formatDate(selectedRequest.appliedAt || selectedRequest.createdAt)}</p>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Reason</p>
                <p className="text-white">{selectedRequest.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Destination</p>
                  <p className="text-white">{selectedRequest.destination}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Contact</p>
                  <p className="text-white">{selectedRequest.contactNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Exit Time</p>
                  <p className="text-white">{formatDate(selectedRequest.exitDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Return Time</p>
                  <p className="text-white">
                    {selectedRequest.expectedReturnTime ? selectedRequest.expectedReturnTime : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Remarks */}
            {(selectedRequest.advisorRemarks || selectedRequest.hodRemarks) && (
              <div className="pt-4 border-t border-white/10 space-y-3">
                {selectedRequest.advisorRemarks && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-gray-500 mb-1">Advisor Remarks</p>
                    <p className="text-sm text-gray-300">{selectedRequest.advisorRemarks}</p>
                  </div>
                )}
                {selectedRequest.hodRemarks && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-gray-500 mb-1">HOD Remarks</p>
                    <p className="text-sm text-gray-300">{selectedRequest.hodRemarks}</p>
                  </div>
                )}
              </div>
            )}

            {/* QR Code for approved requests */}
            {selectedRequest.status === 'approved' && selectedRequest.qrToken && (
              <div className="pt-4 border-t border-white/10">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Your Gate Pass QR Code</p>
                  <div className="inline-block p-6 rounded-3xl bg-white">
                    <QRCodeSVG 
                      value={selectedRequest.qrToken} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-sm text-emerald-400 mt-4">
                    Show this QR code to security at the gate
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    This code can only be used once
                  </p>
                </div>
              </div>
            )}

            {/* Used status */}
            {selectedRequest.status === 'used' && (
              <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/20 text-center">
                <QrCode className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400 font-medium">This pass has been used</p>
                {selectedRequest.usedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Used on {formatDate(selectedRequest.usedAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
