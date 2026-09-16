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

  // API endpoints
  app.post("/api/parse-task", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "No prompt provided" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: `You are a task parsing assistant. 
Extract the 'task', 'date', and 'time' from the user's natural language request.
If the user provides a task but no date, default date to "Today".
If the user provides a task but NO time is provided, you must set 'missingTime' to true.
If the user provides a time/date but NO task, you must set 'missingTask' to true.
Do NOT invent a time or a task if it is not clearly stated or implied by the user (except defaulting date to "Today" if unspecified).
Return a JSON object.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              task: {
                type: Type.STRING,
                description: "The name or description of the task (e.g., 'Call my friend', 'Read my book'). Empty string if missing."
              },
              date: {
                type: Type.STRING,
                description: "The date for the task (e.g., 'Today', 'Tomorrow', 'Monday'). Default to 'Today' if missing."
              },
              time: {
                type: Type.STRING,
                description: "The time for the task (e.g., '6:00 PM', '15:00'). Empty string if missing."
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

      const jsonStr = response.text?.trim() || "{}";
      const data = JSON.parse(jsonStr);
      res.json(data);
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to parse task" });
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
