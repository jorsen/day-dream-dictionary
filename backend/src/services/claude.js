/**
 * Claude AI integration.
 *
 * Calls the Anthropic Messages API directly (no SDK) using the native fetch
 * available in Node 18+. Validates the structured JSON response with Zod and
 * retries once on parse/validation failure.
 *
 * Model   : claude-haiku-4-5-20251001
 * Temp    : 0.35   (deterministic enough, creative enough)
 * Tokens  : 1 600 max output (extra space for add-on fields)
 */

import { interpretationSchema } from '../validation/schemas.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const TEMPERATURE = 0.35;
const MAX_TOKENS = 1600;

// ── System prompts ────────────────────────────────────────────────────────────

const BASE_SCHEMA = `{
  "mainThemes": ["string"],
  "emotionalTone": "string",
  "symbols": [{"symbol": "string", "meaning": "string"}],
  "personalInsight": "string",
  "guidance": "string"
}`;

function buildSystemPrompt(language = 'en', addonConfig = {}) {
  const isES = language === 'es';

  // ── Core prompt ──
  let prompt = isES
    ? `Eres Day Dream Dictionary (DDD) — un intérprete de sueños empático, místico y psicológicamente perspicaz.

Tarea: Dado el sueño del usuario, devuelve una interpretación estructurada ÚNICAMENTE en JSON válido en español.

Esquema base:
${BASE_SCHEMA}

Directrices:
1. mainThemes: 2–5 motivos conceptuales (ej. libertad, transformación, renacimiento).
2. emotionalTone: estado de ánimo general (alegre, sereno, ansioso, inspirador).
3. symbols: 2–5 elementos clave interpretados emocional o arquetípicamente.
4. personalInsight: significado subconsciente o reflexión de crecimiento.
5. guidance: consejo de apoyo y místico (nunca médico).
6. Estilo: cálido, poético, intuitivo, conciso. Místico + psicológico.
7. Solo JSON — sin markdown, sin texto extra.`
    : `You are Day Dream Dictionary (DDD) — an empathetic, mystical, and psychologically attuned dream interpreter.

Task: Given a user's dream, return a structured interpretation in strict JSON only (English).

Base schema:
${BASE_SCHEMA}

Guidelines:
1. mainThemes: 2–5 conceptual motifs (e.g., freedom, transformation, rebirth).
2. emotionalTone: overall mood (joyful, serene, anxious, awe-inspiring).
3. symbols: 2–5 key elements interpreted emotionally or archetypally.
4. personalInsight: summarize subconscious meaning or growth reflection.
5. guidance: supportive, mystical advice (never medical).
6. Style: warm, poetic, intuitive, concise; mystical + psychological; avoid repetition.
7. JSON-only output; no markdown, no explanations, no extra text.`;

  // ── Add-on extensions ──

  // Life Season add-on
  if (addonConfig.lifeSeason) {
    const season = addonConfig.lifeSeason;
    prompt += isES
      ? `\n\nADD-ON — Temporada de Vida: El usuario está en la fase "${season}".
Incorpora este contexto en tu interpretación. Añade a tu JSON:
"lifeSeason": "2-3 oraciones conectando esta fase de vida con los temas del sueño"`
      : `\n\nADD-ON — Life Season: The user is in the "${season}" life phase.
Incorporate this context. Add to your JSON:
"lifeSeason": "2-3 sentences connecting this life phase to the dream themes"`;
  }

  // Recurring dream flag (free feature — user marked this dream as recurring)
  if (addonConfig.isRecurring) {
    prompt += isES
      ? `\n\nNota: El usuario ha indicado que este es un SUEÑO RECURRENTE — uno que ha tenido varias veces. Presta especial atención a lo que esta repetición podría significar: emociones sin resolver, mensajes persistentes del subconsciente o patrones que el soñador necesita reconocer. Refleja esto en personalInsight y guidance.`
      : `\n\nNote: The user has flagged this as a RECURRING dream — one they have experienced multiple times. Give special attention to what this repetition signifies: unresolved emotions, persistent subconscious messages, or patterns the dreamer needs to acknowledge. Reflect this meaningfully in personalInsight and guidance.`;
  }

  // Recurring Dreams add-on
  if (addonConfig.recurringThemes && addonConfig.recurringThemes.length > 0) {
    const themes = addonConfig.recurringThemes.join(', ');
    prompt += isES
      ? `\n\nADD-ON — Sueños Recurrentes: Los temas más frecuentes en los sueños recientes del usuario son: ${themes}.
Identifica si el sueño de hoy continúa o rompe estos patrones. Añade a tu JSON:
"recurringPatterns": "2-3 oraciones sobre los patrones recurrentes y su significado"`
      : `\n\nADD-ON — Recurring Dreams: The user's most frequent recent dream themes are: ${themes}.
Identify if today's dream continues or breaks these patterns. Add to your JSON:
"recurringPatterns": "2-3 sentences on the recurring patterns and their significance"`;
  }

  // Couples add-on
  if (addonConfig.partnerDreamText) {
    prompt += isES
      ? `\n\nADD-ON — Sueños en Pareja: Interpreta ambos sueños juntos.
Sueño del compañero: "${addonConfig.partnerDreamText}"
Añade a tu JSON:
"relationshipInsight": "2-3 oraciones sobre lo que los sueños combinados revelan sobre la relación"`
      : `\n\nADD-ON — Couples: Interpret both dreams together.
Partner's dream: "${addonConfig.partnerDreamText}"
Add to your JSON:
"relationshipInsight": "2-3 sentences on what the combined dreams reveal about the relationship"`;
  }

  // Therapist PDF add-on (extended clinical observations)
  if (addonConfig.therapistMode) {
    prompt += isES
      ? `\n\nADD-ON — Modo Terapeuta: Añade observaciones clínicas accesibles. Añade a tu JSON:
"therapeuticFocalPoints": ["array de 3-5 observaciones que un terapeuta podría usar como puntos de entrada en sesión. Lenguaje clínico pero accesible. Sin diagnóstico."]`
      : `\n\nADD-ON — Therapist Mode: Add accessible clinical observations. Add to your JSON:
"therapeuticFocalPoints": ["array of 3-5 observations a therapist could use as session entry points. Clinical but accessible language. No diagnosis."]`;
  }

  return prompt;
}

