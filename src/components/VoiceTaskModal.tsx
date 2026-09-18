import { useState, useRef, useEffect } from 'react';
import { User, Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Loader2, AlertCircle, Send } from 'lucide-react';
import { getUserTimezone } from '../lib/dateUtils';

type VoiceState = 'idle' | 'listening' | 'processing' | 'clarifying' | 'confirming' | 'error';

interface ParsedTaskData {
  task?: string;
  date?: string;
  time?: string;
  recurrenceRule?: string | null;
  missingTask?: boolean;
  missingTime?: boolean;
  error?: string;
}

export function VoiceTaskModal({ user, onClose, onSaved }: { user: User, onClose: () => void, onSaved: () => void }) {
  const { saveTask } = useTasks();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [parsedData, setParsedData] = useState<ParsedTaskData | null>(null);
  const [clarificationMsg, setClarificationMsg] = useState('');

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const taskInputRef = useRef<string>('');
  const voiceStateRef = useRef<VoiceState>('idle');
  const isSubmittingRef = useRef<boolean>(false);

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
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript;
          }
          const trimmed = fullTranscript.trim();
          console.log("[VoiceTaskModal] Speech recognized:", trimmed);
          setTranscript(trimmed);
          setTaskInput(trimmed);
          transcriptRef.current = trimmed;
          taskInputRef.current = trimmed;
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('[VoiceTaskModal] Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setClarificationMsg("Microphone permission is required to use Speak Task. Please allow microphone access and try again.");
            voiceStateRef.current = 'error';
            setVoiceState('error');
          } else if (event.error === 'no-speech') {
            console.warn("[VoiceTaskModal] No speech detected");
            if (!taskInputRef.current && !transcriptRef.current) {
              voiceStateRef.current = 'idle';
              setVoiceState('idle');
            }
          } else {
            setClarificationMsg("Speech recognition error: " + event.error);
            voiceStateRef.current = 'error';
            setVoiceState('error');
          }
        };

        recognitionRef.current.onend = () => {
          console.log("[VoiceTaskModal] Speech recognition ended. Current transcript:", transcriptRef.current);
          if (isSubmittingRef.current) {
            return;
          }
          if (voiceStateRef.current === 'listening') {
            const finalSpeech = (taskInputRef.current || transcriptRef.current).trim();
            if (finalSpeech) {
              handleTaskSubmit(finalSpeech);
            } else {
              voiceStateRef.current = 'idle';
              setVoiceState('idle');
            }
          }
        };
      }
    }

    // Auto-start listening on mount when modal opens from "Tap to Speak Task"
    startListening();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = async () => {
    console.log("[VoiceTaskModal] Microphone requested");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("navigator.mediaDevices.getUserMedia not supported in this browser.");
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("[VoiceTaskModal] Microphone permission granted");
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.error("[VoiceTaskModal] Microphone permission denied", err);
      setClarificationMsg("Microphone permission is required to use Speak Task. Please allow microphone access or type your task below.");
      voiceStateRef.current = 'error';
      setVoiceState('error');
      return;
    }

    if (!recognitionRef.current) {
      setClarificationMsg("Speech recognition is not supported in this browser. You can type your task below.");
      voiceStateRef.current = 'error';
      setVoiceState('error');
      return;
    }

    setTranscript('');
    setTaskInput('');
    transcriptRef.current = '';
    taskInputRef.current = '';
    voiceStateRef.current = 'listening';
    setVoiceState('listening');
    console.log("[VoiceTaskModal] Speech recognition started");
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("Recognition already active or restart error:", e);
    }
  };

  const handleTaskSubmit = async (overrideText?: string) => {
    // Prevent overlapping simultaneous submissions
    if (isSubmittingRef.current) {
      console.log("[VoiceTaskModal] Already submitting, ignoring duplicate trigger");
      return;
    }
    isSubmittingRef.current = true;

    // If voice recognition is currently running, stop it cleanly
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    // Always resolve the freshest available text (override argument, refs, or state)
    const textToProcess = (
      (typeof overrideText === 'string' && overrideText.trim())
        ? overrideText
        : (taskInputRef.current || transcriptRef.current || taskInput || transcript)
    ).trim();

    console.log("[VoiceTaskModal] handleTaskSubmit called with text:", textToProcess);

    // Empty input validation - do not call API unnecessarily
    if (!textToProcess) {
      isSubmittingRef.current = false;
      voiceStateRef.current = 'clarifying';
      setVoiceState('clarifying');
      setClarificationMsg("Please enter or speak a task first.");
      return;
    }

    voiceStateRef.current = 'processing';
    setVoiceState('processing');

    try {
      const res = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToProcess,
          text: textToProcess,
          userTimezone: getUserTimezone()
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data: ParsedTaskData = await res.json();
      console.log("[VoiceTaskModal] parse-task response:", data);

      if (data.error) {
        setParsedData({ error: data.error });
        setClarificationMsg("I couldn't clearly understand that task. Please include what you want to do and the time.");
        voiceStateRef.current = 'clarifying';
        setVoiceState('clarifying');
      } else {
        // Contextual clarification merging: if user previously had task or time, merge missing fields
        let resolvedTask = data.task || "";
        let resolvedDate = data.date || "Today";
        let resolvedTime = data.time || "";
        let resolvedRecurrence = data.recurrenceRule || null;
        let isMissingTask = Boolean(data.missingTask);
        let isMissingTime = Boolean(data.missingTime);

        if (parsedData) {
          if (isMissingTask && parsedData.task) {
            resolvedTask = parsedData.task;
            isMissingTask = false;
          }
          if (isMissingTime && parsedData.time) {
            resolvedTime = parsedData.time;
            isMissingTime = false;
          }
          if (!resolvedRecurrence && parsedData.recurrenceRule) {
            resolvedRecurrence = parsedData.recurrenceRule;
          }
        }

        const mergedData: ParsedTaskData = {
          task: resolvedTask,
          date: resolvedDate,
          time: resolvedTime,
          recurrenceRule: resolvedRecurrence,
          missingTask: isMissingTask,
          missingTime: isMissingTime
        };

        if (isMissingTask) {
          setParsedData(mergedData);
          setClarificationMsg("What task do you want to be reminded about?");
          voiceStateRef.current = 'clarifying';
          setVoiceState('clarifying');
        } else if (isMissingTime) {
          setParsedData(mergedData);
          setClarificationMsg("What's the reminder time?");
          voiceStateRef.current = 'clarifying';
          setVoiceState('clarifying');
        } else {
          setParsedData(mergedData);
          voiceStateRef.current = 'confirming';
          setVoiceState('confirming');
        }
      }
    } catch (err) {
      console.error("[VoiceTaskModal] Failed to parse task:", err);
      setParsedData({ error: "Failed to parse." });
      setClarificationMsg("I couldn't clearly understand that task. Please try typing it below.");
      voiceStateRef.current = 'clarifying';
      setVoiceState('clarifying');
    } finally {
      isSubmittingRef.current = false;
    }
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
        recurrenceRule: parsedData.recurrenceRule || undefined,
        status: 'Pending',
        createdTimestamp: Date.now(),
        completedTimestamp: null,
      };

      await saveTask(newTask);
      console.log("[VoiceTaskModal] Task created and saved:", newTask);
      await onSaved();
    } catch (err) {
      console.error('Failed to confirm and save task:', err);
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
          className="bg-white rounded-t-3xl p-6 relative z-10 shadow-2xl min-h-[52vh] flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-900">
              {voiceState === 'confirming' ? "Here's what I understood:" : "Voice Assistant"}
            </h3>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center">
            
            {voiceState === 'idle' && (
              <div className="text-center my-auto">
                <button 
                  onClick={startListening}
                  className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white mb-4 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 mx-auto"
                >
                  <Mic className="w-10 h-10" />
                </button>
                <p className="text-slate-600 font-semibold">Tap to speak</p>
                <p className="text-xs text-slate-400 mt-1">or type your reminder below</p>
              </div>
            )}

            {voiceState === 'listening' && (
              <div className="text-center w-full my-auto">
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center text-white mb-4 mx-auto animate-pulse shadow-xl shadow-red-500/30">
                  <Mic className="w-10 h-10" />
                </div>
                <p className="text-slate-800 text-lg min-h-[3rem] italic px-4 font-medium">
                  {transcript || "Listening... speak now"}
                </p>
              </div>
            )}

            {voiceState === 'processing' && (
              <div className="text-center my-auto">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Processing your request...</p>
              </div>
            )}

            {voiceState === 'clarifying' && (
              <div className="text-center w-full my-auto">
                <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl mb-5 flex items-start gap-3 text-left border border-amber-200">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600 mt-0.5" />
                  <p className="font-medium text-base leading-tight">{clarificationMsg}</p>
                </div>
                <button 
                  onClick={startListening}
                  className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white mb-3 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 mx-auto"
                >
                  <Mic className="w-8 h-8" />
                </button>
                <p className="text-slate-500 font-medium text-sm">Tap to reply with voice</p>
              </div>
            )}

            {voiceState === 'error' && (
              <div className="text-center w-full my-auto">
                <div className="bg-red-50 text-red-800 p-4 rounded-2xl mb-5 flex items-start gap-3 text-left border border-red-200">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600 mt-0.5" />
                  <p className="font-medium text-sm leading-tight">{clarificationMsg}</p>
                </div>
                <button 
                  onClick={() => setVoiceState('idle')}
                  className="bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-300 transition-colors mx-auto text-sm"
                >
                  Try Again
                </button>
              </div>
            )}

            {voiceState === 'confirming' && parsedData && (
              <div className="w-full my-auto">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-5 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Task</p>
                    <p className="text-lg font-bold text-slate-900">{parsedData.task}</p>
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
                  {parsedData.recurrenceRule && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Recurrence</p>
                      <p className="text-sm font-semibold text-blue-600">{parsedData.recurrenceRule}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  <button onClick={handleConfirm} className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all">
                    Confirm Task
                  </button>
                  <div className="flex gap-2.5">
                    <button onClick={() => setVoiceState('idle')} className="flex-1 bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-sm">
                      Edit
                    </button>
                    <button onClick={onClose} className="flex-1 bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-red-600 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Natural language typed task input — synchronized with speech transcript */}
            {voiceState !== 'confirming' && (
              <div className="mt-6 w-full pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    disabled={voiceState === 'processing'}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white outline-none transition-all disabled:opacity-60"
                    placeholder="e.g. Remind me to study at 7 PM today"
                    value={taskInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskInput(val);
                      taskInputRef.current = val;
                      setTranscript(val);
                      transcriptRef.current = val;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && voiceState !== 'processing') {
                        e.preventDefault();
                        handleTaskSubmit();
                      }
                    }}
                  />
                  <button 
                    onClick={() => handleTaskSubmit()} 
                    disabled={voiceState === 'processing'}
                    className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Send</span>
                    <Send className="w-4 h-4" />
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

