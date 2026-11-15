// Rule-based natural-language understanding. Output is always validated by filterSchema before use;
// nothing here (or from an LLM) ever becomes a database query.
import { filterSchema } from './filters.js';

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const CATS = { snack: 'snacks', snacks: 'snacks', fruit: 'fruits', fruits: 'fruits', vegetable: 'vegetables', vegetables: 'vegetables', veggies: 'vegetables', dairy: 'dairy', beverage: 'beverages', beverages: 'beverages', drinks: 'beverages', drink: 'beverages', staples: 'staples', groceries: null, household: 'household', cleaning: 'household', 'personal care': 'personal-care' };
const ALLERGEN_WORDS = { peanut: 'peanut', peanuts: 'peanut', nut: 'nuts', nuts: 'nuts', milk: 'milk', dairy: 'milk', gluten: 'gluten', soy: 'soy', egg: 'egg', eggs: 'egg' };
const STOP = new Set(['find', 'show', 'me', 'give', 'get', 'some', 'any', 'products', 'product', 'items', 'item', 'under', 'below', 'within', 'less', 'than', 'for', 'the', 'a', 'an', 'and', 'with', 'my', 'i', 'want', 'need', 'please', 'to', 'of', 'in', 'on', 'is', 'are', 'cheap', 'cheaper', 'cheapest', 'best', 'top', 'rated', 'value', 'high', 'low', 'protein', 'sugar', 'stock', 'only', 'rs', 'inr', 'vegetarian', 'vegan', 'free', 'no', 'without', 'ingredients', 'family', 'lunch', 'people', 'persons', 'person', 'discount', 'offers', 'offer', 'deals', 'fast', 'delivery', 'minutes', 'between', 'ill', 'have', 'rupees', 'budget', 'plan', 'basket', 'cart', 'alternatives', 'alternative', 'current', 'shopping', 'list', 'days', 'day', 'three', 'two', 'four', 'five', 'one', 'goods', 'suggest', 'what', 'which', 'can', 'could', 'would', 'how', 'much', 'does', 'do', 'cost', 'costs', 'price', 'compare', 'versus', 'vs', 'or']);

