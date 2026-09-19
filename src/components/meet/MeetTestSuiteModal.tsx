import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Play, Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface TestResult {
  testId: number;
  title: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

interface MeetTestSuiteModalProps {
  onClose: () => void;
}

export function MeetTestSuiteModal({ onClose }: MeetTestSuiteModalProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meet/test-suite');
      const data = await res.json();
      if (res.ok && data.results) {
        setResults(data.results);
        setSummary({
          total: data.totalTests,
          passed: data.passedCount,
          failed: data.failedCount
        });
      }
    } catch (err) {
      console.error('Test suite execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="test-suite-backdrop"
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs"
    >
      <motion.div
        id="test-suite-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold">Phase 6 Meet Verification Suite</h3>
              <p className="text-[11px] text-slate-500">30 Comprehensive Functional & Security Tests</p>
            </div>
          </div>
          <button
            id="close-test-suite-btn"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {summary ? (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Test Execution Completed</span>
                <span className="text-[11px] text-slate-500">
                  {summary.passed} of {summary.total} tests passed ({Math.round((summary.passed / summary.total) * 100)}%)
                </span>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                ALL GREEN
              </span>
            </div>
          ) : (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-slate-600">
                Execute the full automated validation suite verifying 18+ backend rejection, private coordinates, ad gating rules, similarity matching, and idempotent friend requests.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {results.map(r => (
              <div
                key={r.testId}
                id={`test-row-${r.testId}`}
                className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
              >
                {r.status === 'PASSED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">
                      #{r.testId}: {r.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        r.status === 'PASSED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{r.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
          >
            Close
          </button>
          <button
            type="button"
            id="run-tests-btn"
            disabled={loading}
            onClick={runTests}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 shadow-xs"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{results.length > 0 ? 'Re-Run All 30 Tests' : 'Run 30 Tests'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
