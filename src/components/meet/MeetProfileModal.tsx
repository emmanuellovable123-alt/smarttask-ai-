import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  UserPlus,
  Shield,
  AlertTriangle,
  Ban,
  MapPin,
  Check,
  Loader2,
  Heart
} from 'lucide-react';
import { motion } from 'motion/react';
import { MeetPerson } from './MeetChatModal';
import { MeetReportModal } from './MeetReportModal';

interface MeetProfileModalProps {
  person: MeetPerson;
  currentUserId: string;
  currentUserAge: string;
  isPremium: boolean;
  onClose: () => void;
  onStartChat: (person: MeetPerson) => void;
  onAddFriend: (person: MeetPerson) => void;
  onUserBlocked: (personId: string) => void;
  isChatLoading?: boolean;
  isFriendLoading?: boolean;
  isFriendSent?: boolean;
}

export function MeetProfileModal({
  person,
  currentUserId,
  currentUserAge,
  onClose,
  onStartChat,
  onAddFriend,
  onUserBlocked,
  isChatLoading = false,
  isFriendLoading = false,
  isFriendSent = false
}: MeetProfileModalProps) {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const handleBlockConfirm = async () => {
    setBlocking(true);
    setBlockError(null);
    try {
      const res = await fetch('/api/meet/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          userAge: currentUserAge,
          targetUserId: person.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to block user');

      onUserBlocked(person.id);
      onClose();
    } catch (err: any) {
      setBlockError(err.message || 'Error blocking user');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <>
      <div
        id="meet-profile-backdrop"
        className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      >
        <motion.div
          id="meet-profile-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 overflow-hidden flex flex-col"
        >
          {/* Header Bar */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Meet Public Profile</span>
            </div>
            <button
              id="close-profile-modal-btn"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Card Body */}
          <div className="p-6 text-center space-y-4">
            {/* Avatar & Online status */}
            <div className="relative inline-block mx-auto">
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt={person.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-100 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl shadow-sm">
                  {person.name.charAt(0)}
                </div>
              )}
              {person.onlineStatus === 'online' && (
                <span
                  title="Online now"
                  className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white"
                />
              )}
            </div>

            {/* Name & Marital Status */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-1.5">
                <span>{person.name}</span>
                <span className="text-xs font-normal text-slate-400">({person.maritalStatus})</span>
              </h3>
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{person.approximateLocation}</span>
              </p>
            </div>

            {/* Online Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{person.lastSeenText}</span>
            </div>

            {/* Safe Shared Task Focus */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-left space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <Heart className="w-3.5 h-3.5 text-blue-500" />
                <span>Focus / Active Routine</span>
              </div>
              <p className="text-xs font-medium text-slate-800">
                {person.currentTask}
              </p>
              <span className="inline-block mt-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-medium">
                {person.taskCategory}
              </span>
            </div>

            {/* Block Error alert */}
            {blockError && (
              <div className="p-2 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {blockError}
              </div>
            )}

            {/* Action Buttons: Chat & Add Friend */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="profile-chat-btn"
                disabled={isChatLoading}
                onClick={() => onStartChat(person)}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                {isChatLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5" />
                )}
                <span>Chat</span>
              </button>

              <button
                type="button"
                id="profile-add-friend-btn"
                disabled={isFriendSent || isFriendLoading}
                onClick={() => onAddFriend(person)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border shadow-xs transition-colors ${
                  isFriendSent
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 disabled:opacity-50'
                }`}
              >
                {isFriendLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isFriendSent ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Request Sent</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                    <span>Add Friend</span>
                  </>
                )}
              </button>
            </div>

            {/* Safety Actions: Block and Report */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                type="button"
                id="profile-report-btn"
                onClick={() => setShowReportModal(true)}
                className="text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report User</span>
              </button>

              <button
                type="button"
                id="profile-block-btn"
                onClick={() => setShowBlockConfirm(true)}
                className="text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Block User</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-3 border border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-red-600">
              <Ban className="w-4 h-4" />
              <span>Block {person.name}?</span>
            </h4>
            <p className="text-xs text-slate-500">
              They will be permanently removed from your discovery and will not be able to chat or send you friend requests.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="cancel-block-btn"
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-block-btn"
                disabled={blocking}
                onClick={handleBlockConfirm}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl flex items-center justify-center gap-1"
              >
                {blocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <MeetReportModal
          reporterId={currentUserId}
          reporterAge={currentUserAge}
          reportedUserId={person.id}
          reportedUserName={person.name}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={() => {
            setShowReportModal(false);
          }}
        />
      )}
    </>
  );
}
