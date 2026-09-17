const fs = require('fs');

const code = `import { useState, useRef, useEffect } from 'react';
import { User, Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Loader2, AlertCircle } from 'lucide-react';
import { getUserTimezone } from '../lib/dateUtils';

type VoiceState = 'idle' | 'listening' | 'processing' | 'clarifying' | 'confirming' | 'error';

export function VoiceTaskModal({ user, onClose, onSaved }: { user: User, onClose: () => void, onSaved: () => void }) {
  const { saveTask } = useTasks();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<{ task?: string; date?: string; time?: string; missingTask?: boolean; missingTime?: boolean; error?: string } | null>(null);
  const [clarificationMsg, setClarificationMsg] = useState('');
  
  // For fallback testing
  const [simulatedInput, setSimulatedInput] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const voiceStateRef = useRef<VoiceState>('idle');

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    // Initialize Web Speech API
    if (typeof window !== 'undefined' && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          setSimulatedInput(currentTranscript);
          transcriptRef.current = currentTranscript;
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') {
            setClarificationMsg("Microphone permission is required to use Speak Task. Please allow microphone access and try again.");
            setVoiceState('error');
          } else {
            setClarificationMsg("Speech recognition error: " + event.error);
            setVoiceState('error');
          }
        };

        recognitionRef.current.onend = () => {
          console.log("Speech recognition ended. Final transcript:", transcriptRef.current);
          if (voiceStateRef.current === 'listening') {
            if (transcriptRef.current.trim()) {
              handleProcess(transcriptRef.current);
            } else {
              setVoiceState('idle');
            }
          }
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = async () => {
    console.log("Microphone permission requested");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone permission granted");
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Microphone permission denied", err);
      setClarificationMsg("Microphone permission is required to use Speak Task. Please allow microphone access and try again.");
      setVoiceState('error');
      return;
    }

    if (!recognitionRef.current) {
      setClarificationMsg("Speech recognition is not supported in this browser.");
      setVoiceState('error');
      return;
    }

    setTranscript('');
    setSimulatedInput('');
    transcriptRef.current = '';
    setVoiceState('listening');
    console.log("Speech recognition started");
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error starting speech recognition:", e);
      // If it's already started, this will throw, which is fine to ignore.
    }
  };

  const handleProcess = async (text: string) => {
    if (!text.trim()) {
      setVoiceState('idle');
      return;
    }
    
    setVoiceState('processing');
    try {
      const res = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userTimezone: getUserTimezone() })
      });
      const data = await res.json();
      
      if (data.error) {
        setParsedData({ error: data.error });
        setClarificationMsg("I couldn't clearly understand that task.");
        setVoiceState('clarifying');
      } else if (data.missingTask) {
        setParsedData(data);
        setClarificationMsg("What task do you want to be reminded about?");
        setVoiceState('clarifying');
      } else if (data.missingTime) {
        setParsedData(data);
        setClarificationMsg("What's the reminder time?");
        setVoiceState('clarifying');
      } else {
        setParsedData(data);
        setVoiceState('confirming');
      }
    } catch (err) {
      console.error(err);
      setParsedData({ error: "Failed to parse." });
      setClarificationMsg("I couldn't clearly understand that task.");
      setVoiceState('clarifying');
    }
  };

  const handleSimulate = () => {
    setTranscript(simulatedInput);
    transcriptRef.current = simulatedInput;
    handleProcess(simulatedInput);
    // setSimulatedInput(''); // Keep it so they see it
  };

  const handleConfirm = async () => {
    if (!parsedData || !parsedData.task) return;
    try {
      const newTask: Task = {
        id: crypto.randomUUID(),
        userId: user.id,
        taskText: parsedData.task,
        scheduledDate: parsedData.date || 'Today',
        scheduledTime: parsedData.time || '',
        timezone: getUserTimezone(),
        status: 'Pending',
        createdTimestamp: Date.now(),
        completedTimestamp: null,
      };

      await saveTask(newTask);
      console.log("Task created from transcript", newTask);
      await onSaved();
    } catch (err) {
      console.error('Failed to confirm and save voice task:', err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-t-3xl p-6 relative z-10 shadow-2xl min-h-[50vh] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">
              {voiceState === 'confirming' ? "Here's what I understood:" : "Voice Assistant"}
            </h3>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center">
            
            {voiceState === 'idle' && (
              <div className="text-center">
                <button 
                  onClick={startListening}
                  className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white mb-6 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 mx-auto"
                >
                  <Mic className="w-10 h-10" />
                </button>
                <p className="text-slate-500 font-medium">Tap to speak</p>
              </div>
            )}

            {voiceState === 'listening' && (
              <div className="text-center w-full">
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center text-white mb-6 mx-auto animate-pulse shadow-xl shadow-red-500/30">
                  <Mic className="w-10 h-10" />
                </div>
                <p className="text-slate-800 text-lg min-h-[3rem] italic px-4">
                  {transcript || "Listening..."}
                </p>
              </div>
            )}

            {voiceState === 'processing' && (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Processing your request...</p>
              </div>
            )}

            {voiceState === 'clarifying' && (
              <div className="text-center w-full">
                <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl mb-6 flex items-start gap-3 text-left border border-amber-200">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600 mt-0.5" />
                  <p className="font-medium text-lg leading-tight">{clarificationMsg}</p>
                </div>
                <button 
                  onClick={startListening}
                  className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white mb-4 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 mx-auto"
                >
                  <Mic className="w-8 h-8" />
                </button>
                <p className="text-slate-500 font-medium text-sm">Tap to reply</p>
              </div>
            )}

            {voiceState === 'error' && (
              <div className="text-center w-full">
                <div className="bg-red-50 text-red-800 p-4 rounded-2xl mb-6 flex items-start gap-3 text-left border border-red-200">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600 mt-0.5" />
                  <p className="font-medium text-lg leading-tight">{clarificationMsg}</p>
                </div>
                <button 
                  onClick={() => setVoiceState('idle')}
                  className="bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-300 transition-colors mx-auto"
                >
                  Try Again
                </button>
              </div>
            )}

            {voiceState === 'confirming' && parsedData && (
              <div className="w-full">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Task</p>
                    <p className="text-lg font-semibold text-slate-900">{parsedData.task}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                      <p className="text-md font-semibold text-slate-900">{parsedData.date}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Time</p>
                      <p className="text-md font-semibold text-slate-900">{parsedData.time}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button onClick={handleConfirm} className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all">
                    Confirm Task
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => setVoiceState('idle')} className="flex-1 bg-white border border-slate-200 text-slate-700 font-semibold py-3.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all">
                      Edit
                    </button>
                    <button onClick={onClose} className="flex-1 bg-white border border-slate-200 text-slate-700 font-semibold py-3.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-red-600">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback manual input for automated testing when Mic is not available */}
            {voiceState !== 'confirming' && (
              <div className="mt-10 w-full pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-400 text-center mb-2">Or type natural language (Testing fallback)</p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 px-4 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none"
                    placeholder="e.g. Remind me to call John at 6 PM"
                    value={simulatedInput}
                    onChange={(e) => {
                      setSimulatedInput(e.target.value);
                      if (voiceState === 'listening') {
                        setTranscript(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
                  />
                  <button onClick={handleSimulate} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-300">
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
`

fs.writeFileSync('src/components/VoiceTaskModal.tsx', code);
