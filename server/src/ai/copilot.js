import { applyFilters } from '../services/filters.js';
import { analyzeBasket } from '../services/optimizer.js';
import { substitutesFor } from '../services/substitutes.js';
import { findRecipe, buildRecipePlan, planMeals, searchRecipes, localRecipes } from '../services/recipes.js';
import { understand, llmRecipe, llmPhrase, llmChat } from './understand.js';
import { unitPrice, unitPriceLabel } from '../utils/units.js';
import { inr } from '../utils/text.js';

const WORDS = (s) => (s.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 2 && !['and', 'the', 'kg', 'pack'].includes(w));
function findProduct(text, products) {
  const tw = new Set(WORDS(text)); let best = null, bs = 0;
  for (const p of products) { const nw = WORDS(p.name); if (!nw.length) continue; const s = nw.filter((w) => tw.has(w) || tw.has(w.replace(/s$/, ''))).length / nw.length; if (s >= 0.5 && s > bs) { best = p; bs = s; } }
  return best;
}
const top = (arr, n = 5) => arr.slice(0, n);
const LIMITS = 'Prices, stock and totals come from this store\'s database at request time. I cannot check live inventory, delivery status or other stores.';
const QUESTION = /\?\s*$|^\s*(how|what|why|which|can|could|should|is|are|do|does|tell|explain|suggest|who|when|where)\b/i;

