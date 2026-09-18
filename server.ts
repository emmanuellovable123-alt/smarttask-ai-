import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { processTaskInput } from "./src/lib/taskParsingEngine";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Comprehensive natural language fallback parser for speech & typed inputs (1 to 7 tasks)
  function parseMultiTaskFallback(prompt: string) {
    const text = prompt.trim();
    if (!text) {
      return {
        tasks: [],
        totalFound: 0,
        hasMoreThanSeven: false,
        rawTranscript: "",
        task: "",
        date: "Today",
        time: "",
        recurrenceRule: null,
        missingTask: true,
        missingTime: true
      };
    }

    // Normalize speech transcript artifacts
    const normalized = text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/(\d{1,2}(?::\d{2})?)\s*p\.m\./gi, "$1 PM")
      .replace(/(\d{1,2}(?::\d{2})?)\s*a\.m\./gi, "$1 AM")
      .replace(/(\d{1,2}(?::\d{2})?)\s*pm\b/gi, "$1 PM")
      .replace(/(\d{1,2}(?::\d{2})?)\s*am\b/gi, "$1 AM");

    // Multi-task splitting regex:
    // Split on:
    // 1) Period, exclamation, question mark, semicolon, newline: [.!?;\n]+
    // 2) Conjunctions before time or task markers: " and at ", " then at ", " also at ", " and then ", " then "
    // 3) " and " or comma followed by action verb, time expression, or "task \d"
    const splitRegex = /(?:[.!?;\n]+|\b(?:and\s+then|and\s+also|and\s+at|then\s+at|also\s+at)\b|\band\s+(?=(?:at\s+\d|today|tomorrow|tonight|every|[a-z]+\s+at\s+\d|remind|i\s+need|i\s+want|i\s+have|call|study|go|send|read|exercise|meet|buy|clean|take|finish|prepare|task\s+\d))|,\s*(?=(?:at\s+\d|tomorrow|today|tonight|every|[a-z]+\s+at\s+\d|call|study|go|send|read|exercise|meet|buy|clean|take|finish|prepare|task\s+\d)))/i;

    const rawChunks = normalized
      .split(splitRegex)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const parsedTasks: Array<{ task: string; date: string; time: string; recurrenceRule: string | null }> = [];

    for (const chunk of rawChunks) {
      let recurrenceRule: string | null = null;
      let date = "Today";
      let time = "";

      // 1. Recurrence checks
      if (/\bevery\s+morning\b/i.test(chunk)) {
        recurrenceRule = "Every Morning";
      } else if (/\bdaily\b|\bevery\s+day\b/i.test(chunk)) {
        recurrenceRule = "Daily";
      } else {
        const matchRecurDay = chunk.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
        if (matchRecurDay) {
          const day = matchRecurDay[1].charAt(0).toUpperCase() + matchRecurDay[1].slice(1).toLowerCase();
          recurrenceRule = `Every ${day}`;
          date = day;
        }
      }

      // 2. Date checks
      if (/\btomorrow(?:\s+morning|\s+afternoon|\s+evening)?\b/i.test(chunk)) {
        date = "Tomorrow";
      } else if (/\btonight\b|\bthis\s+evening\b/i.test(chunk)) {
        date = "Today";
      } else if (/\btoday\b/i.test(chunk)) {
        date = "Today";
      } else {
        const dayMatch = chunk.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
        if (dayMatch && !recurrenceRule) {
          date = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase();
        }
      }

      // 3. Time checks
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

      // 4. Clean task description
      let cleaned = chunk
        // Strip conversational preambles
        .replace(/^(?:please\s+)?(?:remind\s+me\s+to|i\s+need\s+to|i\s+want\s+to|i\s+have\s+to|i\s+have\s+a\s+meeting\s+(?:with|at)?|remind\s+me)\s*/i, "")
        .replace(/\b(?:please\s+)?(?:remind\s+me\s+to|i\s+need\s+to|i\s+want\s+to|i\s+have\s+to|remind\s+me)\s*/gi, "")
        // Strip date keywords
        .replace(/\b(?:today|tomorrow|tonight|this\s+evening|this\s+morning|every\s+monday|every\s+morning|daily)\b/gi, " ")
        .replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
        // Strip time expressions
        .replace(/(?:^|\s)(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, " ")
        .replace(/\b(?:in\s+the\s+morning|tomorrow\s+morning|noon|midnight)\b/gi, " ")
        .replace(/[.,;!]+$/g, "")
        .replace(/^[.,;!]+/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // Strip leading "to " if left from "remind me to" or "want to"
      cleaned = cleaned.replace(/^to\s+/i, "").trim();

      if (cleaned.length >= 2) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        parsedTasks.push({
          task: cleaned,
          date,
          time: time || "9:00 AM",
          recurrenceRule
        });
      }
    }

    const totalFound = parsedTasks.length;
    const hasMoreThanSeven = totalFound > 7;
    const finalTasks = parsedTasks.slice(0, 7);

    return {
      tasks: finalTasks,
      totalFound,
      hasMoreThanSeven,
      rawTranscript: prompt,
      task: finalTasks[0]?.task || "",
      date: finalTasks[0]?.date || "Today",
      time: finalTasks[0]?.time || "",
      recurrenceRule: finalTasks[0]?.recurrenceRule || null,
      missingTask: finalTasks.length === 0,
      missingTime: finalTasks.length === 0 || !finalTasks[0]?.time
    };
  }

  // API endpoints
  app.post("/api/parse-task", async (req, res) => {
    const rawInput = req.body.prompt || req.body.text || req.body.taskText;
    const userTimezone = req.body.userTimezone || "UTC";
    console.log("[parse-task] Processing request:", {
      inputPreview: String(rawInput || '').slice(0, 100),
      userTimezone
    });

    try {
      const { status, result } = await processTaskInput(rawInput, userTimezone);
      return res.status(status).json(result);
    } catch (err: any) {
      console.error("[parse-task] Fatal error in endpoint:", err);
      return res.status(500).json({
        success: false,
        errorCategory: 'API_REQUEST_ERROR',
        message: err?.message || 'Server error processing task',
        tasks: []
      });
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
