// Gemini Proxy — keeps API key server-side
// Deploy: supabase functions deploy gemini-proxy --no-verify-jwt
// Env vars needed: GEMINI_API_KEY

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

type ChatPart = { text: string };
type ChatContent = { role: 'user' | 'model'; parts: ChatPart[] };

type CandidateProfile = {
  id: string;
  name: string;
  age: number | null;
  role: string | null;
  preferred_language: string | null;
  spoken_languages: string[] | null;
  skills: string[] | null;
  interests: string[] | null;
  bio: string | null;
  locations: string[];
  score: number;
};

const LOCATION_STOP_WORDS = new Set([
  'kas', 'on', 'meil', 'kusagil', 'aastast', 'aastane', 'kandist', 'kandis', 'saaks', 'mind', 'aidata',
  'arvutiga', 'arvuti', 'teha', 'oleks', 'palun', 'tere', 'there', 'help', 'with', 'from', 'near', 'in',
]);

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replaceAll('õ', 'o')
    .replaceAll('ä', 'a')
    .replaceAll('ö', 'o')
    .replaceAll('ü', 'u');
}

function extractLatestUserMessage(contents: ChatContent[]): string {
  const latest = [...contents].reverse().find((c) => c.role === 'user');
  return latest?.parts?.map((p) => p.text).join(' ').trim() || '';
}

function extractTargetAge(message: string): number | null {
  const match = message.match(/(\d{2})\s*-?\s*aast/i);
  if (!match) return null;
  const age = Number(match[1]);
  return Number.isFinite(age) ? age : null;
}

function extractSkillHints(message: string): string[] {
  const m = normalizeText(message);
  const hints: string[] = [];

  if (/arvuti|computer|pc|laptop|it|tech|tehnoloogia|dig/i.test(m)) hints.push('computer');
  if (/coding|code|program|arend|software|javascript|typescript|python/i.test(m)) hints.push('coding');
  if (/internet|wifi|email|printer/i.test(m)) hints.push('it-support');

  return [...new Set(hints)];
}

function extractLanguageHint(message: string): string | null {
  const m = normalizeText(message);
  if (/eesti|estonian|estonia/i.test(m)) return 'estonian';
  if (/inglis|english/i.test(m)) return 'english';
  if (/vene|russian/i.test(m)) return 'russian';
  if (/soome|finnish/i.test(m)) return 'finnish';
  if (/saksa|german/i.test(m)) return 'german';
  if (/rootsi|swedish/i.test(m)) return 'swedish';
  if (/lati|latvian/i.test(m)) return 'latvian';
  if (/leedu|lithuanian/i.test(m)) return 'lithuanian';
  return null;
}

function extractLocationHints(message: string): string[] {
  const tokens = normalizeText(message)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !LOCATION_STOP_WORDS.has(t));

  const directPlaces = ['poltsamaa', 'jogeva', 'tartu', 'tallinn', 'parnu', 'rakvere', 'viljandi'];
  const placeHits = directPlaces.filter((p) => normalizeText(message).includes(p));

  return [...new Set([...placeHits, ...tokens])].slice(0, 6);
}

function shouldCreateQuest(message: string): boolean {
  return /(loo\s+quest|tee\s+quest|create\s+quest|make\s+a\s+quest)/i.test(message);
}

function buildSkillBlob(profile: CandidateProfile): string {
  return [
    ...(profile.skills ?? []),
    ...(profile.interests ?? []),
    profile.bio ?? '',
  ].join(' ').toLowerCase();
}

