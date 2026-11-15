// LLM provider abstraction. Returns null when no provider is configured, and the app then runs in
// deterministic fallback mode. Every call has a timeout; failures raise LLMError so callers can fall back.
export class LLMError extends Error { constructor(message, kind = 'error') { super(message); this.kind = kind; } }

export function createLLM(cfg) {
  const { provider, model, region, baseUrl, apiKey, timeoutMs } = cfg;
  if (!provider || provider === 'none') return null;

  if (provider === 'openai-compatible') {
    if (!baseUrl || !apiKey || !model) { console.warn('[llm] openai-compatible needs LLM_BASE_URL, LLM_API_KEY, LLM_MODEL; running in fallback mode.'); return null; }
    return { name: `openai-compatible:${model}`, async complete({ system, prompt }) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1500, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
        if (res.status === 429) throw new LLMError('Rate limited by provider', 'rate-limit');
        if (res.status === 401 || res.status === 403) throw new LLMError('Provider rejected credentials', 'auth');
        if (!res.ok) throw new LLMError(`Provider error ${res.status}`, 'http');
        const text = (await res.json()).choices?.[0]?.message?.content;
        if (!text) throw new LLMError('Empty provider response', 'empty');
        return text;
      } catch (e) { if (e instanceof LLMError) throw e; throw new LLMError(e.name === 'AbortError' ? 'Provider timed out' : e.message, e.name === 'AbortError' ? 'timeout' : 'network'); }
      finally { clearTimeout(t); }
    } };
  }

  if (provider === 'bedrock') {
    if (!region || !model) { console.warn('[llm] bedrock needs AWS_REGION and BEDROCK_MODEL_ID; running in fallback mode.'); return null; }
    let client, mod;
    return { name: `bedrock:${model}`, async complete({ system, prompt }) {
      try {
        mod ||= await import('@aws-sdk/client-bedrock-runtime'); // credentials come from the standard AWS provider chain (env vars / role)
        client ||= new mod.BedrockRuntimeClient({ region });
        const out = await client.send(new mod.ConverseCommand({ modelId: model, system: [{ text: system }], messages: [{ role: 'user', content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 700, temperature: 0.2 } }),
          { abortSignal: AbortSignal.timeout(timeoutMs) });
        const text = out.output?.message?.content?.map((c) => c.text).join('');
        if (!text) throw new LLMError('Empty provider response', 'empty');
        return text;
      } catch (e) {
        if (e instanceof LLMError) throw e;
        const n = e.name || '';
        throw new LLMError(n === 'TimeoutError' || n === 'AbortError' ? 'Provider timed out' : n === 'ThrottlingException' ? 'Rate limited by provider' : /credential/i.test(e.message) || n === 'AccessDeniedException' ? 'Provider credentials unavailable or denied' : e.message,
          n === 'ThrottlingException' ? 'rate-limit' : n === 'TimeoutError' ? 'timeout' : 'error');
      }
    } };
  }
  console.warn(`[llm] unknown LLM_PROVIDER "${provider}"; running in fallback mode.`);
  return null;
}

export const extractJson = (text) => { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new LLMError('No JSON in response', 'parse'); return JSON.parse(m[0]); };
