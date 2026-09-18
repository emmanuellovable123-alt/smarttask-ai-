import { useState, useRef, useEffect } from 'react';
import { User, Task } from '../types';
import { useTasks } from '../lib/TaskContext';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Loader2, AlertCircle, Send, Trash2, Plus, Clock, Calendar, Check, Square } from 'lucide-react';
import { getUserTimezone } from '../lib/dateUtils';
import { parseMultiTaskFallback } from '../lib/taskParsingEngine';

type VoiceState = 'idle' | 'listening' | 'processing' | 'reviewing' | 'clarifying' | 'error';

interface ReviewTaskItem {
  id: string;
  task: string;
  date: string;
  time: string;
  recurrenceRule: string | null;
}

interface ParsedTaskApiResponse {
  success?: boolean;
  tasks?: Array<{
    task: string;
    date: string;
    time: string;
    recurrenceRule?: string | null;
  }>;
  totalFound?: number;
  hasMoreThanSeven?: boolean;
  rawTranscript?: string;
  task?: string;
  date?: string;
  time?: string;
  recurrenceRule?: string | null;
  missingTask?: boolean;
  missingTime?: boolean;
  error?: string;
  errorCategory?: string;
  message?: string;
  diagnostic?: {
    source?: string;
    modelAttempted?: string;
    httpStatus?: number;
    errorCategory?: string;
    errorMessage?: string;
    durationMs?: number;
  };
}

