import { processTaskInput } from "../lib/taskParsingEngine";

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawInput = body.prompt || body.text || body.taskText || '';
    const userTimezone = body.userTimezone || "UTC";

    console.log("[Vercel /api/parse-task] Request received:", {
      promptPreview: String(rawInput).slice(0, 100),
      userTimezone
    });

    const { status, result } = await processTaskInput(rawInput, userTimezone);
    return res.status(status).json(result);
  } catch (err: any) {
    console.error("[Vercel /api/parse-task] Fatal execution error:", err);
    return res.status(500).json({
      success: false,
      errorCategory: 'API_REQUEST_ERROR',
      message: err?.message || 'Server error processing task'
    });
  }
}
