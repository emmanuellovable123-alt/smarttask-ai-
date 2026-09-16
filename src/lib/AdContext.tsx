import { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PlayCircle, Loader2 } from 'lucide-react';

export type AdType = 'interstitial' | 'rewarded';

interface AdContextType {
  showAd: (type: AdType) => Promise<boolean>;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export function AdProvider({ children }: { children: ReactNode }) {
  const [adState, setAdState] = useState<{ type: AdType; onComplete: (success: boolean) => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const showAd = (type: AdType): Promise<boolean> => {
    return new Promise((resolve) => {
      setAdState({
        type,
        onComplete: (success) => {
          setAdState(null);
          setIsPlaying(false);
          resolve(success);
        }
      });
    });
  };

  const handlePlay = () => {
    setIsPlaying(true);
    // Simulate an ad video completion after 3 seconds
    setTimeout(() => {
      if (adState) {
        adState.onComplete(true);
      }
    }, 3000);
  };

  const handleClose = () => {
    if (adState) {
      adState.onComplete(false); // Cancelled or closed early
    }
  };

  return (
    <AdContext.Provider value={{ showAd }}>
      {children}
      
      <AnimatePresence>
        {adState && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-center items-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {adState.type === 'rewarded' ? 'Rewarded Advertisement' : 'Advertisement'}
                </span>
                {(!isPlaying || adState.type !== 'rewarded') && (
                  <button onClick={handleClose} className="p-2 bg-slate-200 rounded-full text-slate-600 hover:bg-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                {!isPlaying ? (
                  <>
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-blue-200">
                       <PlayCircle className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Special Offer</h3>
                    <p className="text-slate-500 mb-8">
                      {adState.type === 'rewarded' 
                        ? 'Watch this short video to unlock your reward!' 
                        : 'Discover amazing new tools to boost your productivity today.'}
                    </p>
                    <button 
                      onClick={handlePlay}
                      className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      {adState.type === 'rewarded' ? 'Watch Video' : 'Continue'}
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-slate-900">Playing Advertisement...</h3>
                    <p className="text-slate-500 text-sm mt-2">Please wait until the video finishes.</p>
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