export function VoiceTaskModal({ user, onClose, onSaved }: { user: User, onClose: () => void, onSaved: () => void }) {
  const { saveTask } = useTasks();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [reviewTasks, setReviewTasks] = useState<ReviewTaskItem[]>([]);
  const [hasMoreThanSeven, setHasMoreThanSeven] = useState(false);
  const [rawTranscript, setRawTranscript] = useState('');
  const [clarificationMsg, setClarificationMsg] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const taskInputRef = useRef<string>('');
  const voiceStateRef = useRef<VoiceState>('idle');
  const isSubmittingRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<any>(null);
  const recordingSecondsRef = useRef<number>(0);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    // Initialize Web Speech API
    if (typeof window !== 'undefined' && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript + ' ';
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
            clearTimer();
            setClarificationMsg("Microphone permission is required. Please allow microphone access or type your task below.");
            voiceStateRef.current = 'error';
            setVoiceState('error');
          } else if (event.error === 'no-speech') {
            console.warn("[VoiceTaskModal] No speech detected yet");
          } else {
            console.warn("[VoiceTaskModal] Non-fatal speech error:", event.error);
          }
        };

        recognitionRef.current.onend = () => {
          console.log("[VoiceTaskModal] Speech recognition onend triggered. State:", voiceStateRef.current);
          if (isSubmittingRef.current) {
            return;
          }
          // If listening and user reached 60s or finished
          if (voiceStateRef.current === 'listening') {
            if (recordingSecondsRef.current >= 60) {
              clearTimer();
              const finalSpeech = (taskInputRef.current || transcriptRef.current).trim();
              if (finalSpeech) {
                handleTaskSubmit(finalSpeech);
              } else {
                voiceStateRef.current = 'idle';
                setVoiceState('idle');
              }
            } else {
              // Attempt to restart if stopped prematurely by browser before 60s
              try {
                if (voiceStateRef.current === 'listening') {
                  recognitionRef.current.start();
                }
              } catch (e) {
                // Ignore if cannot restart
              }
            }
          }
        };
      }
    }

    // Auto-start listening on mount when modal opens from "Tap to Speak Task"
    startListening();

    return () => {
      clearTimer();
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
    console.log("[VoiceTaskModal] startListening requested");
    clearTimer();
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.error("[VoiceTaskModal] Microphone permission denied", err);
      setClarificationMsg("Microphone permission is required to use voice. Please allow microphone access or type your task below.");
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

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("Recognition already active or restart error:", e);
    }

    // Start 60-second timer
    timerIntervalRef.current = setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds(recordingSecondsRef.current);

      if (recordingSecondsRef.current >= 60) {
        console.log("[VoiceTaskModal] 60-second limit reached, auto-submitting");
        clearTimer();
        stopListeningAndSubmit();
      }
    }, 1000);
  };

  const stopListeningAndSubmit = () => {
    clearTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    const finalSpeech = (taskInputRef.current || transcriptRef.current || taskInput || transcript).trim();
    handleTaskSubmit(finalSpeech);
  };

  const handleTaskSubmit = async (overrideText?: string) => {
    clearTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    // Prevent overlapping simultaneous submissions
    if (isSubmittingRef.current) {
      console.log("[VoiceTaskModal] Already submitting, ignoring duplicate trigger");
      return;
    }
    isSubmittingRef.current = true;

    // Resolve freshest text
    const textToProcess = (
      (typeof overrideText === 'string' && overrideText.trim())
        ? overrideText
        : (taskInputRef.current || transcriptRef.current || taskInput || transcript)
    ).trim();

    console.log("[VoiceTaskModal] Submitting task text:", textToProcess);

    if (!textToProcess) {
      isSubmittingRef.current = false;
      voiceStateRef.current = 'clarifying';
      setVoiceState('clarifying');
      setClarificationMsg("Please speak or type a task first.");
      return;
    }

    voiceStateRef.current = 'processing';
    setVoiceState('processing');

    try {
      console.log(`[VoiceTaskModal] Dispatching task parse request:`, {
        endpoint: '/api/parse-task',
        length: textToProcess.length,
        preview: textToProcess.slice(0, 100),
        userTimezone: getUserTimezone()
      });

      const res = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToProcess,
          text: textToProcess,
          userTimezone: getUserTimezone()
        })
      });

      let data: ParsedTaskApiResponse | null = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error("[VoiceTaskModal] Failed to parse response JSON (received non-JSON or HTML body):", jsonErr);
      }

      const httpStatus = res.status;
      const errorCategory = data?.errorCategory || (
        httpStatus === 401 ? 'AUTHENTICATION_ERROR' :
        httpStatus === 403 ? 'PERMISSION_ERROR' :
        httpStatus === 404 ? 'MODEL_ERROR' :
        httpStatus === 429 ? 'RATE_LIMIT_ERROR' :
        httpStatus >= 500 ? 'API_REQUEST_ERROR' :
        null
      );

      console.log("[VoiceTaskModal] /api/parse-task response received:", {
        status: httpStatus,
        ok: res.ok,
        errorCategory,
        diagnostic: data?.diagnostic,
        taskCount: data?.tasks?.length,
        message: data?.message
      });

      if (!res.ok) {
        // Attempt resilient local fallback parser so user is NEVER blocked if server has an issue
        const localFallback = parseMultiTaskFallback(textToProcess);
        if (localFallback.success && localFallback.tasks.length > 0) {
          console.warn("[VoiceTaskModal] Endpoint returned status", httpStatus, "- using resilient local parser fallback");
          const formattedReviewTasks: ReviewTaskItem[] = localFallback.tasks.map((t, idx) => ({
            id: `review-${Date.now()}-${idx}`,
            task: t.task,
            date: t.date || "Today",
            time: t.time || "9:00 AM",
            recurrenceRule: t.recurrenceRule || null
          }));
          setReviewTasks(formattedReviewTasks);
          setHasMoreThanSeven(Boolean(localFallback.hasMoreThanSeven));
          setRawTranscript(textToProcess);
          voiceStateRef.current = 'reviewing';
          setVoiceState('reviewing');
          return;
        }

        if (errorCategory === 'AUTHENTICATION_ERROR') {
          setClarificationMsg(`AI Authentication Error (HTTP ${httpStatus}): Gemini API key is missing or invalid. Please check your environment variables.`);
        } else if (errorCategory === 'RATE_LIMIT_ERROR') {
          setClarificationMsg(`AI Quota Exceeded (HTTP ${httpStatus}): Gemini free tier quota is temporarily busy. Please wait a moment or type your task.`);
        } else if (errorCategory === 'PERMISSION_ERROR') {
          setClarificationMsg(`AI Permission Error (HTTP ${httpStatus}): Generative Language API access was denied.`);
        } else if (errorCategory === 'MODEL_ERROR') {
          setClarificationMsg(`AI Model Error (HTTP ${httpStatus}): Model endpoint not found.`);
        } else {
          setClarificationMsg(`Task Assistant Notice (HTTP ${httpStatus}): ${data?.message || "Could not process task."}`);
        }
        voiceStateRef.current = 'clarifying';
        setVoiceState('clarifying');
        return;
      }

      const items = (data?.tasks && data.tasks.length > 0)
        ? data.tasks
        : (data?.task ? [{ task: data.task, date: data.date || "Today", time: data.time || "9:00 AM", recurrenceRule: data.recurrenceRule || null }] : []);

      if (items.length === 0) {
        console.warn("[VoiceTaskModal] Zero actionable tasks detected from input:", textToProcess);
        setClarificationMsg(data?.message || "I couldn't detect a clear task from that recording. Please clarify what you'd like to do (e.g. 'Go to gym at 6 PM').");
        voiceStateRef.current = 'clarifying';
        setVoiceState('clarifying');
        return;
      }

      const formattedReviewTasks: ReviewTaskItem[] = items.map((t, idx) => ({
        id: `review-${Date.now()}-${idx}`,
        task: t.task,
        date: t.date || "Today",
        time: t.time || "9:00 AM",
        recurrenceRule: t.recurrenceRule || null
      }));

      setReviewTasks(formattedReviewTasks);
      setHasMoreThanSeven(Boolean(data?.hasMoreThanSeven));
      setRawTranscript(data?.rawTranscript || textToProcess);
      voiceStateRef.current = 'reviewing';
      setVoiceState('reviewing');
    } catch (err: any) {
      console.error("[VoiceTaskModal] Fatal network or connection error reaching /api/parse-task:", {
        errorCategory: 'NETWORK_ERROR',
        message: err?.message || err,
        endpoint: '/api/parse-task'
      });

      // Attempt resilient local fallback parser so user is NEVER blocked if network drops
      const localFallback = parseMultiTaskFallback(textToProcess);
      if (localFallback.success && localFallback.tasks.length > 0) {
        console.warn("[VoiceTaskModal] Network offline/unreachable - using resilient local parser fallback");
        const formattedReviewTasks: ReviewTaskItem[] = localFallback.tasks.map((t, idx) => ({
          id: `review-${Date.now()}-${idx}`,
          task: t.task,
          date: t.date || "Today",
          time: t.time || "9:00 AM",
          recurrenceRule: t.recurrenceRule || null
        }));
        setReviewTasks(formattedReviewTasks);
        setHasMoreThanSeven(Boolean(localFallback.hasMoreThanSeven));
        setRawTranscript(textToProcess);
        voiceStateRef.current = 'reviewing';
        setVoiceState('reviewing');
        return;
      }

      setClarificationMsg("Network Error: Could not reach the task assistant service. Please check your connection or try again.");
      voiceStateRef.current = 'clarifying';
      setVoiceState('clarifying');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleUpdateReviewTask = (id: string, field: keyof ReviewTaskItem, value: string) => {
    setReviewTasks(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDeleteReviewTask = (id: string) => {
    setReviewTasks(prev => prev.filter(item => item.id !== id));
  };

  const handleAddNewTask = () => {
    const newTask: ReviewTaskItem = {
      id: `review-${Date.now()}-${reviewTasks.length}`,
      task: '',
      date: 'Today',
      time: '9:00 AM',
      recurrenceRule: null
    };
    setReviewTasks(prev => [...prev, newTask]);
  };

  const handleConfirmAndSaveAll = async () => {
    if (reviewTasks.length === 0) return;
    setIsSaving(true);
    try {
      for (const t of reviewTasks) {
        if (!t.task.trim()) continue;
        const newTask: Task = {
          id: crypto.randomUUID(),
          userId: user.id,
          taskText: t.task.trim(),
          scheduledDate: t.date.trim() || 'Today',
          scheduledTime: t.time.trim() || '9:00 AM',
          timezone: getUserTimezone(),
          recurrenceRule: t.recurrenceRule || undefined,
          status: 'Pending',
          createdTimestamp: Date.now(),
          completedTimestamp: null,
        };
        await saveTask(newTask);
        console.log("[VoiceTaskModal] Saved independent task:", newTask);
      }
      await onSaved();
      onClose();
    } catch (err) {
      console.error("[VoiceTaskModal] Failed to save tasks:", err);
    } finally {
      setIsSaving(false);
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
          className="bg-white rounded-t-3xl p-6 relative z-10 shadow-2xl max-h-[85vh] min-h-[50vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-shrink-0">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {voiceState === 'reviewing' 
                  ? (reviewTasks.length === 1 ? "I found 1 task" : `I found ${reviewTasks.length} tasks`)
                  : "Voice Task Assistant"}
              </h3>
              {voiceState === 'listening' && (
                <p className="text-xs text-blue-600 font-medium mt-0.5">
                  Recording note (up to 60s) • {formatTimer(recordingSeconds)} / 01:00
                </p>
              )}
            </div>
            <button 
              onClick={onClose} 
              className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto py-4">
            
            {/* IDLE STATE */}
            {voiceState === 'idle' && (
              <div className="text-center my-auto py-6">
                <button 
                  onClick={startListening}
                  className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white mb-4 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 mx-auto"
                  aria-label="Start recording"
                >
                  <Mic className="w-10 h-10" />
                </button>
                <p className="text-slate-800 font-bold text-lg">Tap to speak</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Speak up to 60 seconds. You can mention 1 to 7 tasks in a single voice note!
                </p>
              </div>
            )}

            {/* LISTENING STATE */}
            {voiceState === 'listening' && (
              <div className="text-center w-full my-auto py-4">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-25"></div>
                  <button 
                    onClick={stopListeningAndSubmit}
                    className="relative w-24 h-24 bg-red-600 rounded-full flex flex-col items-center justify-center text-white hover:bg-red-700 active:scale-95 transition-all shadow-xl shadow-red-600/30 mx-auto group cursor-pointer"
                    title="Tap to finish recording"
                  >
                    <Square className="w-8 h-8 fill-current mb-0.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Done</span>
                  </button>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold mb-3 border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                  Listening... {formatTimer(recordingSeconds)} / 01:00
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[5rem] max-h-36 overflow-y-auto mx-auto max-w-lg text-left">
                  <p className="text-slate-800 text-sm italic font-medium leading-relaxed">
                    {transcript || "Listening... speak naturally about your tasks and times."}
                  </p>
                </div>

                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={stopListeningAndSubmit}
                    className="bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>Done Speaking</span>
                  </button>
                </div>
              </div>
            )}

            {/* PROCESSING STATE */}
            {voiceState === 'processing' && (
              <div className="text-center my-auto py-10">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-800 font-bold text-lg">Understanding your tasks...</p>
                <p className="text-xs text-slate-500 mt-1">Extracting tasks, dates, and times</p>
              </div>
            )}

            {/* CLARIFYING / PROMPT GUIDANCE */}
            {voiceState === 'clarifying' && (
              <div className="text-center w-full my-auto py-4">
                <div className="bg-amber-50 text-amber-900 p-4 rounded-2xl mb-5 flex items-start gap-3 text-left border border-amber-200">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm leading-snug">{clarificationMsg}</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Example: "Call John at 6 PM today and study at 7 PM today."
                    </p>
                  </div>
                </div>
                <button 
                  onClick={startListening}
                  className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white mb-3 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/30 mx-auto"
                >
                  <Mic className="w-8 h-8" />
                </button>
                <p className="text-slate-600 font-medium text-xs">Tap to speak again</p>
              </div>
            )}

            {/* ERROR STATE */}
            {voiceState === 'error' && (
              <div className="text-center w-full my-auto py-6">
                <div className="bg-red-50 text-red-800 p-4 rounded-2xl mb-5 flex items-start gap-3 text-left border border-red-200">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600 mt-0.5" />
                  <p className="font-medium text-sm leading-tight">{clarificationMsg}</p>
                </div>
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={startListening}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-xs"
                  >
                    Try Microphone Again
                  </button>
                  <button 
                    onClick={() => setVoiceState('idle')}
                    className="bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-300 transition-colors text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* MULTI-TASK REVIEW SCREEN (1 to 7 tasks) */}
            {voiceState === 'reviewing' && (
              <div className="w-full space-y-4">
                {/* User transcript quote */}
                {rawTranscript && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">You said</p>
                    <p className="text-xs text-slate-700 italic mt-0.5 line-clamp-3">"{rawTranscript}"</p>
                  </div>
                )}

                {/* More than 7 warning banner */}
                {hasMoreThanSeven && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl flex items-start gap-2.5 text-xs text-left">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
                    <span>I found more than 7 tasks. Please review these first 7 tasks.</span>
                  </div>
                )}

                {/* List of editable task cards */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {reviewTasks.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-sm space-y-2.5 text-left relative transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          Task {index + 1}
                        </span>
                        {reviewTasks.length > 1 && (
                          <button
                            onClick={() => handleDeleteReviewTask(item.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                            title="Remove this task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Task text input */}
                      <div>
                        <input
                          type="text"
                          value={item.task}
                          onChange={(e) => handleUpdateReviewTask(item.id, 'task', e.target.value)}
                          placeholder="Task name"
                          className="w-full text-base font-semibold text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none bg-transparent py-0.5"
                        />
                      </div>

                      {/* Date & Time fields */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={item.date}
                            onChange={(e) => handleUpdateReviewTask(item.id, 'date', e.target.value)}
                            placeholder="Today"
                            className="bg-transparent w-full text-slate-800 font-medium focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={item.time}
                            onChange={(e) => handleUpdateReviewTask(item.id, 'time', e.target.value)}
                            placeholder="6:00 PM"
                            className="bg-transparent w-full text-slate-800 font-medium focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Recurrence badge */}
                      {item.recurrenceRule && (
                        <div className="text-[11px] text-blue-600 font-medium">
                          Repeats: {item.recurrenceRule}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add another task button */}
                {reviewTasks.length < 7 && (
                  <button
                    onClick={handleAddNewTask}
                    className="w-full py-2.5 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Task</span>
                  </button>
                )}

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <button 
                    onClick={handleConfirmAndSaveAll}
                    disabled={isSaving || reviewTasks.length === 0}
                    className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving {reviewTasks.length} {reviewTasks.length === 1 ? "Task" : "Tasks"}...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Save {reviewTasks.length} {reviewTasks.length === 1 ? "Task" : "Tasks"}</span>
                      </>
                    )}
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setVoiceState('idle')}
                      disabled={isSaving}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                    >
                      Speak Again
                    </button>
                    <button 
                      onClick={onClose}
                      disabled={isSaving}
                      className="flex-1 bg-white border border-slate-200 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Typed input field — synchronized with speech transcript */}
            {voiceState !== 'reviewing' && (
              <div className="mt-auto w-full pt-3 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    disabled={voiceState === 'processing'}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white outline-none transition-all disabled:opacity-60"
                    placeholder="e.g. Call John at 6 PM and study at 7 PM"
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

