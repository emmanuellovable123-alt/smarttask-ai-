import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { motion } from 'motion/react';

interface Under18BlockedModalProps {
  onClose: () => void;
}

export function Under18BlockedModal({ onClose }: Under18BlockedModalProps) {
  return (
    <div 
      id="under-18-blocked-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <motion.div
        id="under-18-blocked-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-center relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <h3 id="under-18-rejection-msg" className="text-base font-bold text-slate-900 mb-1.5">
          Meet is unavailable for this account.
        </h3>

        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Daily TASK AI task creation, reminders, alarms, voice scheduling, and daily reports remain fully active and available.
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors"
        >
          Return to My Tasks
        </button>
      </motion.div>
    </div>
  );
}
