// src/lib/taskParsingEngine.ts
import { GoogleGenAI, Type } from "@google/genai";
function classifyGeminiError(err) {
  const status = Number(err?.status || err?.statusCode || 500);
  const errMsg = String(err?.message || err || "");
  if (status === 401 || /api[_\s]?key|unauthenticated|invalid\s*auth/i.test(errMsg)) {
    return {
      category: "AUTHENTICATION_ERROR",
      status: 401,
      message: "Gemini API authentication failed. Please verify that GEMINI_API_KEY is configured in your environment variables.",
      safeDetails: "HTTP 401: Invalid or missing API key"
    };
  }
  if (status === 403 || /permission_denied|forbidden|access_denied/i.test(errMsg)) {
    return {
      category: "PERMISSION_ERROR",
      status: 403,
      message: "Gemini API permission denied. Check that your Google Cloud / AI Studio project has access.",
      safeDetails: "HTTP 403: Permission denied"
    };
  }
  if (status === 429 || /quota|rate[_\s]?limit|resource_exhausted/i.test(errMsg)) {
    return {
      category: "RATE_LIMIT_ERROR",
      status: 429,
      message: "Gemini free-tier quota/rate limit exceeded. Tasks parsed using resilient local parser.",
      safeDetails: "HTTP 429: Resource exhausted / quota exceeded"
    };
  }
  if (status === 404 || /not_found|model.*no longer available/i.test(errMsg)) {
    return {
      category: "MODEL_ERROR",
      status: 404,
      message: "Requested Gemini model is unavailable or deprecated.",
      safeDetails: "HTTP 404: Model not found"
    };
  }
  if (status === 400 || /invalid_argument|bad\s*request/i.test(errMsg)) {
    return {
      category: "API_REQUEST_ERROR",
      status: 400,
      message: "Malformed request structure sent to Gemini API.",
      safeDetails: "HTTP 400: Bad request"
    };
  }
  if (/fetch failed|enotfound|econnrefused|etimedout|network/i.test(errMsg)) {
    return {
      category: "NETWORK_ERROR",
      status: 503,
      message: "Unable to reach Google Gemini servers. Check network connectivity.",
      safeDetails: "Network connectivity failure"
    };
  }
  if (/json|syntaxerror|unexpected token/i.test(errMsg)) {
    return {
      category: "RESPONSE_PARSE_ERROR",
      status: 502,
      message: "Received response from Gemini but could not parse structured JSON output.",
      safeDetails: "JSON parsing failure"
    };
  }
  return {
    category: "API_REQUEST_ERROR",
    status: status >= 400 && status < 600 ? status : 500,
    message: errMsg.slice(0, 200) || "Gemini API call failed",
    safeDetails: `HTTP ${status}`
  };
}
function normalizeTranscript(text) {
  if (!text) return "";
  let normalized = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/(\d{1,2}(?::\d{2})?)\s*p\.m\./gi, "$1 PM").replace(/(\d{1,2}(?::\d{2})?)\s*a\.m\./gi, "$1 AM").replace(/(\d{1,2}(?::\d{2})?)\s*pm\b/gi, "$1 PM").replace(/(\d{1,2}(?::\d{2})?)\s*am\b/gi, "$1 AM");
  normalized = normalized.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
  normalized = normalized.replace(/\b(go\s+to)\s+(go\s+to)\b/gi, "$1");
  return normalized.trim();
}
function parseMultiTaskFallback(prompt) {
  const text = normalizeTranscript(prompt);
  if (!text) {
    return {
      success: false,
      tasks: [],
      totalFound: 0,
      hasMoreThanSeven: false,
      rawTranscript: "",
      diagnostic: {
        source: "fallback_parser",
        errorCategory: "TASK_INTERPRETATION_ERROR",
        errorMessage: "Empty input provided"
      },
      errorCategory: "TASK_INTERPRETATION_ERROR",
      message: "Please provide or speak a task first.",
      missingTask: true,
      missingTime: true
    };
  }
  const rawSegments = text.split(/(?:[.!?;]|\band\s+then\b|\bthen\b|\band\b|,\s*(?=[a-zA-Z0-9]))/i).map((s) => s.trim()).filter((s) => s.length > 0);
  const parsedTasks = [];
  for (const rawChunk of rawSegments) {
    if (parsedTasks.length >= 7) break;
    let chunk = rawChunk.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1").replace(/\b(go\s+to)\s+(go\s+to)\b/gi, "$1").trim();
    if (!chunk || chunk.length < 2) continue;
    let date = "Today";
    let time = "9:00 AM";
    let recurrenceRule = null;
    if (/\bevery\s+monday\b/i.test(chunk)) {
      recurrenceRule = "Every Monday";
      date = "Monday";
    } else if (/\bevery\s+morning\b/i.test(chunk)) {
      recurrenceRule = "Every Morning";
      date = "Daily";
      time = "8:00 AM";
    } else if (/\bdaily\b/i.test(chunk)) {
      recurrenceRule = "Daily";
      date = "Daily";
    } else if (/\bevery\s+(tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(chunk)) {
      const match = chunk.match(/\bevery\s+(tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (match) {
        recurrenceRule = `Every ${match[1].charAt(0).toUpperCase() + match[1].slice(1)}`;
        date = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }
    if (!recurrenceRule) {
      if (/\btomorrow\b/i.test(chunk)) {
        date = "Tomorrow";
      } else if (/\btoday\b/i.test(chunk)) {
        date = "Today";
      } else if (/\btonight\b/i.test(chunk)) {
        date = "Today";
      } else {
        const dayMatch = chunk.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
        if (dayMatch) {
          date = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1);
        }
      }
    }
    const meridiemMatch = chunk.match(/(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)(?:\s|[.,]|$)/i);
    const time24Match = chunk.match(/(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?:\s|[.,]|$)/i);
    const tonightHourMatch = chunk.match(/(?:^|\s)(?:at\s+)?(\d{1,2})\s*tonight(?:\s|[.,]|$)/i);
    const atHourMatch = chunk.match(/(?:^|\s)at\s+(\d{1,2})(?::(\d{2}))?(?:\s|[.,]|$)/i);
    const noonMatch = /\bnoon\b/i.test(chunk);
    const midnightMatch = /\bmidnight\b/i.test(chunk);
    const morningMatch = /\b(?:in\s+the\s+morning|tomorrow\s+morning)\b/i.test(chunk);
    if (meridiemMatch) {
      const h = parseInt(meridiemMatch[1], 10);
      const m = meridiemMatch[2] || "00";
      const ampm = meridiemMatch[3].toUpperCase();
      time = `${h}:${m} ${ampm}`;
    } else if (tonightHourMatch) {
      let h = parseInt(tonightHourMatch[1], 10);
      if (h < 12) h += 12;
      const h12 = h > 12 ? h - 12 : h;
      time = `${h12}:00 PM`;
    } else if (noonMatch) {
      time = "12:00 PM";
    } else if (midnightMatch) {
      time = "12:00 AM";
    } else if (time24Match) {
      const h = parseInt(time24Match[1], 10);
      const m = time24Match[2];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      time = `${h12}:${m} ${ampm}`;
    } else if (atHourMatch) {
      const h = parseInt(atHourMatch[1], 10);
      const m = atHourMatch[2] || "00";
      let ampm = "PM";
      if (/\bmorning\b/i.test(chunk)) {
        ampm = "AM";
      } else if (/\bevening|night|tonight|afternoon\b/i.test(chunk)) {
        ampm = "PM";
      } else if (h >= 1 && h <= 6) {
        ampm = "PM";
      } else if (h >= 7 && h <= 11) {
        ampm = "AM";
      } else if (h === 12) {
        ampm = "PM";
      }
      time = `${h}:${m} ${ampm}`;
    } else if (morningMatch) {
      time = "9:00 AM";
    }
    let cleaned = chunk.replace(/^(?:please\s+)?(?:remind\s+me\s+to|i\s+need\s+to|i\s+want\s+to|i\s+have\s+to|i\s+have\s+a\s+meeting\s+(?:with|at)?|remind\s+me)\s*/i, "").replace(/\b(?:please\s+)?(?:remind\s+me\s+to|i\s+need\s+to|i\s+want\s+to|i\s+have\s+to|remind\s+me)\s*/gi, "").replace(/\b(?:today|tomorrow|tonight|this\s+evening|this\s+morning|every\s+monday|every\s+morning|daily)\b/gi, " ").replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ").replace(/(?:^|\s)(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, " ").replace(/\b(?:in\s+the\s+morning|tomorrow\s+morning|noon|midnight)\b/gi, " ").replace(/[.,;!]+$/g, "").replace(/^[.,;!]+/g, "").replace(/\s+/g, " ").trim();
    cleaned = cleaned.replace(/^to\s+/i, "").trim();
    if (cleaned.length >= 2) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      parsedTasks.push({
        task: cleaned,
        date,
        time,
        recurrenceRule
      });
    }
  }
  const hasMoreThanSeven = rawSegments.length > 7;
  return {
    success: parsedTasks.length > 0,
    tasks: parsedTasks,
    totalFound: parsedTasks.length,
    hasMoreThanSeven,
    rawTranscript: prompt,
    diagnostic: {
      source: "fallback_parser"
    },
    task: parsedTasks[0]?.task || "",
    date: parsedTasks[0]?.date || "Today",
    time: parsedTasks[0]?.time || "",
    recurrenceRule: parsedTasks[0]?.recurrenceRule || null,
    missingTask: parsedTasks.length === 0,
    missingTime: parsedTasks.length === 0 || !parsedTasks[0]?.time
  };
}
async function processTaskInput(rawInput, userTimezone = "UTC") {
  const startTime = Date.now();
  const prompt = normalizeTranscript(rawInput);
  if (!prompt || prompt.length < 2) {
    return {
      status: 400,
      result: {
        success: false,
        tasks: [],
        totalFound: 0,
        hasMoreThanSeven: false,
        rawTranscript: rawInput || "",
        diagnostic: {
          source: "fallback_parser",
          httpStatus: 400,
          errorCategory: "TASK_INTERPRETATION_ERROR",
          errorMessage: "No task description provided"
        },
        errorCategory: "TASK_INTERPRETATION_ERROR",
        message: "Please speak or enter a task to schedule."
      }
    };
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[taskParsingEngine] GEMINI_API_KEY is not configured in environment. Using fallback parser.");
    const fallbackResult2 = parseMultiTaskFallback(prompt);
    fallbackResult2.diagnostic = {
      source: "fallback_parser",
      httpStatus: 401,
      errorCategory: "AUTHENTICATION_ERROR",
      errorMessage: "GEMINI_API_KEY is missing in environment variables. Add GEMINI_API_KEY to your deployment configuration."
    };
    return {
      status: 200,
      result: fallbackResult2
    };
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-daily-task-ai"
      }
    }
  });
  const systemInstruction = `You are Daily TASK AI's intelligent task parsing assistant.
Extract between 1 and 7 actionable tasks from the user's natural language input (spoken voice recording or typed note).
The input can be a single task or multiple tasks in one voice note (up to 60 seconds of speech).
For example: "Today at 6 PM I want to call John. At 7 PM remind me to study. Tomorrow at 9 AM I need to go to the bank. Tomorrow at 2 PM remind me to send the document."

Rules:
1. Extract each distinct task as an object in the 'tasks' array.
2. 'task': Concise, actionable task description (e.g. 'Call John', 'Study', 'Go to the bank', 'Send the document', 'Go to gym', 'See my friend'). Strip speech repetition/stutter artifacts (e.g., "go go to go to gym" becomes "Go to gym"). Strip preambles like 'Remind me to', 'I want to', 'I need to', 'Please remind me to'. Do NOT put the date or time inside 'task'.
3. 'date': The date of the task ('Today', 'Tomorrow', day name like 'Monday', or specific date). Default to 'Today' if not specified.
4. 'time': Scheduled time formatted in 12-hour AM/PM format (e.g. '6:00 PM', '7:00 PM', '9:00 AM', '2:00 PM').
   - 'noon' -> '12:00 PM'
   - 'midnight' -> '12:00 AM'
   - '7 tonight' -> '7:00 PM'
   - 'tomorrow morning' -> '9:00 AM' (unless specific time given)
   - default to '9:00 AM' if time is not mentioned.
5. 'recurrenceRule': If recurring (e.g. 'Every Monday', 'Every Morning', 'Daily'), return clean string, otherwise null.
6. Maximum tasks: Return at most 7 tasks. If the user mentions more than 7 tasks, extract only the first 7 and set 'hasMoreThanSeven' to true. Otherwise, set 'hasMoreThanSeven' to false.
User timezone: ${userTimezone}.`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            task: {
              type: Type.STRING,
              description: "The description of the task without preambles or dates/times."
            },
            date: {
              type: Type.STRING,
              description: "The date for the task ('Today', 'Tomorrow', day name, etc.)."
            },
            time: {
              type: Type.STRING,
              description: "The time with AM/PM (e.g. '7:00 PM')."
            },
            recurrenceRule: {
              type: Type.STRING,
              nullable: true,
              description: "Recurrence string if task repeats, or null."
            }
          },
          required: ["task", "date", "time"]
        }
      },
      hasMoreThanSeven: {
        type: Type.BOOLEAN,
        description: "True if more than 7 tasks were found in the note."
      }
    },
    required: ["tasks", "hasMoreThanSeven"]
  };
  const callModelWithTimeout = async (modelName, timeoutMs = 1e4) => {
    const callPromise = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`Timeout (${timeoutMs}ms) calling ${modelName}`)), timeoutMs)
    );
    const response = await Promise.race([callPromise, timeoutPromise]);
    let jsonStr = response.text?.trim() || "{}";
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return JSON.parse(jsonStr);
  };
  let extractedData = null;
  let successfulModel = null;
  let lastErrorDiagnostic = null;
  try {
    extractedData = await callModelWithTimeout("gemini-3.5-flash-lite", 1e4);
    successfulModel = "gemini-3.5-flash-lite";
    console.log("[taskParsingEngine] gemini-3.5-flash-lite succeeded in", Date.now() - startTime, "ms");
  } catch (errPrimary) {
    const primaryDiag = classifyGeminiError(errPrimary);
    lastErrorDiagnostic = primaryDiag;
    console.warn("[taskParsingEngine] gemini-3.5-flash-lite error:", {
      category: primaryDiag.category,
      status: primaryDiag.status,
      message: primaryDiag.message
    });
    if (primaryDiag.category !== "AUTHENTICATION_ERROR") {
      try {
        extractedData = await callModelWithTimeout("gemini-3.1-flash-lite", 1e4);
        successfulModel = "gemini-3.1-flash-lite";
        console.log("[taskParsingEngine] gemini-3.1-flash-lite succeeded as secondary");
      } catch (errSec) {
        const secDiag = classifyGeminiError(errSec);
        lastErrorDiagnostic = secDiag;
        console.warn("[taskParsingEngine] gemini-3.1-flash-lite secondary error:", {
          category: secDiag.category,
          status: secDiag.status,
          message: secDiag.message
        });
        try {
          extractedData = await callModelWithTimeout("gemini-flash-lite-latest", 1e4);
          successfulModel = "gemini-flash-lite-latest";
          console.log("[taskParsingEngine] gemini-flash-lite-latest succeeded as tertiary");
        } catch (errTer) {
          const terDiag = classifyGeminiError(errTer);
          lastErrorDiagnostic = terDiag;
          console.warn("[taskParsingEngine] gemini-flash-lite-latest tertiary error:", {
            category: terDiag.category,
            status: terDiag.status,
            message: terDiag.message
          });
        }
      }
    }
  }
  if (extractedData && Array.isArray(extractedData.tasks) && extractedData.tasks.length > 0) {
    const sanitizedTasks = extractedData.tasks.slice(0, 7).map((t) => ({
      task: String(t.task || "").trim().replace(/[.,;!]+$/g, ""),
      date: String(t.date || "Today").trim(),
      time: String(t.time || "9:00 AM").trim(),
      recurrenceRule: t.recurrenceRule ? String(t.recurrenceRule).trim() : null
    })).filter((t) => t.task.length >= 2);
    const hasMoreThanSeven = Boolean(extractedData.hasMoreThanSeven || extractedData.tasks.length > 7);
    return {
      status: 200,
      result: {
        success: true,
        tasks: sanitizedTasks,
        totalFound: sanitizedTasks.length,
        hasMoreThanSeven,
        rawTranscript: prompt,
        diagnostic: {
          source: "gemini",
          modelAttempted: successfulModel || "gemini-3.1-flash-lite",
          httpStatus: 200,
          durationMs: Date.now() - startTime
        },
        task: sanitizedTasks[0]?.task || "",
        date: sanitizedTasks[0]?.date || "Today",
        time: sanitizedTasks[0]?.time || "",
        recurrenceRule: sanitizedTasks[0]?.recurrenceRule || null,
        missingTask: sanitizedTasks.length === 0,
        missingTime: sanitizedTasks.length === 0 || !sanitizedTasks[0]?.time
      }
    };
  }
  console.log("[taskParsingEngine] AI models unavailable or returned 0 tasks. Applying fallback parser.");
  const fallbackResult = parseMultiTaskFallback(prompt);
  fallbackResult.diagnostic = {
    source: "fallback_parser",
    modelAttempted: "gemini-3.1-flash-lite",
    httpStatus: lastErrorDiagnostic?.status || 200,
    errorCategory: lastErrorDiagnostic?.category || "TASK_INTERPRETATION_ERROR",
    errorMessage: lastErrorDiagnostic?.message || "Recovered via fallback parser",
    durationMs: Date.now() - startTime
  };
  return {
    status: 200,
    result: fallbackResult
  };
}

// src/api/parse-task.ts
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const rawInput = body.prompt || body.text || body.taskText || "";
    const userTimezone = body.userTimezone || "UTC";
    console.log("[Vercel /api/parse-task] Request received:", {
      promptPreview: String(rawInput).slice(0, 100),
      userTimezone
    });
    const { status, result } = await processTaskInput(rawInput, userTimezone);
    return res.status(status).json(result);
  } catch (err) {
    console.error("[Vercel /api/parse-task] Fatal execution error:", err);
    return res.status(500).json({
      success: false,
      errorCategory: "API_REQUEST_ERROR",
      message: err?.message || "Server error processing task"
    });
  }
}
export {
  handler as default
};
