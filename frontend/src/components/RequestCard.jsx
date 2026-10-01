import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, QrCode, ArrowRight } from 'lucide-react';

const statusConfig = {
  pending_advisor: {
    label: 'Awaiting Advisor',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    icon: Clock,
  },
  pending_hod: {
    label: 'Awaiting HOD',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
    icon: XCircle,
  },
  used: {
    label: 'Used',
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
    border: 'border-gray-400/20',
    icon: QrCode,
  },
};

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending_advisor;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${config.bg} ${config.color} border ${config.border}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

export default function RequestCard({ request, index = 0, onAction, showQR = false }) {
  const status = statusConfig[request.status] || statusConfig.pending_advisor;
  
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

  return (
    <motion.div
      className="glass-card rounded-4xl p-6 hover:bg-white/[0.08] transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <StatusBadge status={request.status} />
        <span className="text-xs text-gray-500">
          {formatDate(request.createdAt)}
        </span>
      </div>

      {/* Student Info (for advisors/HODs) */}
      {request.studentName && (
        <div className="mb-4 pb-4 border-b border-white/5">
          <h3 className="font-bold text-white">{request.studentName}</h3>
          <p className="text-sm text-gray-400">
            {request.studentRollNumber} • {request.department} • {request.batchStart && request.batchEnd ? `Batch ${request.batchStart}-${request.batchEnd}` : `Batch ${request.year || 'N/A'}`} Sec {request.section}
          </p>
        </div>
      )}

      {/* Reason */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Reason</p>
        <p className="text-white font-medium">{request.reason}</p>
      </div>

      {/* Destination & Dates */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Destination</p>
          <p className="text-sm text-gray-300">{request.destination}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Exit Date</p>
          <p className="text-sm text-gray-300">{formatDate(request.exitDate)}</p>
        </div>
      </div>

      {/* Remarks */}
      {(request.advisorRemarks || request.hodRemarks) && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
          {request.advisorRemarks && (
            <div className="text-sm">
              <span className="text-gray-500">Advisor: </span>
              <span className="text-gray-300">{request.advisorRemarks}</span>
            </div>
          )}
          {request.hodRemarks && (
            <div className="text-sm">
              <span className="text-gray-500">HOD: </span>
              <span className="text-gray-300">{request.hodRemarks}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {onAction && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <button
            onClick={() => onAction(request)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all"
          >
            Review Request
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
