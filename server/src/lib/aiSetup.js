// Helpers for `npm run setup`: discover which models a provider offers (so we never rely on stale model names) and verify the key works.
export const PROVIDERS = {
  1: { name: 'Groq (free tier, fast)', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', prefer: [/llama-3\.3-70b/i, /gpt-oss-120b/i, /gpt-oss/i, /llama-4/i, /qwen/i, /kimi/i, /llama/i] },
  2: { name: 'Google Gemini (free tier)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', prefer: [/flash(?!.*(lite|image|preview))/i, /flash/i, /pro/i] },
  3: { name: 'Ollama (runs on your PC, no key)', baseUrl: 'http://localhost:11434/v1', keyUrl: 'https://ollama.com/download', prefer: [/llama3/i, /qwen/i, /gemma/i, /llama/i], noKey: true },
};
const NOT_CHAT = /whisper|guard|tts|embed|orpheus|playai|moderation|imagen|veo|aqa|image|audio|vision-preview|allam/i;

export async function listModels({ baseUrl, apiKey }) {
  const res = await fetch(`${baseUrl}/models`, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
  if (res.status === 401 || res.status === 403) throw new Error('The provider rejected this key (401/403). Check you copied the whole key.');
  if (!res.ok) throw new Error(`Provider returned HTTP ${res.status}`);
  const j = await res.json();
  return (j.data || j.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter((id) => id && !NOT_CHAT.test(id)).sort();
}

// Tries the model id as-is, then with the "models/" prefix (providers differ). Reports the FIRST (real) error with the provider's own message.
export async function testChat({ baseUrl, apiKey, model }) {
  const errs = [];
  for (const m of [model, `models/${model}`]) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: m, max_tokens: 300, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] }), signal: AbortSignal.timeout(25000) });
      if (res.ok) { const t = (await res.json()).choices?.[0]?.message?.content; if (t) return { ok: true, model: m, sample: t.trim().slice(0, 40) }; errs.push('empty reply (model may be a reasoning model that used all tokens)'); continue; }
      let msg = ''; try { const j = await res.json(); msg = j.error?.message || j.message || ''; } catch { /* no body */ }
      errs.push(`HTTP ${res.status}${res.status === 429 ? ' (rate limited, try again in a minute)' : ''}${msg ? `: ${String(msg).slice(0, 160)}` : ''}`);
    } catch (e) { errs.push(e.name === 'TimeoutError' ? 'timed out' : e.message); }
  }
  return { ok: false, error: errs[0] || 'unknown error' };
}
// Best model first (by the provider's preference list), then everything else.
export function rankModels(ids, prefer) {
  const out = [];
  for (const re of [].concat(prefer)) for (const id of ids) if (re.test(id) && !out.includes(id)) out.push(id);
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}
// prefer: a RegExp or an ordered list of RegExps (best first).
export const pickDefault = (ids, prefer) => { for (const re of [].concat(prefer)) { const hit = ids.find((i) => re.test(i)); if (hit) return hit; } return ids[0]; };
// API keys are long opaque strings; reject typos like "2" before saving them.
export const looksLikeKey = (k) => typeof k === 'string' && k.trim().length >= 20 && !/\s/.test(k.trim());
