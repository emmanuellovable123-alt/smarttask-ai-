import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Natural language fallback parser when AI model is busy (503/429) or offline
  function parseTaskFallback(prompt: string) {
    const text = prompt.trim();
    if (!text) {
      return { task: "", date: "Today", time: "", recurrenceRule: null, missingTime: true, missingTask: true };
    }

    let cleaned = text;
    let recurrenceRule: string | null = null;
    let date = "Today";
    let time = "";

    // 1. Recurrence checks
    if (/\bevery\s+morning\b/i.test(cleaned)) {
      recurrenceRule = "Every Morning";
      cleaned = cleaned.replace(/\bevery\s+morning\b/gi, "");
    } else if (/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(cleaned)) {
      const match = cleaned.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (match) {
        const day = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        recurrenceRule = `Every ${day}`;
        cleaned = cleaned.replace(match[0], "");
      }
    } else if (/\bdaily\b|\bevery\s+day\b/i.test(cleaned)) {
      recurrenceRule = "Daily";
      cleaned = cleaned.replace(/\bdaily\b|\bevery\s+day\b/gi, "");
    }

    // 2. Date checks
    if (/\btomorrow\b/i.test(cleaned)) {
      date = "Tomorrow";
      cleaned = cleaned.replace(/\btomorrow\b/gi, "");
    } else if (/\btoday\b/i.test(cleaned)) {
      date = "Today";
      cleaned = cleaned.replace(/\btoday\b/gi, "");
    } else if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(cleaned)) {
      const match = cleaned.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (match) {
        date = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        cleaned = cleaned.replace(match[0], "");
      }
    }

    // 3. Time checks
    const timeRegexWithMeridiem = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
    const timeRegex24H = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;
    const timeRegexAtHour = /\bat\s+(\d{1,2})\b/i;

    const matchMeridiem = cleaned.match(timeRegexWithMeridiem);
    if (matchMeridiem) {
      const hour = parseInt(matchMeridiem[1], 10);
      const min = matchMeridiem[2] || "00";
      const ampm = matchMeridiem[3].toUpperCase();
      time = `${hour}:${min} ${ampm}`;
      cleaned = cleaned.replace(matchMeridiem[0], "");
    } else {
      const match24 = cleaned.match(timeRegex24H);
      if (match24) {
        const h = parseInt(match24[1], 10);
        const m = match24[2];
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        time = `${h12}:${m} ${ampm}`;
        cleaned = cleaned.replace(match24[0], "");
      } else {
        const matchAtHour = cleaned.match(timeRegexAtHour);
        if (matchAtHour) {
          const h = parseInt(matchAtHour[1], 10);
          const ampm = (h >= 1 && h <= 6) || h === 12 ? "PM" : (h >= 7 && h <= 11 ? "AM" : "PM");
          time = `${h}:00 ${ampm}`;
          cleaned = cleaned.replace(matchAtHour[0], "");
        }
      }
    }

    // 4. Clean task description
    cleaned = cleaned
      .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
      .replace(/\b(?:remind me to|please remind me to|remind me|i need to|i have to|i want to|don't forget to|remember to|i have a|i have an)\b/gi, "")
      .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const missingTask = !cleaned || cleaned.length < 2;
    const missingTime = !time;

    return {
      task: cleaned || "",
      date,
      time: time || "",
      recurrenceRule,
      missingTime,
      missingTask
    };
  }

  // API endpoints
  app.post("/api/parse-task", async (req, res) => {
    const rawInput = req.body.prompt || req.body.text || req.body.taskText;
    console.log("[parse-task] Received input:", rawInput);

    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const prompt = rawInput.trim();

    try {
      const geminiPromise = ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an intelligent task parsing assistant for Daily TASK AI.
Extract task details from the user's natural language input. The input can be phrased in any natural structure (e.g. "Remind me to study at 7 PM today", "I need to call John at 5 PM", "Tomorrow at 10 AM remind me to go to the bank", "Remind me to read my Bible every morning at 6 AM", "I have a meeting at 3 PM today", "Call Mum tomorrow at 4").

Rules:
1. 'task': Extract the concise description of the task/action (e.g. "study", "call John", "go to the bank", "read my Bible", "meeting", "call Mum"). Strip conversational preamble like "Remind me to" or "I need to".
2. 'date': The date for the task. If omitted or user says "today", return "Today". If "tomorrow", return "Tomorrow". If a day of the week is given (e.g. "Monday"), return that day capitalized.
3. 'time': Extract the scheduled time in 12-hour format with AM/PM (e.g. "7:00 PM", "5:00 PM", "10:00 AM", "6:00 AM", "3:00 PM", "4:00 PM"). If user says "at 4", infer the most reasonable daytime "4:00 PM".
4. 'recurrenceRule': If a recurring schedule is specified (e.g. "every morning", "every Monday", "daily"), return a clean string like "Every Morning", "Every Monday", "Daily". If not recurring, return null.
5. 'missingTime': Set to true ONLY if no time is specified or inferrable.
6. 'missingTask': Set to true ONLY if no actionable task was provided.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              task: {
                type: Type.STRING,
                description: "The description of the task. Empty string if missing."
              },
              date: {
                type: Type.STRING,
                description: "The date for the task ('Today', 'Tomorrow', day name, etc.). Default to 'Today' if missing."
              },
              time: {
                type: Type.STRING,
                description: "The time with AM/PM (e.g. '7:00 PM'). Empty string if missing."
              },
              recurrenceRule: {
                type: Type.STRING,
                nullable: true,
                description: "Recurrence string if task repeats, or null."
              },
              missingTime: {
                type: Type.BOOLEAN,
                description: "True if the user did not specify a time."
              },
              missingTask: {
                type: Type.BOOLEAN,
                description: "True if the user did not specify a task."
              }
            },
            required: ["task", "date", "time", "missingTime", "missingTask"]
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI generation timeout - applying instant fallback")), 2500)
      );

      const response = await Promise.race([geminiPromise, timeoutPromise]);

      let jsonStr = response.text?.trim() || "{}";
      // Strip markdown code fences if present
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const data = JSON.parse(jsonStr);
      console.log("[parse-task] Gemini parsed successfully:", data);
      return res.json({
        task: data.task || "",
        date: data.date || "Today",
        time: data.time || "",
        recurrenceRule: data.recurrenceRule || null,
        missingTime: Boolean(data.missingTime),
        missingTask: Boolean(data.missingTask)
      });
    } catch (error) {
      console.warn("[parse-task] Gemini API encountered issue, applying intelligent fallback:", error);
      const fallbackResult = parseTaskFallback(prompt);
      console.log("[parse-task] Fallback parsed successfully:", fallbackResult);
      return res.json(fallbackResult);
    }
  });

  // Payment Checkout Integration
  app.post("/api/create-checkout", async (req, res) => {
    const { userId, email, country, planName, amount } = req.body;
    
    // Country logic mapping
    const africanCountries = ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','EH','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR','MU','MW','MZ','NA','NE','RW','SC','SD','SL','SN','SO','SS','ST','SZ','TD','TG','TN','TZ','UG','ZA','ZM','ZW'];
    const isNigeria = country === 'NG';
    const isAfrica = africanCountries.includes(country);

    try {
      if (isNigeria) {
        // Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            amount: amount * 100, // in kobo
            metadata: { userId, planName }
          })
        });
        const data = await response.json();
        if (!data.status) throw new Error(data.message || 'Paystack Error');
        return res.json({ provider: 'Paystack', url: data.data.authorization_url });
        
      } else if (isAfrica) {
        // Flutterwave
        const response = await fetch('https://api.flutterwave.com/v3/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tx_ref: `tx-${Date.now()}-${userId}`,
            amount,
            currency: 'USD',
            redirect_url: process.env.VITE_APP_URL || 'http://localhost:3000',
            customer: { email },
            meta: { userId, planName }
          })
        });
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message || 'Flutterwave Error');
        return res.json({ provider: 'Flutterwave', url: data.data.link });
        
      } else {
        // Lemon Squeezy
        const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/vnd.api+json'
          },
          body: JSON.stringify({
            data: {
              type: "checkouts",
              attributes: {
                checkout_data: { email, custom: { userId } }
              },
              relationships: {
                store: { data: { type: "stores", id: process.env.LEMON_SQUEEZY_STORE_ID } },
                variant: { data: { type: "variants", id: process.env.LEMON_SQUEEZY_VARIANT_ID } }
              }
            }
          })
        });
        const data = await response.json();
        if (data.errors) throw new Error(data.errors[0].detail || 'Lemon Squeezy Error');
        return res.json({ provider: 'Lemon Squeezy', url: data.data.attributes.url });
      }
    } catch (error: any) {
      console.error('Payment Error:', error);
      res.status(500).json({ error: error.message || "Failed to initialize payment" });
    }
  });

  // Webhooks
  app.post("/api/webhooks/paystack", (req, res) => {
    // Verify paystack signature using process.env.PAYSTACK_SECRET_KEY
    // Update Supabase subscription_status = 'PREMIUM'
    console.log("Paystack Webhook Received");
    res.sendStatus(200);
  });
  
  app.post("/api/webhooks/flutterwave", (req, res) => {
    console.log("Flutterwave Webhook Received");
    res.sendStatus(200);
  });
  
  app.post("/api/webhooks/lemonsqueezy", (req, res) => {
    console.log("Lemon Squeezy Webhook Received");
    res.sendStatus(200);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
