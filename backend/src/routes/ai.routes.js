const express = require('express');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

router.get('/status', (_req, res) => {
  res.json({
    configured: Boolean(GEMINI_API_KEY),
    provider: 'gemini',
    model: GEMINI_MODEL,
  });
});

router.post('/chat', async (req, res, next) => {
  try {
    const key = req.body?.apiKey || GEMINI_API_KEY;
    const model = req.body?.model || GEMINI_MODEL;
    const prompt = req.body?.prompt;
    const context = req.body?.context;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'No Gemini API key configured on server or in request.',
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required.',
      });
    }

    const systemPrompt = `You are Pulse AI, the elite productivity coach and data analyst built into Pulse Tracker.
Your job is to analyze the user's real productivity logs and generate structured, insightful, motivating, and actionable reports.
Always format your response using clean Markdown with clear headers (##, ###), bullet points, bold key numbers, and horizontal dividers.
Never hallucinate numbers; use the exact metrics provided in the JSON context below.

Current User Productivity Context:
${JSON.stringify(context || {}, null, 2)}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nUser Request: ${prompt}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        error: errorData?.error?.message || `Gemini API returned status ${response.status}`,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    res.json({
      success: true,
      text,
      model,
      provider: 'gemini',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
