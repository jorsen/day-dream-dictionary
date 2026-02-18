/**
 * Claude AI integration.
 *
 * Calls the Anthropic Messages API directly (no SDK) using the native fetch
 * available in Node 18+. Validates the structured JSON response with Zod and
 * retries once on parse/validation failure.
 *
 * Model   : claude-haiku-4-5-20251001
 * Temp    : 0.35   (deterministic enough, creative enough)
 * Tokens  : 1 200 max output (the JSON schema fits comfortably)
 */

import { interpretationSchema } from '../validation/schemas.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const TEMPERATURE = 0.35;
const MAX_TOKENS = 1200;

const SYSTEM_PROMPT = `\
You are Day Dream Dictionary (DDD) — an empathetic, mystical, and psychologically attuned dream interpreter.

Task: Given a user's dream, return a structured interpretation in strict JSON only.

Schema:
{
  "mainThemes": ["string"],
  "emotionalTone": "string",
  "symbols": [
    {"symbol": "string", "meaning": "string"}
  ],
  "personalInsight": "string",
  "guidance": "string"
}

Guidelines:
1. mainThemes: 2–5 conceptual motifs (e.g., freedom, transformation, rebirth).
2. emotionalTone: overall mood (joyful, serene, anxious, awe-inspiring).
3. symbols: 2–5 key elements interpreted emotionally or archetypally. Do NOT return literal words or counts.
4. personalInsight: summarize subconscious meaning or growth reflection.
5. guidance: supportive, mystical advice (never medical).
6. Style: warm, poetic, intuitive, concise; mystical + psychological; avoid repetition.
7. JSON-only output; no markdown, no explanations, no extra text.

Example:
Dream: "I could fly over my city, soaring above the buildings. It felt effortless, like I was completely free. I could see familiar places from a new perspective."
Output:
{
  "mainThemes": ["Freedom", "Exploration", "Perspective"],
  "emotionalTone": "Joyful and liberating",
  "symbols": [
    {"symbol": "Flying", "meaning": "Represents liberation, empowerment, and freedom from limitations"},
    {"symbol": "City", "meaning": "Represents your personal environment and familiar routines"},
    {"symbol": "Soaring above", "meaning": "Gaining a new perspective and seeing life from a higher vantage point"}
  ],
  "personalInsight": "This dream suggests a desire for freedom and to view your life from a broader perspective. You may be seeking new experiences or wanting to rise above daily limitations.",
  "guidance": "Reflect on areas of your life where you feel restricted. Consider actions that allow you to expand your perspective and embrace opportunities for personal growth."
}`;

/**
 * Send one request to the Anthropic API.
 * @param {string} userContent  The user's prompt text.
 * @returns {Promise<string>}   Raw text from the model.
 */
async function callAPI(userContent) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || '';
    } catch {
      // ignore
    }
    throw new Error(`Anthropic API ${response.status}: ${detail || response.statusText}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Empty response content from Anthropic API');
  return text;
}

/**
 * Strip accidental markdown code fences that the model may still emit.
 * @param {string} text
 * @returns {string}
 */
function stripFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Parse and Zod-validate a Claude response text.
 * @param {string} raw
 * @returns {{ ok: true, data: object } | { ok: false }}
 */
function parseAndValidate(raw) {
  try {
    const parsed = JSON.parse(stripFences(raw));
    const result = interpretationSchema.safeParse(parsed);
    if (result.success) return { ok: true, data: result.data };
    console.warn('[claude] Zod validation failed:', result.error.flatten());
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Get a structured dream interpretation from Claude.
 * Retries once with an explicit JSON reminder on any parse/validation failure.
 *
 * @param {string} dreamText
 * @returns {Promise<object>} Validated interpretation object.
 * @throws {Error} If both attempts fail.
 */
export async function interpretDream(dreamText) {
  const prompt = `Now interpret the following dream dynamically:\n"${dreamText}"`;

  // First attempt
  const raw1 = await callAPI(prompt);
  const attempt1 = parseAndValidate(raw1);
  if (attempt1.ok) return attempt1.data;

  // Retry with stronger JSON hint
  console.warn('[claude] First parse failed — retrying with JSON hint');
  const raw2 = await callAPI(
    `${prompt}\n\nCRITICAL REMINDER: Output ONLY the raw JSON object — no markdown fences, no prose, no additional text.`,
  );
  const attempt2 = parseAndValidate(raw2);
  if (attempt2.ok) return attempt2.data;

  throw new Error('Claude returned invalid JSON after two attempts');
}