function computeCandidateScore(
  candidate: CandidateProfile,
  targetAge: number | null,
  skillHints: string[],
  locationHints: string[],
  languageHint: string | null
): number {
  let score = 0;
  const locationBlob = candidate.locations.join(' ').toLowerCase();
  const skillBlob = buildSkillBlob(candidate);

  for (const hint of locationHints) {
    if (locationBlob.includes(hint)) {
      score += 30;
      break;
    }
  }

  for (const hint of skillHints) {
    if (hint === 'computer' && /(computer|arvuti|pc|laptop|it|dig)/i.test(skillBlob)) {
      score += 22;
      continue;
    }
    if (hint === 'coding' && /(coding|code|program|arend|software|javascript|typescript|python)/i.test(skillBlob)) {
      score += 20;
      continue;
    }
    if (hint === 'it-support' && /(wifi|printer|email|support|helpdesk|internet)/i.test(skillBlob)) {
      score += 15;
    }
  }

  if (languageHint) {
    const preferred = normalizeText(candidate.preferred_language ?? '');
    const spoken = (candidate.spoken_languages ?? []).map((l) => normalizeText(l));
    if (preferred.includes(languageHint)) {
      score += 24;
    } else if (spoken.some((l) => l.includes(languageHint))) {
      score += 16;
    }
  }

  if (targetAge && candidate.age) {
    const diff = Math.abs(candidate.age - targetAge);
    if (diff <= 3) score += 20;
    else if (diff <= 8) score += 10;
    else if (diff <= 15) score += 4;
  }

  if ((candidate.skills ?? []).length > 0) score += 2;
  if (candidate.locations.length > 0) score += 2;

  return score;
}

async function fetchCandidateProfiles(supabase: any, currentUserId: string): Promise<CandidateProfile[]> {
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, name, age, role, preferred_language, spoken_languages, skills, interests, bio')
    .neq('id', currentUserId)
    .limit(300);

  const { data: locationLinks } = await supabase
    .from('profile_locations')
    .select('profile_id, visibility, is_primary, locations(country, county, city, locality, normalized_name)')
    .eq('visibility', 'public')
    .limit(1000);

  const byProfile = new Map<string, string[]>();
  for (const row of locationLinks ?? []) {
    const loc = row?.locations;
    if (!loc) continue;
    const locText = [loc.locality, loc.city, loc.county, loc.country, loc.normalized_name]
      .filter(Boolean)
      .join(', ');
    if (!byProfile.has(row.profile_id)) byProfile.set(row.profile_id, []);
    byProfile.get(row.profile_id)?.push(locText);
  }

  return (profilesData ?? []).map((p: any) => ({
    id: p.id,
    name: p.name || 'Member',
    age: p.age ?? null,
    role: p.role ?? null,
    preferred_language: p.preferred_language ?? null,
    spoken_languages: p.spoken_languages ?? [],
    skills: p.skills ?? [],
    interests: p.interests ?? [],
    bio: p.bio ?? null,
    locations: byProfile.get(p.id) ?? [],
    score: 0,
  }));
}

