import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import {
  MapPin,
  Globe,
  Shield,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  UserPlus,
  Check,
  ChevronRight,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdManager } from '../../lib/AdContext';
import { adAnalytics } from '../../lib/adAnalytics';
import { AdBanner } from '../AdBanner';
import { MeetChatModal, MeetPerson } from './MeetChatModal';
import { MeetProfileModal } from './MeetProfileModal';
import { MeetTestSuiteModal } from './MeetTestSuiteModal';

interface MeetPeopleModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

type DiscoveryMode = 'home' | 'near_me' | 'worldwide';

export function MeetPeopleModal({ user, onClose, onUpdateUser }: MeetPeopleModalProps) {
  const { showAd, showAdSequence } = useAdManager();
  const isPremium = user.subscriptionStatus === 'PREMIUM';

  const [currentMode, setCurrentMode] = useState<DiscoveryMode>('home');
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'requesting' | 'granted' | 'denied'>(
    user.locationPermissionStatus === 'granted' ? 'granted' : 'prompt'
  );
  const [meetEnabled, setMeetEnabled] = useState<boolean>(user.meetEnabled !== false);
  const [isTogglingMeet, setIsTogglingMeet] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Discovery data state
  const [people, setPeople] = useState<MeetPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // In-flight action locks to protect against double taps / duplicate triggers
  const [isTransitioningMode, setIsTransitioningMode] = useState(false);
  const [inFlightChatIds, setInFlightChatIds] = useState<Set<string>>(new Set());
  const [inFlightFriendIds, setInFlightFriendIds] = useState<Set<string>>(new Set());
  const [friendRequestStates, setFriendRequestStates] = useState<Record<string, 'sent' | 'friends'>>({});

  // Active sub-modals
  const [selectedChatPerson, setSelectedChatPerson] = useState<MeetPerson | null>(null);
  const [selectedProfilePerson, setSelectedProfilePerson] = useState<MeetPerson | null>(null);
  const [showTestSuite, setShowTestSuite] = useState(false);

  // Track meet_opened event when Meet opens. NO AD simply for opening Meet!
  useEffect(() => {
    adAnalytics.track('meet_opened');

    // Heartbeat & task sync
    fetch('/api/meet/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, age: user.age })
    }).catch(() => {});
  }, [user.id, user.age]);

  // Fetch people from server endpoint
  const fetchDiscoveryPeople = useCallback(
    async (mode: 'near_me' | 'worldwide', pageToLoad: number, append = false) => {
      setLoadingPeople(true);
      setErrorMessage(null);

      try {
        const endpoint = mode === 'near_me' ? '/api/meet/discover/near-me' : '/api/meet/discover/worldwide';
        const payload: any = {
          userId: user.id,
          age: user.age,
          page: pageToLoad,
          limit: 12
        };

        if (mode === 'near_me') {
          payload.latitude = user.privateLatitude;
          payload.longitude = user.privateLongitude;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch discovery candidates');
        }

        if (append) {
          setPeople(prev => [...prev, ...(data.people || [])]);
        } else {
          setPeople(data.people || []);
        }

        setPage(data.page || pageToLoad);
        setHasMore(Boolean(data.hasMore));
        setTotalCount(data.total || (data.people || []).length);
      } catch (err: any) {
        console.error('Error loading people:', err);
        setErrorMessage(err.message || 'Unable to load discovery results');
      } finally {
        setLoadingPeople(false);
      }
    },
    [user.id, user.age, user.privateLatitude, user.privateLongitude]
  );

  // Toggle Meet visibility ("Allow Me to Appear in Meet")
  const handleToggleMeet = async () => {
    setIsTogglingMeet(true);
    const nextState = !meetEnabled;
    try {
      const res = await fetch('/api/meet/toggle-enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          age: user.age,
          enabled: nextState
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update visibility setting');
      }

      setMeetEnabled(nextState);
      onUpdateUser({
        ...user,
        meetEnabled: nextState
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error updating Meet status');
    } finally {
      setIsTogglingMeet(false);
    }
  };

  // Request location permission
  const requestLocation = (mode: 'near_me' | 'worldwide') => {
    if (locationStatus === 'granted') {
      fetchDiscoveryPeople(mode, 1, false);
      return;
    }

    setLocationStatus('requesting');

    if (!navigator.geolocation) {
      setLocationStatus('denied');
      fetchDiscoveryPeople(mode, 1, false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setLocationStatus('granted');

        try {
          await fetch('/api/meet/update-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              age: user.age,
              latitude,
              longitude,
              permissionStatus: 'granted'
            })
          });

          onUpdateUser({
            ...user,
            locationPermissionStatus: 'granted',
            privateLatitude: latitude,
            privateLongitude: longitude
          });
        } catch (err) {
          console.error('Failed to update secure location coordinates', err);
        }

        fetchDiscoveryPeople(mode, 1, false);
      },
      async err => {
        console.warn('Geolocation permission denied or timed out:', err);
        setLocationStatus('denied');

        try {
          await fetch('/api/meet/update-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              age: user.age,
              permissionStatus: 'denied'
            })
          });

          onUpdateUser({
            ...user,
            locationPermissionStatus: 'denied'
          });
        } catch (updateErr) {
          console.error(updateErr);
        }

        fetchDiscoveryPeople(mode, 1, false);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  /**
   * Rule 4 & 8: NEAR ME AD
   * Free user: 1 advertisement
   * Premium user: 0 advertisements
   */
  const handleSelectNearMe = async () => {
    if (isTransitioningMode) return;
    setIsTransitioningMode(true);
    setErrorMessage(null);

    try {
      await showAd('interstitial', {
        requestedEvent: 'meet_near_me_ad_requested',
        shownEvent: 'meet_near_me_ad_shown',
        completedEvent: 'meet_near_me_ad_completed',
        failedEvent: 'meet_near_me_ad_failed',
        isPremium,
        actionId: 'meet_near_me_entry'
      });
    } catch (err) {
      console.warn('Near me ad error (continuing gracefully):', err);
      adAnalytics.track('meet_near_me_ad_failed', { error: String(err) });
    }

    setCurrentMode('near_me');
    requestLocation('near_me');
    setIsTransitioningMode(false);
  };

  /**
   * Rule 5 & 8: WORLDWIDE AD
   * Free user: 2 advertisements
   * Premium user: 0 advertisements
   */
  const handleSelectWorldwide = async () => {
    if (isTransitioningMode) return;
    setIsTransitioningMode(true);
    setErrorMessage(null);

    try {
      await showAdSequence(
        [
          {
            type: 'interstitial',
            options: {
              requestedEvent: 'meet_worldwide_ad_1_requested',
              shownEvent: 'meet_worldwide_ad_1_shown',
              completedEvent: 'meet_worldwide_ad_1_completed',
              actionId: 'worldwide_ad_1'
            }
          },
          {
            type: 'interstitial',
            options: {
              requestedEvent: 'meet_worldwide_ad_2_requested',
              shownEvent: 'meet_worldwide_ad_2_shown',
              completedEvent: 'meet_worldwide_ad_2_completed',
              actionId: 'worldwide_ad_2'
            }
          }
        ],
        isPremium
      );
    } catch (err) {
      console.warn('Worldwide ad sequence error (continuing gracefully):', err);
    }

    setCurrentMode('worldwide');
    fetchDiscoveryPeople('worldwide', 1, false);
    setIsTransitioningMode(false);
  };

  /**
   * Rule 6: CHAT AD
   * Free user: 1 advertisement before entering chat
   * Premium user: 0 ads
   * Protected with inFlightChatIds to prevent double triggers
   */
  const handleChatWithPerson = async (person: MeetPerson) => {
    if (inFlightChatIds.has(person.id)) return;
    setInFlightChatIds(prev => new Set(prev).add(person.id));

    try {
      await showAd('interstitial', {
        requestedEvent: 'chat_ad_requested',
        shownEvent: 'chat_ad_shown',
        completedEvent: 'chat_ad_completed',
        failedEvent: 'chat_ad_failed',
        isPremium,
        actionId: `chat_${person.id}`
      });
    } catch (err) {
      console.warn('Chat ad error (continuing gracefully):', err);
      adAnalytics.track('chat_ad_failed', { error: String(err) });
    }

    setSelectedChatPerson(person);
    setInFlightChatIds(prev => {
      const next = new Set(prev);
      next.delete(person.id);
      return next;
    });
  };

  /**
   * Rule 7: ADD FRIEND AD
   * Free user: 1 advertisement before friend request is processed
   * Premium user: 0 ads
   * Idempotent: exactly one request created
   */
  const handleAddFriend = async (person: MeetPerson) => {
    if (friendRequestStates[person.id] || inFlightFriendIds.has(person.id)) return;
    setInFlightFriendIds(prev => new Set(prev).add(person.id));

    try {
      await showAd('interstitial', {
        requestedEvent: 'add_friend_ad_requested',
        shownEvent: 'add_friend_ad_shown',
        completedEvent: 'add_friend_ad_completed',
        failedEvent: 'add_friend_ad_failed',
        isPremium,
        actionId: `add_friend_${person.id}`
      });
    } catch (err) {
      console.warn('Add friend ad error (continuing gracefully):', err);
      adAnalytics.track('add_friend_ad_failed', { error: String(err) });
    }

    try {
      const res = await fetch('/api/meet/friend-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          senderAge: user.age,
          receiverId: person.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send friend request');

      setFriendRequestStates(prev => ({
        ...prev,
        [person.id]: data.status === 'accepted' ? 'friends' : 'sent'
      }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch friend request');
    } finally {
      setInFlightFriendIds(prev => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
    }
  };

  // Remove blocked user immediately from local discovery list
  const handleUserBlocked = (blockedId: string) => {
    setPeople(prev => prev.filter(p => p.id !== blockedId));
  };

  return (
    <div
      id="meet-people-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <motion.div
        id="meet-people-modal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[90vh]"
      >
        {/* Header Bar */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="meet-people-heading" className="text-xl font-bold text-slate-900">
                MEET PEOPLE
              </h2>
              {/* User's own online status indicator */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect with people who share similar tasks and stay accountable.
            </p>
          </div>
          <button
            id="close-meet-people-btn"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* HOME MODE: Option selection */}
          {currentMode === 'home' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy First:</strong> Your exact GPS coordinates, phone number, and private task details are strictly protected and never displayed to other users.
                </span>
              </div>

              {/* Discovery Entry Buttons */}
              <div className="grid grid-cols-1 gap-3">
                {/* [ MEET PEOPLE NEAR ME ] */}
                <button
                  type="button"
                  id="meet-near-me-btn"
                  disabled={isTransitioningMode}
                  onClick={handleSelectNearMe}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group flex items-start gap-3.5 disabled:opacity-60 shadow-xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        📍 MEET PEOPLE NEAR ME
                      </h3>
                      {!isPremium && (
                        <span className="text-[10px] text-slate-400 font-medium">1 Ad</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Find eligible people within an approximate local radius who share similar tasks.
                    </p>
                  </div>
                </button>

                {/* [ MEET PEOPLE WORLDWIDE ] */}
                <button
                  type="button"
                  id="meet-worldwide-btn"
                  disabled={isTransitioningMode}
                  onClick={handleSelectWorldwide}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-left transition-all group flex items-start gap-3.5 disabled:opacity-60 shadow-xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        🌎 MEET PEOPLE WORLDWIDE
                      </h3>
                      {!isPremium && (
                        <span className="text-[10px] text-slate-400 font-medium">2 Ads</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Discover accountability partners and peers with shared interests across the globe.
                    </p>
                  </div>
                </button>
              </div>

              {/* Allow Me to Appear in Meet (ON/OFF Toggle) */}
              <div
                id="meet-visibility-toggle-card"
                className="pt-4 border-t border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  {meetEnabled ? (
                    <Eye className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Allow Me to Appear in Meet
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {meetEnabled
                        ? 'You are currently discoverable to other Meet members'
                        : 'You are hidden from discovery. Alarms and tasks work normally.'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  id="toggle-meet-visibility-btn"
                  onClick={handleToggleMeet}
                  disabled={isTogglingMeet}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    meetEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                  aria-label="Toggle Meet Visibility"
                >
                  <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-xs" />
                </button>
              </div>
            </div>
          )}

          {/* DISCOVERY LIST: Near Me or Worldwide */}
          {currentMode !== 'home' && (
            <div className="space-y-4">
              {/* Mode Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  {currentMode === 'near_me' ? (
                    <>
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>People Near Me</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>People Worldwide</span>
                    </>
                  )}
                </h3>
                <button
                  id="change-meet-mode-btn"
                  onClick={() => setCurrentMode('home')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Switch Mode
                </button>
              </div>

              {/* Location Request in Progress */}
              {locationStatus === 'requesting' && (
                <div className="py-6 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    Finding people within your approximate area...
                  </p>
                </div>
              )}

              {/* Location Denied Banner */}
              {currentMode === 'near_me' && locationStatus === 'denied' && (
                <div
                  id="location-denied-box"
                  className="py-3 px-4 text-center space-y-2 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs"
                >
                  <p className="text-amber-800 font-medium">
                    Location permission was not granted. Showing discovery using your registered city ({user.city || user.country}).
                  </p>
                  <button
                    type="button"
                    id="try-again-location-btn"
                    onClick={() => requestLocation('near_me')}
                    className="py-1 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-semibold inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Enable Exact Radius</span>
                  </button>
                </div>
              )}

              {/* Loading State */}
              {loadingPeople && people.length === 0 && (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Discovering members with similar tasks...</p>
                </div>
              )}

              {/* Empty State */}
              {!loadingPeople && people.length === 0 && (
                <div className="py-10 text-center space-y-3 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {currentMode === 'near_me'
                      ? 'No suitable people found near you yet'
                      : 'No people are available for this discovery right now'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {currentMode === 'near_me'
                      ? 'Try expanding to Meet People Worldwide to connect with accountability partners across the globe.'
                      : 'Check back soon as more verified members complete their profiles.'}
                  </p>
                  {currentMode === 'near_me' && (
                    <button
                      type="button"
                      id="fallback-worldwide-btn"
                      onClick={handleSelectWorldwide}
                      className="py-2 px-4 bg-blue-600 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Explore Worldwide</span>
                    </button>
                  )}
                </div>
              )}

              {/* People Cards List (Scrolling here NEVER triggers ads repeatedly) */}
              <div id="meet-people-list-container" className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {people.map(person => {
                  const isFriendSent = friendRequestStates[person.id] === 'sent' || person.friendStatus === 'pending';
                  const isFriends = friendRequestStates[person.id] === 'friends' || person.friendStatus === 'accepted';
                  const isChatLoading = inFlightChatIds.has(person.id);
                  const isFriendLoading = inFlightFriendIds.has(person.id);

                  return (
                    <div
                      key={person.id}
                      id={`meet-person-card-${person.id}`}
                      className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 transition-colors"
                    >
                      {/* Top Row: Avatar, First Name, Marital Status, Online Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {person.photoUrl ? (
                              <img
                                src={person.photoUrl}
                                alt={person.name}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                {person.name.charAt(0)}
                              </div>
                            )}
                            {person.onlineStatus === 'online' && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{person.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                • {person.maritalStatus}
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {person.approximateLocation}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">
                          {person.lastSeenText}
                        </span>
                      </div>

                      {/* Shared Task / Similarity Signal (No private text exposed) */}
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                          <Sparkles className="w-3 h-3 text-blue-500" />
                          <span>Task Similarity:</span>
                        </div>
                        <span className="font-semibold text-slate-800 text-[11px] truncate ml-2">
                          {person.currentTask}
                        </span>
                      </div>

                      {/* Action Buttons: View Profile, Chat, Add Friend */}
                      <div className="flex items-center gap-2 pt-1">
                        {/* VIEW PROFILE */}
                        <button
                          type="button"
                          id={`view-profile-btn-${person.id}`}
                          onClick={() => setSelectedProfilePerson(person)}
                          className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-xs"
                        >
                          <span>Profile</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {/* CHAT Button */}
                        <button
                          type="button"
                          id={`chat-btn-${person.id}`}
                          disabled={isChatLoading}
                          onClick={() => handleChatWithPerson(person)}
                          className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                        >
                          {isChatLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                          <span>Chat</span>
                        </button>

                        {/* ADD FRIEND Button */}
                        <button
                          type="button"
                          id={`add-friend-btn-${person.id}`}
                          disabled={isFriendSent || isFriends || isFriendLoading}
                          onClick={() => handleAddFriend(person)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                            isFriends
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                              : isFriendSent
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 disabled:opacity-50 shadow-xs'
                          }`}
                        >
                          {isFriendLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isFriends ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Friends</span>
                            </>
                          ) : isFriendSent ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination: Load More */}
                {hasMore && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      id="load-more-people-btn"
                      disabled={loadingPeople}
                      onClick={() => fetchDiscoveryPeople(currentMode as any, page + 1, true)}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      {loadingPeople && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Load More Members</span>
                    </button>
                  </div>
                )}

                {/* Banner Placement: at bottom of people list */}
                <AdBanner isPremium={isPremium} placement="meet" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            id="meet-test-suite-btn"
            onClick={() => setShowTestSuite(true)}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1.5 hover:underline"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Verification Suite (30 Tests)</span>
          </button>
          <button
            type="button"
            id="close-meet-btn"
            onClick={onClose}
            className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl"
          >
            Done
          </button>
        </div>
      </motion.div>

      {/* Test Suite Modal */}
      {showTestSuite && (
        <MeetTestSuiteModal onClose={() => setShowTestSuite(false)} />
      )}

      {/* Meet Profile Modal */}
      {selectedProfilePerson && (
        <MeetProfileModal
          person={selectedProfilePerson}
          currentUserId={user.id}
          currentUserAge={user.age}
          isPremium={isPremium}
          onClose={() => setSelectedProfilePerson(null)}
          onStartChat={person => {
            setSelectedProfilePerson(null);
            handleChatWithPerson(person);
          }}
          onAddFriend={person => {
            handleAddFriend(person);
          }}
          onUserBlocked={blockedId => {
            handleUserBlocked(blockedId);
            setSelectedProfilePerson(null);
          }}
          isChatLoading={inFlightChatIds.has(selectedProfilePerson.id)}
          isFriendLoading={inFlightFriendIds.has(selectedProfilePerson.id)}
          isFriendSent={friendRequestStates[selectedProfilePerson.id] === 'sent'}
        />
      )}

      {/* Meet Chat Modal */}
      {selectedChatPerson && (
        <MeetChatModal
          person={selectedChatPerson}
          currentUserId={user.id}
          currentUserAge={user.age}
          currentUserName={user.name}
          onClose={() => setSelectedChatPerson(null)}
        />
      )}
    </div>
  );
}
