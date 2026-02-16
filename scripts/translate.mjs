/**
 * Auto-translate script — uses Gemini API to translate en.json → all other locales.
 * 
 * Usage:
 *   node scripts/translate.mjs
 * 
 * Requires GEMINI_API_KEY environment variable set.
 * Reads locales/en.json, compares with each target locale, translates missing/updated keys.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'locales');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ Set GEMINI_API_KEY environment variable first.');
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const TARGET_LANGUAGES = {
  et: 'Estonian',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  ru: 'Russian',
  fi: 'Finnish',
  sv: 'Swedish',
  lv: 'Latvian',
  lt: 'Lithuanian',
  pl: 'Polish',
  pt: 'Portuguese',
  nl: 'Dutch',
  uk: 'Ukrainian',
};

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

function unflattenObject(flat) {
  const result = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

async function translateBatch(entries, targetLang, langName) {
  // Build a compact JSON for the AI
  const toTranslate = {};
  for (const [key, value] of entries) {
    toTranslate[key] = value;
  }

  const prompt = `You are a translation engine for the Rootwise web application (an intergenerational learning platform).

YOUR TASK: Translate the JSON **values** from English to ${langName} (${targetLang}).

ABSOLUTE RULES — VIOLATION = FAILURE:
1. Return a JSON object with the EXACT SAME KEYS as the input. Do NOT translate, rename, or remove any key.
2. Translate ONLY the string values. Keys must be byte-for-byte identical to the input.
3. Preserve ALL placeholders EXACTLY: {{name}}, {{count}}, {{xp}}, {{n}}, {{level}}, {{plan}}, etc. — never translate or alter them.
4. Preserve emojis, symbols (✓, ✕, ℹ, 🌱, 📹, →, ↔, etc.) in their original positions.
5. Preserve HTML tags (<br/>, <strong>, etc.) and markdown formatting exactly.
6. Keep these brand names UNTRANSLATED: "Rootwise", "Nexus AI", "Gemini AI", "EventNexus OÜ", "Pro", "XP", "Sage", "Seeker".
7. Keep currency amounts ($9.99, $29.99, $49) and technical terms (UUID, CSV, PDF, MP4, URL) as-is.
8. Use a warm, friendly, respectful tone suitable for all ages, especially seniors.
9. Use formal/polite address forms: "vous" (FR), "Sie" (DE), "Вы" (RU), "Lei" (IT), "usted" (ES), "Pan/Pani" (PL), "Vi" (SV), "Te" (ET), "Jūs" (LV), "Jūs" (LT), "Ви" (UK).
10. For keys ending in _one, _other, _few, _many, _zero — these are i18next PLURAL forms. Translate the value but keep the plural suffix on the key unchanged. If ${langName} requires additional plural forms (e.g., Russian needs _one, _few, _many, _other), generate them.
11. Return ONLY valid JSON. No markdown fences, no comments, no explanation text.

INPUT:
${JSON.stringify(toTranslate, null, 2)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  // Parse — remove possible markdown wrappers
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  // VALIDATION: ensure returned keys exactly match input keys
  const inputKeys = new Set(Object.keys(toTranslate));
  const outputKeys = new Set(Object.keys(parsed));
  const extraKeys = [...outputKeys].filter(k => !inputKeys.has(k));
  const missingKeys = [...inputKeys].filter(k => !outputKeys.has(k));

  if (extraKeys.length > 0) {
    console.warn(`      ⚠️  AI returned unexpected keys (removing): ${extraKeys.slice(0, 5).join(', ')}${extraKeys.length > 5 ? '...' : ''}`);
    for (const k of extraKeys) delete parsed[k];
  }
  if (missingKeys.length > 0) {
    console.warn(`      ⚠️  AI missed ${missingKeys.length} keys (keeping English)`);
    for (const k of missingKeys) parsed[k] = toTranslate[k];
  }

  // VALIDATION: ensure {{placeholders}} are preserved
  for (const [key, val] of Object.entries(toTranslate)) {
    const srcPlaceholders = (val.match(/\{\{[^}]+\}\}/g) || []).sort();
    const tgtPlaceholders = ((parsed[key] || '').match(/\{\{[^}]+\}\}/g) || []).sort();
    if (JSON.stringify(srcPlaceholders) !== JSON.stringify(tgtPlaceholders)) {
      console.warn(`      ⚠️  Placeholder mismatch in "${key}" — keeping English`);
      parsed[key] = val;
    }
  }

  return parsed;
}

async function translateLocale(langCode, langName, enFlat) {
  const targetFile = path.join(LOCALES_DIR, `${langCode}.json`);
  
  let existingFlat = {};
  if (fs.existsSync(targetFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
      existingFlat = flattenObject(existing);
    } catch { /* ignore parse errors */ }
  }

  // Find keys that need translation (missing or value same as English = likely untranslated)
  const toTranslate = [];
  for (const [key, value] of Object.entries(enFlat)) {
    if (!existingFlat[key]) {
      toTranslate.push([key, value]);
    }
  }

  if (toTranslate.length === 0) {
    console.log(`  ✅ ${langCode} (${langName}) — already up to date`);
    return;
  }

  console.log(`  🔄 ${langCode} (${langName}) — translating ${toTranslate.length} keys...`);

  // Batch in chunks of 80 keys to stay within token limits
  const BATCH_SIZE = 80;
  const translated = {};

  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toTranslate.length / BATCH_SIZE);
    
    if (totalBatches > 1) {
      console.log(`    batch ${batchNum}/${totalBatches}...`);
    }

    try {
      const result = await translateBatch(batch, langCode, langName);
      Object.assign(translated, result);
    } catch (err) {
      console.error(`    ❌ Batch ${batchNum} failed: ${err.message}`);
      // Fall back to English for failed keys
      for (const [key, value] of batch) {
        translated[key] = value;
      }
    }

    // Rate limit: wait 1s between batches
    if (i + BATCH_SIZE < toTranslate.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Merge with existing
  const merged = { ...existingFlat, ...translated };
  
  // Remove keys that no longer exist in English
  for (const key of Object.keys(merged)) {
    if (!enFlat[key]) delete merged[key];
  }

  const output = unflattenObject(merged);
  fs.writeFileSync(targetFile, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`  ✅ ${langCode} (${langName}) — done (${Object.keys(translated).length} translated)`);
}

async function main() {
  console.log('🌍 Rootwise Auto-Translator\n');

  const enJson = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
  const enFlat = flattenObject(enJson);
  console.log(`📝 English base: ${Object.keys(enFlat).length} keys\n`);

  for (const [code, name] of Object.entries(TARGET_LANGUAGES)) {
    await translateLocale(code, name, enFlat);
    // Wait between languages to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n✨ All translations complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
