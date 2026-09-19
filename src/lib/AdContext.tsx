import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PlayCircle, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { adAnalytics, AdEventName } from './adAnalytics';

export type AdType = 'interstitial' | 'rewarded';

export interface ShowAdOptions {
  requestedEvent?: AdEventName;
  shownEvent?: AdEventName;
  completedEvent?: AdEventName;
  failedEvent?: AdEventName;
  isPremium?: boolean;
  simulateFailure?: boolean;
  actionId?: string;
}

interface ActiveAdSession {
  type: AdType;
  options?: ShowAdOptions;
  onComplete: (success: boolean) => void;
}

interface AdContextType {
  showAd: (type: AdType, options?: ShowAdOptions) => Promise<boolean>;
  showAdSequence: (ads: { type: AdType; options?: ShowAdOptions }[], isPremium?: boolean) => Promise<boolean>;
  isAdActive: boolean;
  simulateNextAdFailure: boolean;
  setSimulateNextAdFailure: (fail: boolean) => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export function AdProvider({ children }: { children: ReactNode }) {
  const [adState, setAdState] = useState<ActiveAdSession | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulateNextAdFailure, setSimulateNextAdFailure] = useState(false);

  // In-flight action deduplication lock
  const inFlightActionsRef = useRef<Set<string>>(new Set());

  const showAd = (type: AdType, options?: ShowAdOptions): Promise<boolean> => {
    // 1. Premium Bypass: Premium users never see advertisements
    if (options?.isPremium) {
      return Promise.resolve(true);
    }

    // 2. Action Idempotency Guard
    if (options?.actionId) {
      if (inFlightActionsRef.current.has(options.actionId)) {
        console.warn(`[AdContext] Action "${options.actionId}" is already in flight. Suppressing duplicate ad trigger.`);
        return Promise.resolve(false);
      }
      inFlightActionsRef.current.add(options.actionId);
    }

    // Track ad requested event
    if (options?.requestedEvent) {
      adAnalytics.track(options.requestedEvent);
    }

    // 3. Graceful Failure Simulation / Ad Network Outage Check
    if (options?.simulateFailure || simulateNextAdFailure) {
      if (simulateNextAdFailure) {
        setSimulateNextAdFailure(false);
      }
      if (options?.failedEvent) {
        adAnalytics.track(options.failedEvent, { reason: 'ad_network_unavailable' });
      }
      if (options?.actionId) {
        inFlightActionsRef.current.delete(options.actionId);
      }
      console.warn('[AdContext] Ad failed to load (simulated/unavailable). Continuing gracefully.');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      // Track ad shown event when opening modal
      if (options?.shownEvent) {
        adAnalytics.track(options.shownEvent);
      }

      setAdState({
        type,
        options,
        onComplete: (success: boolean) => {
          if (success) {
            if (options?.completedEvent) {
              adAnalytics.track(options.completedEvent);
            }
          } else {
            if (options?.failedEvent) {
              adAnalytics.track(options.failedEvent, { reason: 'user_dismissed_or_cancelled' });
            } else if (options?.completedEvent) {
              // Still consider closed interstitial as completed interaction
              adAnalytics.track(options.completedEvent);
            }
          }

          if (options?.actionId) {
            inFlightActionsRef.current.delete(options.actionId);
          }

          setAdState(null);
          setIsPlaying(false);
          resolve(success);
        }
      });
    });
  };

  /**
   * Helper to show multiple advertisements sequentially (e.g. Worldwide 2-ad sequence).
   * If an ad fails or is unavailable, fails gracefully and continues.
   */
  const showAdSequence = async (
    ads: { type: AdType; options?: ShowAdOptions }[],
    isPremium?: boolean
  ): Promise<boolean> => {
    if (isPremium) return true;

    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      try {
        await showAd(ad.type, { ...ad.options, isPremium });
      } catch (err) {
        console.error(`[AdContext] Ad sequence step ${i + 1} failed:`, err);
        if (ad.options?.failedEvent) {
          adAnalytics.track(ad.options.failedEvent, { error: String(err) });
        }
      }
    }
    return true;
  };

  const handlePlay = () => {
    setIsPlaying(true);
    // Simulate short ad completion (1.5 seconds)
    setTimeout(() => {
      if (adState) {
        adState.onComplete(true);
      }
    }, 1500);
  };

  const handleClose = () => {
    if (adState) {
      adState.onComplete(true); // User dismissed/closed interstitial
    }
  };

  return (
    <AdContext.Provider
      value={{
        showAd,
        showAdSequence,
        isAdActive: Boolean(adState),
        simulateNextAdFailure,
        setSimulateNextAdFailure
      }}
    >
      {children}

      <AnimatePresence>
        {adState && (
          <div
            id="ad-overlay-backdrop"
            className="fixed inset-0 z-[300] flex flex-col justify-center items-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              id="ad-interstitial-card"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-100"
            >
              {/* Header */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-200/80 px-2 py-0.5 rounded-full">
                    Sponsored
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {adState.type === 'rewarded' ? 'Rewarded Ad' : 'Advertisement'}
                  </span>
                </div>
                {(!isPlaying || adState.type !== 'rewarded') && (
                  <button
                    id="close-ad-btn"
                    onClick={handleClose}
                    aria-label="Close Advertisement"
                    className="p-1.5 bg-slate-200/80 rounded-full text-slate-600 hover:bg-slate-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Ad Content */}
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[280px]">
                {!isPlaying ? (
                  <>
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-xs">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1.5">Daily TASK AI Spotlight</h3>
                    <p className="text-xs text-slate-500 mb-6 max-w-xs leading-relaxed">
                      Stay focused and organized throughout your day with smart voice scheduling and daily habit tracking.
                    </p>
                    <button
                      type="button"
                      id="continue-after-ad-btn"
                      onClick={handleClose}
                      className="w-full bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs hover:bg-slate-800 active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2"
                    >
                      <span>Continue to Daily TASK AI</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                    <h3 className="text-lg font-bold text-slate-900">Loading Advertisement...</h3>
                    <p className="text-xs text-slate-500 mt-1">Please wait a moment.</p>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdContext.Provider>
  );
}

export function useAdManager() {
  const context = useContext(AdContext);
  if (context === undefined) {
    throw new Error('useAdManager must be used within an AdProvider');
  }
  return context;
}
