/**
 * Claude AI integration.
 *
 * Calls the Anthropic Messages API directly (no SDK) using the native fetch
 * available in Node 18+. Validates the structured JSON response with Zod and
 * retries once on parse/validation failure.
 *
 * Model   : claude-3-5-sonnet-20241022
 * Temp    : 0.35   (deterministic enough, creative enough)
 * Tokens  : 1 024 max output (the JSON schema fits comfortably)
 */

import { interpretationSchema } from '../validation/schemas.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-5-sonnet-20241022';
const TEMPERATURE = 0.35;
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `\
You are Day Dream Dictionary — an empathetic, mystical, and psychologically attuned dream interpreter.

Given a dream description, return a JSON object that strictly conforms to this schema (no extra fields):

{
  "mainThemes": ["string"],
  "emotionalTone": "string",
  "symbols": [{"symbol": "string", "meaning": "string"}],
  "personalInsight": "string",
  "guidance": "string"
}

Field guidelines:
• mainThemes   — 2–5 recurring motifs (e.g. transformation, fear, rebirth, connection).
• emotionalTone — single evocative phrase describing the dream's mood / atmosphere.
• symbols      — 2–5 key dream elements; interpret each emotionally or archetypally.
• personalInsight — 2–4 sentences: what the subconscious may be processing or seeking.
• guidance     — 2–4 sentences: supportive, mystical direction. Never clinical or prescriptive.

Style: warm, poetic, intuitive. Blend Jungian symbolism with mindful awareness. Avoid clichés.

CRITICAL: Output ONLY the raw JSON object — no markdown fences, no prose, no additional text.`;

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
  const prompt = `Please interpret this dream:\n\n${dreamText}`;

  // First attempt
  const raw1 = await callAPI(prompt);
  const attempt1 = parseAndValidate(raw1);
  if (attempt1.ok) return attempt1.data;

  // Retry with stronger JSON hint
  console.warn('[claude] First parse failed — retrying with JSON hint');
  const raw2 = await callAPI(
    `${prompt}\n\nIMPORTANT: Your response MUST be a single raw JSON object — no markdown, no extra text.`,
  );
  const attempt2 = parseAndValidate(raw2);
  if (attempt2.ok) return attempt2.data;

  throw new Error('Claude returned invalid JSON after two attempts');
}