export function parseQuery(text) {
  const t = ` ${text.toLowerCase().replace(/[₹]/g, ' rs ').replace(/\s+/g, ' ')} `;
  const f = {}; const chips = []; const entities = {};
  const add = (label) => chips.push(label);

  let m;
  if ((m = t.match(/between (?:rs\.? ?)?(\d+) (?:and|to|-) (?:rs\.? ?)?(\d+)/))) { f.minPrice = +m[1]; f.maxPrice = +m[2]; add(`₹${m[1]}–₹${m[2]}`); }
  else if ((m = t.match(/(?:under|below|within|less than|upto|up to|max(?:imum)?|budget of|with|for|have)\s+(?:a\s+)?(?:rs\.? ?|inr ?|rupees ?)?(\d{2,6})(?!\s*(?:g|kg|ml|l|%|min|minutes|people|persons|days?))/))) { f.maxPrice = +m[1]; entities.budget = +m[1]; add(`Under ₹${m[1]}`); }
  else if ((m = t.match(/(?:rs\.? ?|inr ?)(\d{2,6})/))) { entities.budget = +m[1]; }

  if (t.includes('vegan')) { f.diet = ['vegan']; add('Vegan'); }
  else if (/\bveg(?:etarian)?\b/.test(t)) { f.diet = ['vegetarian']; add('Vegetarian'); }
  if (/gluten[- ]free/.test(t)) { f.diet = [...(f.diet || []), 'gluten-free']; add('Gluten-free'); }
  if (/high[- ]protein|protein[- ]rich|more protein/.test(t)) { f.minProtein = 10; add('High protein (≥10 g/100 g)'); }
  if (/low[- ]sugar|less sugar|sugar[- ]free/.test(t)) { f.maxSugar = 5; add('Low sugar (≤5 g/100 g)'); }
  const avoid = [...t.matchAll(/(?:without|no|free of|avoid|allergic to|(\w+)[- ]free)\s*(\w+)?/g)].flatMap((x) => [x[2], x[1]]).filter((w) => w && ALLERGEN_WORDS[w] && w !== 'free');
  if (avoid.length) { f.excludeAllergens = [...new Set(avoid.map((a) => ALLERGEN_WORDS[a]))]; add(`No ${f.excludeAllergens.join(', ')}`); }
  if (/in stock|available/.test(t)) { f.inStock = true; add('In stock'); }
  if (/discount|on offer|deals|offers/.test(t)) { f.minDiscount = 10; add('10%+ off'); }
  if ((m = t.match(/(?:within|under|in)\s+(\d+)\s*(?:min|minutes)/))) { f.maxDeliveryMins = +m[1]; add(`≤${m[1]} min delivery`); }
  else if (/fast delivery|quick delivery/.test(t)) { f.maxDeliveryMins = 15; add('≤15 min delivery'); }
  if (/top[- ]rated|best[- ]rated|highest rated/.test(t)) { f.minRating = 4.3; f.sort = 'rating'; add('Top rated'); }
  if (/best value|value for money/.test(t)) { f.sort = 'value'; add('Best value'); }
  else if (/cheap(?:est)?\b/.test(t)) { f.sort = 'price-asc'; add('Cheapest first'); }

  const cats = Object.keys(CATS).filter((k) => CATS[k] && new RegExp(`\\b${k}\\b`).test(t)).map((k) => CATS[k]);
  if (cats.length && !/\bmilk\b/.test(t)) { f.categories = [...new Set(cats)]; add(f.categories.join(', ')); }

  // people / days / meals / pantry
  if ((m = t.match(/(?:for|serves?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?!\s*days?\b)\s*(?:people|persons|person|members|adults)?/))) entities.servings = NUM[m[1]] || +m[1];
  if (!entities.servings && /\bfamily\b/.test(t)) entities.servings = 4;
  if ((m = t.match(/(\d+|one|two|three|four|five|six|seven)\s+days?/))) entities.days = NUM[m[1]] || +m[1];
  const meals = ['breakfast', 'lunch', 'dinner'].filter((x) => t.includes(x)); if (meals.length) entities.meals = meals.filter((x) => x !== 'lunch');
  if ((m = t.match(/(?:i (?:already )?have|already have|got)\s+([a-z ,]+?)(?:\.|\bunder\b|\bwithin\b|\bfor\b|$)/))) entities.pantry = m[1].split(/,|\band\b/).map((x) => x.trim()).filter(Boolean);

  // intent
  let intent = 'search';
  if (/(cheaper|cheap|save|savings|optimi[sz]e|reduce).*(basket|cart)|(basket|cart).*(cheaper|alternatives?|optimi[sz]e|save|budget)/.test(t)) intent = 'basket';
  else if ((entities.days && (entities.meals || /groceries|shopping list/.test(t))) || /ingredients for (?:a )?(?:family )?(?:dinner|breakfast)/.test(t)) intent = 'mealplan';
  else if (/\b(recipe|cook|make|plan)\b/.test(t) && !/shopping list/.test(t)) intent = 'recipe';
  else if (/substitut|alternative to|instead of|replace/.test(t)) intent = 'substitute';
  else if (/\bcompare\b| vs | versus /.test(t)) intent = 'compare';
  else if (/\b(help|what can you do)\b/.test(t)) intent = 'help';

  const leftover = (t.match(/[a-z]+/g) || []).filter((w) => !STOP.has(w) && !CATS[w] && !ALLERGEN_WORDS[w] && w !== 'rs' && !/^(?:snack|fruit|vegetable)s?$/.test(w));
  if (leftover.length && intent === 'search') f.q = leftover.slice(0, 3).join(' ');

  const parsed = filterSchema.safeParse(f);
  return { intent, filters: parsed.success ? parsed.data : {}, entities, chips, source: 'rule-based', valid: parsed.success, leftover };
}
