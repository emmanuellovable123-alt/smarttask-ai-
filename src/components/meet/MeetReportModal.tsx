import React, { useState } from 'react';
import { X, AlertTriangle, Shield, Check, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface MeetReportModalProps {
  reporterId: string;
  reporterAge: string;
  reportedUserId: string;
  reportedUserName: string;
  onClose: () => void;
  onReportSubmitted: () => void;
}

const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Fake profile',
  'Inappropriate behavior',
  'Other'
] as const;

export function MeetReportModal({
  reporterId,
  reporterAge,
  reportedUserId,
  reportedUserName,
  onClose,
  onReportSubmitted
}: MeetReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<typeof REPORT_REASONS[number]>('Spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/meet/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId,
          reporterAge,
          reportedUserId,
          reason: selectedReason,
          details
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);
      setTimeout(() => {
        onReportSubmitted();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error submitting report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="meet-report-backdrop"
      className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <motion.div
        id="meet-report-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-bold text-slate-900">Report {reportedUserName}</h3>
          </div>
          <button
            id="close-report-modal-btn"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Report Received</h4>
            <p className="text-xs text-slate-500">
              Thank you for keeping our community safe. Our moderation team has been notified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Reason for report
              </label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map(r => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedReason === r
                        ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-medium'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                id="report-details-input"
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Briefly describe what happened..."
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>Your report is anonymous. {reportedUserName} will not see who reported them.</span>
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="cancel-report-btn"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-report-btn"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