async function createSupportQuest(
  supabase: any,
  userId: string,
  match: CandidateProfile,
  sourceMessage: string,
  skillHints: string[],
  locationHints: string[]
): Promise<{ id: string; title: string } | null> {
  const category = skillHints.includes('computer') || skillHints.includes('coding') || skillHints.includes('it-support')
    ? 'Technology'
    : 'Lifestyle';

  const title = `Connect Quest: ${skillHints.includes('computer') ? 'Computer Help' : 'Local Support'} with ${match.name}`;
  const description = `AI-created connection quest based on user request: "${sourceMessage}"\n\nSuggested match: ${match.name}.`;
  const steps = [
    `Reach out to ${match.name} in chat and confirm availability.`,
    `Agree on support goals and estimated time (30-60 min).`,
    `Complete support session and share short summary in comments.`,
  ];

  const basePayload: Record<string, unknown> = {
    title,
    description,
    category,
    reward_xp: 120,
    steps,
    created_by: userId,
  };

  const extendedPayload: Record<string, unknown> = {
    ...basePayload,
    quest_type: 'duo',
    is_virtual: true,
    location: locationHints[0] ?? null,
    skills_required: skillHints,
  };

  const insertAttempt = async (payload: Record<string, unknown>) =>
    await supabase.from('quests').insert(payload).select('id, title').single();

  let questRes = await insertAttempt(extendedPayload);
  if (questRes.error) {
    questRes = await insertAttempt(basePayload);
  }

  if (questRes.error || !questRes.data?.id) return null;

  const questId = questRes.data.id as string;

  await supabase.from('quest_members').insert({
    quest_id: questId,
    user_id: userId,
    role: 'creator',
    status: 'accepted',
  });

  await supabase.from('activity_feed').insert({
    user_id: userId,
    activity_type: 'achievement',
    title: 'AI created a support quest',
    description: `Quest created with suggested partner ${match.name}`,
    data: { quest_id: questId, suggested_partner_id: match.id },
  });

  return { id: questId, title: (questRes.data.title as string) || title };
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated (manual check since --no-verify-jwt)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, payload } = await req.json();

    if (action === 'chat') {
      const { contents, systemInstruction } = payload as {
        contents: ChatContent[];
        systemInstruction?: string;
      };

      const safeContents = Array.isArray(contents) ? contents : [];
      const latestMessage = extractLatestUserMessage(safeContents);
      const targetAge = extractTargetAge(latestMessage);
      const skillHints = extractSkillHints(latestMessage);
      const locationHints = extractLocationHints(latestMessage);
      const languageHint = extractLanguageHint(latestMessage);
      const wantsQuest = shouldCreateQuest(latestMessage);

      let ranked: CandidateProfile[] = [];
      try {
        const pool = await fetchCandidateProfiles(supabase, user.id);
        ranked = pool
          .map((candidate) => ({
            ...candidate,
            score: computeCandidateScore(candidate, targetAge, skillHints, locationHints, languageHint),
          }))
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
      } catch (matchError) {
        console.error('Candidate matching failed, falling back to base chat:', matchError);
        ranked = [];
      }

      let createdQuest: { id: string; title: string } | null = null;
      if (wantsQuest && ranked.length > 0) {
        try {
          createdQuest = await createSupportQuest(
            supabase,
            user.id,
            ranked[0],
            latestMessage,
            skillHints,
            locationHints
          );
        } catch (questError) {
          console.error('Quest auto-create failed, continuing without quest:', questError);
          createdQuest = null;
        }
      }

      const candidateContext = ranked.slice(0, 3).map((c) => ({
        id: c.id,
        name: c.name,
        age: c.age,
        role: c.role,
        preferred_language: c.preferred_language,
        spoken_languages: c.spoken_languages,
        skills: c.skills,
        interests: c.interests,
        locations: c.locations,
      }));

      const dynamicInstruction = `
You are Rootwise AI mentor. Use platform data first.
If candidateContext has people, reference them as available platform matches.
Do not claim missing people are available.
Always answer in the same language the user used.
If no direct match exists, suggest how to broaden search (age range, nearby location, skills).
If createdQuest exists, clearly mention that quest was created and include quest ID.

candidateContext: ${JSON.stringify(candidateContext)}
createdQuest: ${JSON.stringify(createdQuest)}
locationHints: ${JSON.stringify(locationHints)}
languageHint: ${JSON.stringify(languageHint)}
skillHints: ${JSON.stringify(skillHints)}
targetAge: ${JSON.stringify(targetAge)}
      `.trim();

      const body = {
        contents: safeContents,
        systemInstruction: {
          parts: [{
            text: [systemInstruction || '', dynamicInstruction].filter(Boolean).join('\n\n'),
          }],
        },
      };

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "I'm having trouble right now. Please try again.";

      return new Response(JSON.stringify({ text, matches: candidateContext, createdQuest }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generateQuest') {
      // Quest generation with structured output
      const { topic, userLevel } = payload;
      const body = {
        contents: [
          {
            parts: [
              {
                text: `Create a productive multi-generational 'Quest' for the topic: ${topic}. The quest should be achievable for a ${userLevel} user. Return JSON with: title, description (compelling), 3 actionable steps, and a category (one of: Technology, Environment, Finance, Arts, Lifestyle, Education, History).`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              description: { type: 'STRING' },
              steps: { type: 'ARRAY', items: { type: 'STRING' } },
              category: { type: 'STRING' },
            },
            required: ['title', 'description', 'steps', 'category'],
          },
        },
      };

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return new Response(JSON.stringify({ error: 'No response from AI' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ quest: JSON.parse(text) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generateImage') {
      // Image generation using gemini-3-pro-image-preview
      const { prompt } = payload;
      const body = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          mimeType: 'image/png',
        },
      };

      const res = await fetch(GEMINI_IMAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const imageData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      
      if (!imageData?.data) {
        return new Response(JSON.stringify({ error: 'Failed to generate image' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return base64 encoded image
      return new Response(JSON.stringify({ image: `data:image/png;base64,${imageData.data}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