export async function copilot({ message, cartLines = [], products, prefs = null, history = null, llm = null, chatHistory = [] }) {
  const u = await understand(message, llm);
  const tools = [], cards = {}, assumptions = []; let reply, facts = {};
  const diet = u.filters.diet?.length ? u.filters.diet : (prefs?.dietary || []);
  const avoid = prefs?.avoidAllergens || [];
  const budget = u.entities.budget ?? null;
  const done = (extra) => ({ reply, source: 'rule-based', intent: u.intent, understood: u.chips, tools, cards, assumptions, note: u.note || null, limits: LIMITS, ...extra });

  const recipePlanFor = async (dish, servings, source) => {
    let recipe = findRecipe(dish), src = 'local catalogue';
    if (!recipe && llm) { recipe = await llmRecipe(llm, dish, servings, diet); src = 'LLM-generated (unverified)'; }
    if (!recipe) return null;
    const plan = buildRecipePlan({ recipe, servings, products, pantry: u.entities.pantry || [], diet, avoid, budget });
    tools.push({ name: 'match_recipe_ingredients', params: { recipe: recipe.name, servings, budget }, result: `${plan.lines.filter((l) => l.status === 'matched').length} matched, ${plan.unavailable.length} unavailable` });
    return { recipe, plan, src: source || src };
  };

  // Open conversation with the LLM (answers anything). Returns null if no LLM or it failed.
  const converse = async () => {
    if (!llm) return null;
    const r = applyFilters(products, { ...u.filters, inStock: true });
    const out = await llmChat(llm, message, top(r.products, 6).map((p) => ({ name: p.name, price: p.price, inStock: true })), chatHistory);
    if (!out) return null;
    tools.push({ name: 'llm_chat', params: { message: message.slice(0, 60) }, result: 'answered' });
    const res = { reply: out.reply, source: 'llm-chat', intent: 'chat', understood: u.chips, tools, cards: {}, assumptions, note: null, limits: LIMITS };
    if (out.cookDish) {
      const servings = u.entities.servings ?? 4; if (!u.entities.servings) assumptions.push('Assumed 4 servings.');
      const r2 = await recipePlanFor(out.cookDish, servings);
      if (r2) { res.cards.recipe = r2.plan; res.tools.push({ name: 'build_shopping_list', params: { dish: out.cookDish }, result: `${r2.plan.cost.buyCost} INR for whole packs` }); }
    } else if (r.total && Object.keys(u.filters).length) res.cards.products = top(r.products, 4);
    return res;
  };

  // Without an LLM: a bare dish name ("veg biryani") finds no products but is a known recipe, so plan it. (With an LLM the model converses instead.)
  if (!llm && u.intent === 'search' && !applyFilters(products, { ...u.filters, inStock: true }).total && findRecipe(message)) u.intent = 'recipe';

  switch (u.intent) {
    case 'basket': {
      if (!cartLines.length) { reply = 'Your cart is empty, so there is nothing to optimise yet. Add a few items and ask again.'; break; }
      const r = analyzeBasket({ lines: cartLines, products, budget, prefs, history });
      tools.push({ name: 'analyze_basket', params: { items: cartLines.length, budget }, result: `${r.suggestions.length} suggestions` });
      cards.optimizer = r; facts = { total: r.total, budget, overBudget: r.overBudget, potentialSavings: r.potentialSavings, suggestions: r.suggestions.map((s) => ({ from: s.fromName, to: s.toProduct.name, saving: s.saving })) };
      reply = `Your basket is ${inr(r.total)}${budget != null ? (r.overBudget ? `, ${inr(-r.remaining)} over your ${inr(budget)} budget` : `, leaving ${inr(r.remaining)} of your ${inr(budget)} budget`) : ''}. ` +
        (r.suggestions.length ? `I found ${r.suggestions.length} possible swap${r.suggestions.length > 1 ? 's' : ''} saving up to ${inr(r.potentialSavings)}. Nothing changes until you approve it.` : 'I could not find cheaper like-for-like options for these items.');
      break;
    }
    case 'mealplan': {
      const days = u.entities.days ?? 1, servings = u.entities.servings ?? 2, meals = u.entities.meals?.length ? u.entities.meals : ['dinner'];
      if (!u.entities.servings) assumptions.push('Assumed 2 people (you did not say how many).'); if (!u.entities.days) assumptions.push('Assumed 1 day.');
      const plan = planMeals({ days, servings, budget, meals, products, diet, avoid });
      tools.push({ name: 'plan_meals', params: { days, servings, budget, meals, diet }, result: plan.error || plan.note });
      if (plan.error) { reply = plan.error; break; }
      cards.mealplan = plan; facts = { meals: plan.meals, buyCost: plan.buyCost, fitsBudget: plan.fitsBudget, items: plan.lines.map((l) => ({ label: l.label, product: l.product?.name, units: l.units, cost: l.buyCost })) };
      reply = `${plan.note} Plan: ${plan.meals.map((m) => `${m.name} ×${m.times}`).join(', ')} for ${servings} people over ${days} day${days > 1 ? 's' : ''}. ${plan.disclaimer}`;
      break;
    }
    case 'recipe': {
      const servings = u.entities.servings ?? 4; if (!u.entities.servings) assumptions.push('Assumed 4 servings.');
      const r = await recipePlanFor(message, servings);
      if (!r) {
        const chat = await converse(); if (chat) return chat;
        const ideas = searchRecipes(message, 5); cards.ideas = ideas.map((x) => ({ slug: x.slug, name: x.name, minutes: x.minutes, meal: x.meal }));
        tools.push({ name: 'search_recipes', params: { query: message }, result: `${ideas.length} close matches` });
        reply = (ideas.length ? `I don't have an exact recipe for that. Closest matches: ${ideas.map((x) => x.name).join(', ')}. Tap one to plan it.` : "I don't have a recipe for that dish.") + ' To plan ANY dish and chat about anything, connect a real-time AI: run "npm run setup" (takes 2 minutes).';
        break;
      }
      const { recipe, plan, src } = r; cards.recipe = plan; facts = { recipe: recipe.name, source: src, servings, cost: plan.cost, budget: plan.budget, unavailable: plan.unavailable, haveIt: plan.haveIt, steps: recipe.steps, ingredients: plan.lines.map((l) => ({ ingredient: l.label, need: `${l.needed.qty} ${l.needed.unit}`, status: l.status, product: l.product?.name, packs: l.units, cost: l.buyCost })), uiNote: 'The user sees a card with every ingredient, its photo, price and an Add-to-cart button, plus the method steps.' };
      reply = `${recipe.name} for ${servings} (${src}): cart cost ${inr(plan.cost.buyCost)} for whole packs, about ${inr(plan.cost.usedCostEstimate)} for just the portions used.` +
        (plan.budget ? (plan.budget.fitsBuyCost ? ` That fits your ${inr(budget)} budget.` : plan.budget.fitsUsedCost ? ` Buying whole packs is ${inr(plan.budget.buyOverBy)} over your ${inr(budget)}, but the portions used fit; pantry staples you already own would lower the cart cost.` : ` That is over your ${inr(budget)} budget.`) : '') +
        (plan.unavailable.length ? ` Not sold here: ${plan.unavailable.join(', ')}.` : '') + (plan.dietWarning ? ` ${plan.dietWarning}` : '');
      break;
    }
    case 'substitute': {
      const p = findProduct(message, products);
      if (!p) { reply = 'Which product would you like a substitute for? Mention its name, e.g. "substitute for Fresh Paneer".'; break; }
      const subs = substitutesFor(p, products, { prefs, history, limit: 4 });
      tools.push({ name: 'find_substitutes', params: { product: p.name }, result: `${subs.length} found` }); cards.substitutes = { for: p, substitutes: subs };
      facts = { for: p.name, subs: subs.map((s) => ({ name: s.product.name, price: s.product.price, reasons: s.reasons })) };
      reply = subs.length ? `Closest substitutes for ${p.name}: ${subs.map((s) => `${s.product.name} (${inr(s.product.price)})`).join(', ')}. I only compare nutrition when both products have data.` : `I couldn't find a suitable in-stock substitute for ${p.name} that matches its dietary labels.`;
      break;
    }
    case 'compare': {
      const parts = message.split(/\bvs\.?\b|\bversus\b|\band\b|\bor\b|,/i).map((s) => findProduct(s, products)).filter(Boolean);
      const uniq = [...new Map(parts.map((p) => [p.id, p])).values()].slice(0, 3);
      if (uniq.length < 2) { const chat = await converse(); if (chat) return chat; reply = 'Tell me two products to compare, e.g. "compare rolled oats and corn flakes".'; break; }
      const rows = uniq.map((p) => ({ ...p, unitPrice: Number(unitPrice(p).toFixed(2)), unitLabel: unitPriceLabel(p) }));
      tools.push({ name: 'compare_products', params: { products: uniq.map((p) => p.name) }, result: 'ok' }); cards.compare = rows; facts = rows.map((p) => ({ name: p.name, price: p.price, unitPrice: p.unitPrice, rating: p.rating, nutrition: p.nutrition }));
      const sameUnit = rows.every((r) => r.unit === rows[0].unit), cheapest = [...rows].sort((a, b) => a.unitPrice - b.unitPrice)[0];
      reply = sameUnit ? `${cheapest.name} is cheapest ${cheapest.unitLabel} (${inr(cheapest.unitPrice)}). ` + rows.map((r) => `${r.name}: ${inr(r.price)}, ★${r.rating}`).join(' | ') : 'These use different units, so unit prices are not directly comparable. ' + rows.map((r) => `${r.name}: ${inr(r.price)}`).join(' | ');
      break;
    }
    case 'help': {
      reply = 'I can search products ("vegetarian snacks under ₹200"), plan recipes ("paneer fried rice for 4 under ₹300"), plan meals within a budget, find cheaper swaps for your cart, suggest substitutes and compare products.' + (llm ? ' I can also chat about cooking, nutrition and anything else.' : ''); break;
    }
    default: {
      const f = { ...u.filters, inStock: true }; const r = applyFilters(products, f);
      tools.push({ name: 'search_products', params: f, result: `${r.total} products` });
      if (llm && (QUESTION.test(message) || r.total === 0)) { tools.pop(); const chat = await converse(); if (chat) return chat; tools.push({ name: 'search_products', params: f, result: `${r.total} products` }); }
      cards.products = top(r.products, 8);
      facts = { total: r.total, top: top(r.products, 5).map((p) => ({ name: p.name, price: p.price, unit: p.unitPrice })) };
      if (!r.total && !llm) {
        const ideas = searchRecipes(message, 4);
        if (ideas.length) { cards.ideas = ideas.map((x) => ({ slug: x.slug, name: x.name, minutes: x.minutes, meal: x.meal })); tools.push({ name: 'search_recipes', params: { query: message }, result: `${ideas.length} close matches` }); }
        reply = `No products matched “${message.slice(0, 40)}”.` + (ideas.length ? ` Maybe you meant a recipe: ${ideas.map((x) => x.name).join(', ')}.` : '') + ' I can only answer store questions right now; to chat about anything and plan any dish, run "npm run setup" to connect a real-time AI (2 minutes).';
        break;
      }
      reply = r.total ? `I found ${r.total} in-stock product${r.total > 1 ? 's' : ''}. Top matches: ${top(r.products, 4).map((p) => `${p.name} (${inr(p.price)})`).join(', ')}.` : 'No products matched. Try raising the price limit or removing a dietary or nutrition filter.';
      if (r.excludedForMissingData) reply += ` (${r.excludedForMissingData} products were skipped because they lack the nutrition/expiry data needed.)`;
    }
  }
  let source = 'rule-based';
  if (llm && u.intent !== 'help' && Object.keys(facts).length) { const t = await llmPhrase(llm, message, facts, chatHistory); if (t) { reply = t; source = 'llm-phrased'; } }
  return done({ source });
}
