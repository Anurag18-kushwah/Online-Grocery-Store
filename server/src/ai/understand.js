import { z } from 'zod';
import { parseQuery } from '../services/nlQuery.js';
import { filterSchema } from '../services/filters.js';
import { extractJson } from './provider.js';

const SYS = `You convert grocery shopping requests into JSON filters. Reply with ONLY a JSON object.
Allowed keys: q, minPrice, maxPrice, categories[fruits|vegetables|dairy|snacks|beverages|staples|personal-care|household], diet[vegetarian|vegan|gluten-free|eggetarian], excludeAllergens[peanut|nuts|milk|gluten|soy|egg], inStock(boolean), maxDeliveryMins, minDiscount, minRating, minProtein, maxSugar, sort[popular|price-asc|price-desc|discount|rating|value]. Omit keys you are unsure about.`;

// Rule-based parse is always computed (intent + entities). If an LLM is configured its filters are used only
// if they pass the same strict schema; otherwise we keep the rule-based filters.
export async function understand(text, llm) {
  const rule = parseQuery(text);
  if (!llm) return rule;
  try {
    const raw = extractJson(await llm.complete({ system: SYS, prompt: text }));
    const ok = filterSchema.safeParse(raw);
    if (!ok.success) return { ...rule, note: 'LLM output failed validation; used rule-based parser.' };
    return { ...rule, filters: ok.data, source: 'llm', chips: [...Object.keys(ok.data)].map((k) => `${k}: ${JSON.stringify(ok.data[k])}`) };
  } catch (e) { return { ...rule, note: `LLM unavailable (${e.kind || 'error'}); used rule-based parser.` }; }
}

export const llmRecipeSchema = z.object({
  name: z.string().min(2).max(80), servings: z.number().int().min(1).max(20),
  ingredients: z.array(z.object({ label: z.string().min(2).max(40), qty: z.number().positive().max(5000), unit: z.enum(['g', 'ml', 'pc']) })).min(2).max(20),
  steps: z.array(z.string().max(300)).max(12).default([]),
});

export async function llmRecipe(llm, dish, servings, diet) {
  if (!llm) return null;
  const sys = 'You write simple home recipes. Reply with ONLY JSON: {"name":string,"servings":int,"ingredients":[{"label":string,"qty":number,"unit":"g"|"ml"|"pc"}],"steps":[string]}. Use plain ingredient names a grocery store sells.';
  try {
    const r = llmRecipeSchema.parse(extractJson(await llm.complete({ system: sys, prompt: `Recipe for ${dish}, ${servings} servings${diet.length ? ', ' + diet.join(' and ') : ''}.` })));
    return { slug: 'llm-generated', name: r.name, meal: 'dinner', servings: r.servings, minutes: null, dietary: [], source: 'llm-generated (unverified)', aliases: [], steps: r.steps, ingredients: r.ingredients.map((i) => ({ ...i, optional: false })) };
  } catch { return null; }
}

const ctx = (chat = []) => (chat.length ? `Conversation so far:\n${chat.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}\n` : '');

// Grounded: rephrase tool results only.
export async function llmPhrase(llm, question, data, chat = []) {
  if (!llm) return null;
  try {
    return (await llm.complete({ system: 'You are GrocerAI, a grocery shopping assistant. Answer in under 110 words using ONLY the JSON facts provided. If the facts include recipe steps or ingredients, summarise them briefly and mention that the card below shows every ingredient with an Add-to-cart button; never say you cannot provide steps. Never invent products, prices, stock or delivery times. Prices are in rupees (₹). If data is missing, say so.', prompt: `${ctx(chat)}Question: ${question}\nFacts: ${JSON.stringify(data).slice(0, 6000)}` })).trim();
  } catch { return null; }
}

// Open conversation: general knowledge is allowed, but store facts must come from `catalogue`.
// The model returns JSON { reply, cookDish } so the server can build a real, stock-matched plan when the user wants to cook something.
export async function llmChat(llm, question, catalogue, chat = []) {
  if (!llm) return null;
  try {
    const raw = await llm.complete({
      system: `You are GrocerAI, a friendly, knowledgeable assistant inside an Indian online grocery store. Answer ANY question helpfully (cooking, nutrition, food storage, budgeting, general knowledge, small talk) in the user's language, concisely (under 140 words, simple markdown allowed). Nutrition info is general, not medical advice. NEVER claim the store sells a product, its price, or its stock unless it appears in catalogueMatches. Reply ONLY with JSON: {"reply": "<your answer>", "cookDish": "<dish name>" or null}. Set cookDish to the dish name whenever the user wants to cook/make/buy ingredients for a specific dish (the store will then build the shopping list itself), otherwise null.`,
      prompt: `${ctx(chat)}User: ${question}\ncatalogueMatches: ${JSON.stringify(catalogue).slice(0, 3000)}`,
    });
    try { const j = extractJson(raw); if (typeof j.reply === 'string' && j.reply.trim()) return { reply: j.reply.trim(), cookDish: typeof j.cookDish === 'string' && j.cookDish.trim() ? j.cookDish.trim().slice(0, 80) : null }; } catch { /* plain text answer */ }
    return { reply: raw.trim(), cookDish: null };
  } catch { return null; }
}
