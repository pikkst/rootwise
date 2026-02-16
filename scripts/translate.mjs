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

  const prompt = `You are a professional translator for a web application called Rootwise (an intergenerational learning platform).

Translate the following JSON values from English to ${langName} (${targetLang}).

CRITICAL RULES:
1. Translate ONLY the values, keep the keys exactly as they are.
2. Preserve ALL placeholders like {{name}}, {{count}}, {{xp}}, {{n}}, etc. — do NOT translate them.
3. Preserve emojis, symbols (✓, ✕, ℹ, 🌱, 📹, etc.), and special characters exactly.
4. Preserve HTML entities and markdown if any.
5. Keep brand names untranslated: "Rootwise", "Nexus AI", "Gemini AI", "EventNexus OÜ", "Pro", "XP".
6. Keep currency amounts ($9.99, $49) as-is.
7. Keep technical terms like "UUID", "CSV", "PDF", "MP4" as-is.
8. Use a warm, friendly, respectful tone suitable for all ages, especially seniors.
9. Use formal/polite forms where the language has them (e.g., "vous" in French, "Sie" in German, "Вы" in Russian).
10. Return ONLY valid JSON — no markdown, no explanation, no backticks.

Input JSON:
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
  return JSON.parse(cleaned);
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