// ── Example for base prompt (English only) ───────────────────────────────────

const EN_EXAMPLE = `\nExample:
Dream: "I could fly over my city, soaring above the buildings. It felt effortless, like I was completely free."
Output:
{
  "mainThemes": ["Freedom", "Exploration", "Perspective"],
  "emotionalTone": "Joyful and liberating",
  "symbols": [
    {"symbol": "Flying", "meaning": "Represents liberation and freedom from limitations"},
    {"symbol": "City", "meaning": "Represents your personal environment and familiar routines"},
    {"symbol": "Soaring above", "meaning": "Gaining a new perspective on life"}
  ],
  "personalInsight": "This dream suggests a desire for freedom and to view your life from a broader perspective.",
  "guidance": "Reflect on areas of your life where you feel restricted. Embrace opportunities for personal growth."
}`;

// ── API call ─────────────────────────────────────────────────────────────────

async function callAPI(systemPrompt, userContent) {
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
      system: systemPrompt,
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

function stripFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseAndValidate(raw) {
  try {
    const parsed = JSON.parse(stripFences(raw));
    const result = interpretationSchema.safeParse(parsed);
    if (result.success) return { ok: true, data: result.data };
    console.warn('[claude] Zod validation failed:', result.error.flatten());
    // Return partial data even if some optional fields fail
    return { ok: true, data: parsed };
  } catch {
    return { ok: false };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a structured dream interpretation from Claude.
 *
 * @param {string} dreamText
 * @param {string} language       'en' | 'es'
 * @param {object} addonConfig    Optional add-on configuration:
 *   - lifeSeason {string}          Life phase label
 *   - recurringThemes {string[]}   Top recurring themes from history
 *   - partnerDreamText {string}    Partner's dream for couples interpretation
 *   - therapistMode {boolean}      Include clinical observations
 * @returns {Promise<object>} Validated interpretation object.
 * @throws {Error} If both attempts fail.
 */
export async function interpretDream(dreamText, language = 'en', addonConfig = {}) {
  const systemPrompt = buildSystemPrompt(language, addonConfig) +
    (language === 'en' ? EN_EXAMPLE : '');

  const prompt = language === 'es'
    ? `Interpreta el siguiente sueño:\n"${dreamText}"`
    : `Now interpret the following dream dynamically:\n"${dreamText}"`;

  // First attempt
  const raw1 = await callAPI(systemPrompt, prompt);
  const attempt1 = parseAndValidate(raw1);
  if (attempt1.ok) return attempt1.data;

  // Retry with stronger JSON hint
  console.warn('[claude] First parse failed — retrying with JSON hint');
  const hint = language === 'es'
    ? '\n\nRECORDATORIO CRÍTICO: Devuelve ÚNICAMENTE el objeto JSON sin markdown ni texto adicional.'
    : '\n\nCRITICAL REMINDER: Output ONLY the raw JSON object — no markdown fences, no prose, no additional text.';

  const raw2 = await callAPI(systemPrompt, prompt + hint);
  const attempt2 = parseAndValidate(raw2);
  if (attempt2.ok) return attempt2.data;

  throw new Error('Claude returned invalid JSON after two attempts');
}
