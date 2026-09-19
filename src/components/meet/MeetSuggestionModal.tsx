import React from 'react';
import { User } from '../../types';
import { canUseMeet } from '../../lib/meetEligibility';
import { Users, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MeetSuggestionModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onOpenMeet: () => void;
}

export function MeetSuggestionModal({ user, isOpen, onClose, onOpenMeet }: MeetSuggestionModalProps) {
  // Under-18 users must NEVER see or receive the Meet suggestion!
  if (!isOpen || !canUseMeet(user)) {
    return null;
  }

  return (
    <AnimatePresence>
      <div 
        id="meet-suggestion-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      >
        <motion.div
          id="meet-suggestion-card"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col relative"
        >
          <button
            id="close-meet-suggestion-btn"
            onClick={onClose}
            aria-label="Close suggestion"
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Success confirmation of scheduled task */}
          <div className="flex items-center gap-2 text-emerald-600 mb-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wide">Your task has been scheduled.</span>
          </div>

          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6" />
          </div>

          <h3 id="meet-suggestion-title" className="text-lg font-bold text-slate-900 leading-snug mb-1">
            Meet people with similar tasks
          </h3>

          <p id="meet-suggestion-desc" className="text-sm text-slate-600 mb-6">
            See people who are currently running their daily tasks.
          </p>

          <div className="flex flex-col gap-2">
            <button
              id="meet-people-trigger-btn"
              onClick={() => {
                onClose();
                onOpenMeet();
              }}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>Meet People</span>
            </button>

            <button
              id="meet-people-later-btn"
              onClick={onClose}
              className="w-full py-2.5 px-4 text-slate-500 hover:text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
