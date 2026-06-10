// Gemini Proxy — keeps API key server-side
// Deploy: supabase functions deploy gemini-proxy --no-verify-jwt
// Env vars needed: GEMINI_API_KEY

import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-exp';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

function buildMissingServerEnvResponse(headers: Record<string, string>) {
  const missingVars = [
    { key: 'GEMINI_API_KEY', value: GEMINI_API_KEY },
    { key: 'SUPABASE_URL', value: Deno.env.get('SUPABASE_URL') ?? '' },
    { key: 'SUPABASE_ANON_KEY', value: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  ]
    .filter((entry) => !entry.value)
    .map((entry) => entry.key);

  if (missingVars.length === 0) {
    return null;
  }

  return new Response(
    JSON.stringify({
      error: `Missing required server environment variable(s): ${missingVars.join(', ')}`,
    }),
    {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    }
  );
}

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

function detectResponseLanguageCode(message: string, locale?: string | null): string {
  const normalized = normalizeText(message || '');
  const estonianSignals = /\b(tere|aitah|aitäh|palun|kuidas|miks|kui|palju|kasutajaid|meil|juba|eestist|on|ja|et|sa|sina)\b/i;
  if (estonianSignals.test(normalized)) return 'et';

  const fromLocale = (locale || 'en').toLowerCase();
  return fromLocale || 'en';
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

async function getUserPlan(supabase: any, userId: string): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    return (profile?.plan || 'free').toLowerCase();
  } catch {
    return 'free';
  }
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
  // Only fetch profiles that have skills listed — these are the useful candidates for matching.
  // Limit to 100 (down from 300) to reduce DB load per chat message.
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, name, age, role, preferred_language, spoken_languages, skills, interests, bio')
    .neq('id', currentUserId)
    .not('skills', 'is', null)
    .limit(100);

  if (!profilesData || profilesData.length === 0) return [];

  // Only fetch location links for the profiles we actually got
  const profileIds = profilesData.map((p: any) => p.id);
  const { data: locationLinks } = await supabase
    .from('profile_locations')
    .select('profile_id, visibility, is_primary, locations(country, county, city, locality, normalized_name)')
    .eq('visibility', 'public')
    .in('profile_id', profileIds)
    .limit(300);

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
  // Per-request CORS headers — restricts to allowed origins
  const corsHeaders = getCorsHeaders(req);

  const missingEnvResponse = buildMissingServerEnvResponse(corsHeaders);
  if (missingEnvResponse) {
    return missingEnvResponse;
  }

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

    const token = authHeader
      .split(',')[0]
      .trim()
      .replace(/^Bearer\s+/i, '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
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
      // ── Server-side rate limit check (prevents API bypass) ──
      const { data: chatUsage } = await supabase.rpc('check_ai_usage', {
        p_user_id: user.id,
        p_type: 'chat',
      });
      if (chatUsage && !chatUsage.allowed) {
        return new Response(JSON.stringify({ error: `Daily message limit reached (${chatUsage.limit}/day). Upgrade to Pro for unlimited messages.` }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { contents, systemInstruction, userProfile, locale } = payload as {
        contents: ChatContent[];
        systemInstruction?: string;
        locale?: string;
        userProfile?: {
          name: string;
          age?: number | null;
          role?: string;
          skills?: string[];
          interests?: string[];
          bio?: string | null;
          location?: string | null;
          spokenLanguages?: string[];
          level?: number;
          xp?: number;
          plan?: string;
          memberSince?: string;
          completedQuestCount?: number;
          communityNames?: string[];
          profileCompleteness?: number;
        } | null;
      };

      const safeContents = Array.isArray(contents) ? contents : [];
      const latestMessage = extractLatestUserMessage(safeContents);
      const targetAge = extractTargetAge(latestMessage);
      const skillHints = extractSkillHints(latestMessage);
      const locationHints = extractLocationHints(latestMessage);
      const languageHint = extractLanguageHint(latestMessage);
      const wantsQuest = shouldCreateQuest(latestMessage);

      // ── 1. Load user's AI memory (persistent facts across sessions) ──
      let memory: Record<string, string> = {};
      try {
        const { data: memRow } = await supabase
          .from('user_ai_memory')
          .select('facts')
          .eq('user_id', user.id)
          .single();
        if (memRow?.facts) memory = memRow.facts;
      } catch { /* no memory yet */ }

      // ── 2. Fetch platform data for recommendations ──
      let availableQuests: { id: string; title: string; category: string; quest_type: string }[] = [];
      let suggestedCommunities: { id: string; name: string; category: string; member_count: number }[] = [];
      try {
        // Quests the user hasn't joined yet (published, not full)
        const { data: qData } = await supabase
          .from('quests')
          .select('id, title, category, quest_type')
          .eq('status', 'published')
          .neq('created_by', user.id)
          .limit(15);
        if (qData) availableQuests = qData;
      } catch { /* ok */ }

      try {
        // Communities the user is NOT in
        const { data: memberOf } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', user.id);
        const joinedIds = (memberOf ?? []).map((m: any) => m.community_id);

        const _query = supabase
          .from('community_with_member_count')
          .select('id, name, category, member_count')
          .limit(10);
        if (joinedIds.length > 0) {
          // Supabase doesn't have a direct "not in" for arrays, filter client-side
const { data: cData } = await _query;
           if (cData) {
             suggestedCommunities = cData.filter((c: any) => !joinedIds.includes(c.id));
           }
         } else {
           const { data: cData } = await _query;
          if (cData) suggestedCommunities = cData;
        }
      } catch { /* ok */ }

      // ── 3. Smart candidate matching (with privacy protection) ──
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

      // ── 4. Privacy-safe candidate profiles (strip sensitive data) ──
      const privacySafeCandidates = ranked.slice(0, 3).map((c) => ({
        id: c.id,
        name: c.name,
        ageRange: c.age ? (c.age < 25 ? '18-25' : c.age < 40 ? '25-40' : c.age < 60 ? '40-60' : '60+') : 'unknown',
        role: c.role,
        skills: c.skills,
        interests: c.interests,
        bio: c.bio,
        preferredLanguage: c.preferred_language,
        spokenLanguages: c.spoken_languages,
        generalLocation: c.locations.length > 0 ? c.locations[0].split(',').slice(-2).join(',').trim() : null,
        profileUrl: `/users/${c.id}`,
      }));
      const allowedCandidateNames = privacySafeCandidates.map((candidate) => candidate.name);

      // Keep full context for response metadata (but AI only sees privacy-safe version)
const _candidateContext = ranked.slice(0, 3).map((c) => ({
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

      // ── 5. Build the comprehensive system instruction ──
      const userProfileBlock = userProfile
        ? `
── CURRENT USER (you are mentoring this person) ──
Name: ${userProfile.name}
${userProfile.age ? `Age: ${userProfile.age}` : ''}
Role: ${userProfile.role || 'Seeker'} (Sage = experienced mentor, Seeker = eager learner, Hybrid = both)
${userProfile.skills?.length ? `Skills: ${userProfile.skills.join(', ')}` : ''}
${userProfile.interests?.length ? `Interests: ${userProfile.interests.join(', ')}` : ''}
${userProfile.bio ? `Bio: "${userProfile.bio}"` : ''}
${userProfile.location ? `Location: ${userProfile.location}` : ''}
${userProfile.spokenLanguages?.length ? `Languages: ${userProfile.spokenLanguages.join(', ')}` : ''}
Platform level: ${userProfile.level ?? 1} (XP: ${userProfile.xp ?? 0})
Plan: ${userProfile.plan || 'free'}
${userProfile.profileCompleteness != null ? `Profile completeness: ${userProfile.profileCompleteness}%` : ''}
${userProfile.memberSince ? `Member since: ${userProfile.memberSince}` : ''}
${userProfile.completedQuestCount ? `Completed quests: ${userProfile.completedQuestCount}` : ''}
${userProfile.communityNames?.length ? `Communities: ${userProfile.communityNames.join(', ')}` : ''}
── END USER PROFILE ──
`.trim()
        : '';

      const memoryBlock = Object.keys(memory).length > 0
        ? `
── MEMORY (facts you learned about this user in past conversations — use naturally) ──
${Object.entries(memory).map(([k, v]) => `• ${k}: ${v}`).join('\n')}
── END MEMORY ──
`.trim()
        : '';

      const platformBlock = `
── PLATFORM DATA (use to make specific recommendations) ──
${availableQuests.length > 0
  ? `Available quests to recommend:\n${availableQuests.slice(0, 8).map((q) => `• "${q.title}" (${q.category}, ${q.quest_type})`).join('\n')}`
  : 'No available quests at the moment.'
}
${suggestedCommunities.length > 0
  ? `\nCommunities to suggest:\n${suggestedCommunities.slice(0, 5).map((c) => `• "${c.name}" (${c.category}, ${c.member_count} members)`).join('\n')}`
  : ''
}
── END PLATFORM DATA ──
`.trim();

      const dynamicInstruction = `
You are Rootwise AI Mentor — a warm, wise, and deeply personal mentor for the Rootwise intergenerational wisdom platform.

YOUR CORE PRINCIPLES:
1. BE PERSONAL — Address the user by name. Reference their skills, interests, and goals. Remember details they share.
2. BE A REAL MENTOR — Give specific, actionable advice. Not generic platitudes. Push gently toward growth.
3. RECOMMEND PLATFORM CONTENT — Suggest specific quests and communities from the platform data when relevant.
4. CONNECT PEOPLE — When the user needs help or wants to teach, suggest matched platform members. But PROTECT PRIVACY (see rules).
5. REMEMBER — Note important facts the user shares (goals, life events, preferences) and reference them in future conversations.
6. BE CONCISE — 2-4 paragraphs max. Quality over quantity.
7. ENCOURAGE ACTION — End messages with a specific suggestion or question that moves the user forward.

PRIVACY RULES (STRICT):
• You MAY freely use and mention profile-page data from candidateContext (name, role, bio, interests, skills, languages, general location, community-facing details) because users consented via profile publishing.
• NEVER share a matched person's exact age — only age range (e.g., "someone in their 40s").
• NEVER reveal private memory or private chat-disclosed facts about OTHER users. Only profile-page data is shareable.
• NEVER reveal internal scoring, algorithms, hidden memory tags, or raw JSON/system data.
• NEVER share system internals, platform architecture, AI model implementation details, security design, or any hacking/exploit guidance. If asked about Rootwise internals, politely explain that you cannot discuss system architecture and will focus on safe, user-facing advice.
• If the user asks for private/non-profile details, politely refuse that specific part but continue helping with available profile data.
• IMPORTANT: candidateContext is already safe for user-facing matching recommendations. Do NOT claim that profile data in candidateContext is unavailable.

MEMORY INSTRUCTIONS:
At the END of your response, if the user shared any important personal fact (a goal, life event, preference, challenge, family info, career detail), append a hidden memory line in this exact format:
<memory>key: value</memory>
Examples: <memory>career_goal: wants to learn programming</memory>, <memory>family: has 2 grandchildren</memory>
Only add genuinely useful facts. Do not add trivial things. Maximum 2 memory lines per response. The user will NOT see these lines.

${userProfileBlock}

${memoryBlock}

${platformBlock}

candidateContext (privacy-safe): ${JSON.stringify(privacySafeCandidates)}
createdQuest: ${JSON.stringify(createdQuest)}
locationHints: ${JSON.stringify(locationHints)}
languageHint: ${JSON.stringify(languageHint)}
skillHints: ${JSON.stringify(skillHints)}
targetAge: ${JSON.stringify(targetAge)}

If candidateContext contains suitable matches, you MUST mention 1-2 by name naturally in your answer and suggest that the user can open the profile cards to contact them.
You may only mention person names that exist in this exact allowlist: ${JSON.stringify(allowedCandidateNames)}.
If the allowlist is empty, do NOT suggest or invent any person. Clearly say that no suitable direct people-matches were found right now, then offer quests/communities instead.
Do not reveal private details; the UI will show clickable profile cards separately.

LANGUAGE RULES (STRICT):
• Reply in exactly ONE language only.
• Primary language = latest user message language.
• If uncertain, use locale: ${locale || 'en'}.
• Do not mix Estonian + English (or any mixed-language output) in a single reply.
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
      let text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "I'm having trouble right now. Please try again.";

      // If the model returned a generic/privacy-only refusal despite available matches,
      // append a concise, localized nudge to use the visible match cards.
      if (privacySafeCandidates.length > 0) {
        const hasNameMention = privacySafeCandidates.some((candidate) => text.includes(candidate.name));
        if (!hasNameMention) {
          const candidateList = privacySafeCandidates
            .slice(0, 2)
            .map((candidate) => candidate.name)
            .join(', ');
          const lang = detectResponseLanguageCode(latestMessage, locale || userProfile?.spokenLanguages?.[0] || 'en');
          const isEstonian = lang.startsWith('et');
          text = `${text}\n\n${isEstonian
            ? `Leidsin sulle sobivad kontaktid: ${candidateList}. Ava profiilikaardid allpool ja soovi korral saan AI-ga kohe tutvustuse algatada.`
            : `I found relevant contacts for you: ${candidateList}. Open the profile cards below, and I can start an AI-assisted introduction right away.`}`;
        }
      }

      // ── 6. Extract and persist memory facts from AI response ──
      const memoryRegex = /<memory>(.+?):\s*(.+?)<\/memory>/g;
      let memMatch;
      const newFacts: Record<string, string> = {};
      while ((memMatch = memoryRegex.exec(text)) !== null) {
        newFacts[memMatch[1].trim()] = memMatch[2].trim();
      }
      // Strip memory tags from visible response
      text = text.replace(/<memory>.+?<\/memory>/g, '').trim();

      // Persist new memory facts
      if (Object.keys(newFacts).length > 0) {
        const merged = { ...memory, ...newFacts };
        // Keep max 30 facts
        const keys = Object.keys(merged);
        if (keys.length > 30) {
          const toRemove = keys.slice(0, keys.length - 30);
          for (const k of toRemove) delete merged[k];
        }
        try {
          await supabase
            .from('user_ai_memory')
            .upsert({
              user_id: user.id,
              facts: merged,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        } catch (memError) {
          console.error('Failed to persist AI memory:', memError);
        }
      }

      return new Response(JSON.stringify({ text, matches: privacySafeCandidates, createdQuest }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'startConnection') {
      const { targetUserId, requestText, locale } = payload as {
        targetUserId: string;
        requestText?: string;
        locale?: string;
      };

      if (!targetUserId || targetUserId === user.id) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid target user' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('name, role, preferred_language')
        .eq('id', user.id)
        .single();

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, name, preferred_language')
        .eq('id', targetUserId)
        .single();

      if (!targetProfile?.id) {
        return new Response(JSON.stringify({ ok: false, error: 'Target not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requesterName = requesterProfile?.name || 'A Rootwise member';
      const requesterRole = requesterProfile?.role || 'Member';
      const trimmedTopic = (requestText || '').trim().slice(0, 160);

      const existing = await supabase
        .from('connections')
        .select('id')
        .or(`and(user_id.eq.${user.id},partner_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},partner_id.eq.${user.id})`)
        .in('status', ['scheduled'])
        .limit(1)
        .maybeSingle();

      if (!existing.data?.id) {
        await supabase.from('connections').insert({
          user_id: user.id,
          partner_id: targetUserId,
          topic: trimmedTopic || 'AI-assisted introduction',
          scheduled_at: null,
          status: 'scheduled',
        });
      }

      const sourceLocale = (locale || requesterProfile?.preferred_language || 'en').toLowerCase();
      const isEstonian = sourceLocale.startsWith('et');

      const introPreview = isEstonian
        ? `AI alustas sinu nimel kontakti kasutajaga ${targetProfile.name}. Soovituslik avasõnum: "Tere ${targetProfile.name}! Mina olen ${requesterName}. Otsin abi teemal: ${trimmedTopic || 'arvutiga seotud küsimus'}. Kas oleksid avatud lühikeseks vestluseks Rootwise'is?"`
        : `AI started contact on your behalf with ${targetProfile.name}. Suggested opener: "Hi ${targetProfile.name}! I'm ${requesterName}. I'm looking for help with: ${trimmedTopic || 'a computer-related topic'}. Would you be open to a short chat on Rootwise?"`;

      const targetTitle = isEstonian
        ? 'Uus AI-vahendatud ühenduse soov'
        : 'New AI-assisted connection request';

      const targetBody = isEstonian
        ? `${requesterName} (${requesterRole}) soovib sinuga ühendust võtta. Teema: ${trimmedTopic || 'arvutiabi / teadmiste jagamine'}.`
        : `${requesterName} (${requesterRole}) would like to connect with you. Topic: ${trimmedTopic || 'computer help / knowledge sharing'}.`;

      const targetPreferredLocale = (targetProfile?.preferred_language || '').toLowerCase();
      let localizedTargetBody = targetBody;

      if (targetPreferredLocale && targetPreferredLocale !== sourceLocale) {
        try {
          const translateRes = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{
                  text: `Translate this short notification to language code "${targetPreferredLocale}". Keep names and product name Rootwise unchanged. Return plain text only.\n\n${targetBody}`,
                }],
              }],
            }),
          });
          const translateData = await translateRes.json();
          const translated = translateData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (translated) localizedTargetBody = translated;
        } catch (translateError) {
          console.error('Failed to auto-translate intro notification:', translateError);
        }
      }

      await supabase.from('notifications').insert([
        {
          user_id: targetUserId,
          type: 'ai_intro_request',
          title: targetTitle,
          body: localizedTargetBody,
          link: `/users/${user.id}`,
        },
        {
          user_id: user.id,
          type: 'ai_intro_sent',
          title: isEstonian ? 'AI saatis ühenduse algatuse' : 'AI sent your intro request',
          body: isEstonian
            ? `Saatsime ühenduse algatuse kasutajale ${targetProfile.name}.`
            : `We sent an intro request to ${targetProfile.name}.`,
          link: `/users/${targetUserId}`,
        },
      ]);

      return new Response(JSON.stringify({ ok: true, introPreview }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'mediateMessage') {
      const { request, systemInstruction, userPrompt, locale } = payload as {
        request?: {
          senderName?: string;
          senderLanguage?: string | null;
          recipientName?: string;
          recipientLanguage?: string | null;
          draft?: string;
          recentConversation?: Array<{ from: 'me' | 'them'; text: string }>;
        };
        systemInstruction?: string;
        userPrompt?: string;
        locale?: string;
      };

      const userPlan = await getUserPlan(supabase, user.id);
      const isPaidTier = userPlan === 'pro' || userPlan === 'org' || userPlan === 'admin';
      if (!isPaidTier) {
        return new Response(JSON.stringify({ ok: false, error: 'AI auto-translate is available on Pro, Org, and Admin plans.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: chatUsage } = await supabase.rpc('check_ai_usage', {
        p_user_id: user.id,
        p_type: 'chat',
      });
      if (chatUsage && !chatUsage.allowed) {
        return new Response(JSON.stringify({ ok: false, error: `Daily message limit reached (${chatUsage.limit}/day).` }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const draft = (request?.draft || '').trim();
      if (!draft) {
        return new Response(JSON.stringify({ ok: false, error: 'Draft is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mediatedSystemInstruction = systemInstruction ||
        'You are Rootwise AI mediator for private messages between users who may have different languages and cultures. Rewrite and translate clearly while preserving intent. Return only final message text.';

      const mediatedPrompt = userPrompt || `Sender: ${request?.senderName || 'User'}\nRecipient: ${request?.recipientName || 'User'}\nDraft:\n${draft}`;

      const geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${mediatedSystemInstruction}\nLanguage locale: ${locale || 'en'}` }],
          },
          contents: [{ role: 'user', parts: [{ text: mediatedPrompt }] }],
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('Gemini mediateMessage error:', errText);
        return new Response(JSON.stringify({ ok: false, error: 'Mediation failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const geminiData = await geminiRes.json();
      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      return new Response(JSON.stringify({ ok: true, text: text || draft }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generateQuest') {
      // ── Personalized Solo Quest Generation ──
      const { topic, userLevel, locale, userContext } = payload as {
        topic: string;
        userLevel: string;
        locale?: string;
        userContext?: {
          age?: number | null;
          role?: string;
          skills?: string[];
          interests?: string[];
          bio?: string | null;
          location?: string | null;
          spokenLanguages?: string[];
          existingQuestTitles?: string[];
          level?: number;
          xp?: number;
        } | null;
      };

      const langInstruction = locale && locale !== 'en'
        ? `IMPORTANT: Generate ALL text (title, description, steps) in the language with code "${locale}". Do NOT use English.`
        : '';

      // Build personalization context
      const personalization: string[] = [];
      if (userContext) {
        if (userContext.age) personalization.push(`User age: ${userContext.age}. Tailor complexity and references to be age-appropriate.`);
        if (userContext.role) personalization.push(`User archetype: ${userContext.role} (Sage = experienced mentor, Seeker = eager learner, Hybrid = both).`);
        if (userContext.skills?.length) personalization.push(`User's skills/expertise: ${userContext.skills.join(', ')}. Build on these strengths or create cross-skill challenges.`);
        if (userContext.interests?.length) personalization.push(`User's interests: ${userContext.interests.join(', ')}. Weave these into the quest theme.`);
        if (userContext.bio) personalization.push(`User bio: "${userContext.bio}". Use personality clues for tone and theme.`);
        if (userContext.location) personalization.push(`User location: ${userContext.location}. When possible, suggest local activities, landmarks, or nature spots.`);
        if (userContext.spokenLanguages?.length) personalization.push(`User speaks: ${userContext.spokenLanguages.join(', ')}.`);
        if (userContext.level) personalization.push(`User platform level: ${userContext.level} (XP: ${userContext.xp ?? 0}). Higher-level users should get more ambitious quests.`);
        if (userContext.existingQuestTitles?.length) {
          personalization.push(`User's existing quests (DO NOT repeat similar themes): ${userContext.existingQuestTitles.slice(0, 15).join(' | ')}`);
        }
      }

      const personalBlock = personalization.length > 0
        ? `\n\n── USER PROFILE (use this to personalize) ──\n${personalization.join('\n')}\n── END PROFILE ──\n`
        : '';

      const promptText = `You are Rootwise Quest Generator — an AI that creates meaningful, action-oriented quests for an intergenerational wisdom-sharing platform.

QUEST DESIGN PRINCIPLES:
1. Quests must ENCOURAGE REAL ACTION — going outside, meeting people, creating something, learning a new skill, teaching someone.
2. Quests should be ACHIEVABLE within 1-7 days, with clear measurable steps.
3. Prefer INTERGENERATIONAL connection — activities that naturally bring different age groups together.
4. Each quest should feel like a MINI-ADVENTURE — exciting, slightly challenging, growth-oriented.
5. NEVER create passive quests (e.g., "read an article"). Always include doing, creating, or connecting.
6. Steps should be SPECIFIC and CONCRETE, not vague ("Interview 2 neighbors about their childhood games" not "Talk to people").
7. Vary quest types: exploration, creation, teaching, learning, community service, nature, culture, technology.
${personalBlock}
Create a productive quest for the topic: ${topic}.
The quest should be achievable for a ${userLevel} user.
${langInstruction}

Return JSON with: title (catchy, action-oriented), description (compelling 2-3 sentences that inspire action), exactly 3 actionable steps (specific and measurable), and a category (one of: Technology, Environment, Finance, Arts, Lifestyle, Education, History).`;

      const body = {
        contents: [{ parts: [{ text: promptText }] }],
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

    // ── Personalized Group/Community Quest Generation ──
    if (action === 'generateGroupQuest') {
      const { userLevel, locale, communityContext, userContext } = payload as {
        userLevel: string;
        locale?: string;
        communityContext: {
          communityName: string;
          communityDescription?: string | null;
          communityCategory: string;
          memberCount: number;
          memberAgeRange?: { min: number; max: number } | null;
          memberSkills?: string[];
          memberInterests?: string[];
          existingQuestTitles?: string[];
        };
        userContext?: {
          age?: number | null;
          role?: string;
          location?: string | null;
        } | null;
      };

      const langInstruction = locale && locale !== 'en'
        ? `IMPORTANT: Generate ALL text (title, description, steps) in the language with code "${locale}". Do NOT use English.`
        : '';

      // Build community context block
      const communityLines: string[] = [];
      communityLines.push(`Community name: "${communityContext.communityName}"`);
      communityLines.push(`Category: ${communityContext.communityCategory}`);
      if (communityContext.communityDescription) communityLines.push(`Description: "${communityContext.communityDescription}"`);
      communityLines.push(`Member count: ${communityContext.memberCount}`);
      if (communityContext.memberAgeRange) {
        communityLines.push(`Member age range: ${communityContext.memberAgeRange.min}–${communityContext.memberAgeRange.max} years old. Design the quest so ALL ages can participate meaningfully.`);
      }
      if (communityContext.memberSkills?.length) {
        communityLines.push(`Collective skills in group: ${communityContext.memberSkills.join(', ')}. Leverage these for collaborative tasks.`);
      }
      if (communityContext.memberInterests?.length) {
        communityLines.push(`Common interests: ${communityContext.memberInterests.join(', ')}. Align the quest with shared passions.`);
      }
      if (communityContext.existingQuestTitles?.length) {
        communityLines.push(`Existing community quests (DO NOT repeat similar themes): ${communityContext.existingQuestTitles.slice(0, 10).join(' | ')}`);
      }

      const creatorLine = userContext?.location
        ? `Quest creator location: ${userContext.location}. Prefer activities possible in this area.`
        : '';

      const groupPrompt = `You are Rootwise Quest Generator — creating collaborative group quests for an intergenerational wisdom-sharing community.

GROUP QUEST DESIGN PRINCIPLES:
1. Quests must require TEAMWORK — tasks that are better done together, not independently.
2. Design for DIVERSE age groups — ensure younger AND older members can contribute unique value.
3. Include ROLE DISTRIBUTION — different steps should suit different skill levels and abilities.
4. Quests should create SHARED EXPERIENCES — building, exploring, teaching each other, creating together.
5. SCALE to group size — ${communityContext.memberCount} members. If large group, include sub-team tasks.
6. Steps should be COLLABORATIVE and SPECIFIC (e.g., "Pair up: one person teaches, the other documents with photos").
7. Create a sense of SHARED ACHIEVEMENT — the result should be something the whole group can be proud of.

── COMMUNITY PROFILE ──
${communityLines.join('\n')}
${creatorLine}
── END COMMUNITY PROFILE ──

Create a collaborative team quest for this community.
The quest should be achievable for a ${userLevel}-led group.
${langInstruction}

Return JSON with: title (catchy, team-oriented), description (compelling 2-3 sentences that inspire group action), exactly 3-4 actionable collaborative steps (with clear roles), and a category (one of: Technology, Environment, Finance, Arts, Lifestyle, Education, History).`;

      const body = {
        contents: [{ parts: [{ text: groupPrompt }] }],
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
      // Image generation using Gemini with responseModalities
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
          responseModalities: ['IMAGE', 'TEXT'],
        },
      };

      const res = await fetch(GEMINI_IMAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      // Find the image part in the response
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
      
      if (!imagePart?.inlineData?.data) {
        console.error('Image generation response:', JSON.stringify(data).slice(0, 500));
        return new Response(JSON.stringify({ error: 'Failed to generate image' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      // Return base64 encoded image
      return new Response(JSON.stringify({ image: `data:${mimeType};base64,${imagePart.inlineData.data}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── translateQuest ─────────────────────────────────────────────
    if (action === 'translateQuest') {
      const { questId, targetLocale } = payload as {
        questId: string;
        targetLocale: string;
      };

      if (!questId || !targetLocale) {
        return new Response(JSON.stringify({ error: 'questId and targetLocale required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Check cache first
      const { data: cached } = await supabase
        .from('quest_translations')
        .select('title, description, steps')
        .eq('quest_id', questId)
        .eq('locale', targetLocale)
        .maybeSingle();

      if (cached) {
        return new Response(JSON.stringify({ translation: cached, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Fetch original quest
      const { data: quest, error: questErr } = await supabase
        .from('quests')
        .select('title, description, steps')
        .eq('id', questId)
        .single();

      if (questErr || !quest) {
        return new Response(JSON.stringify({ error: 'Quest not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Build translation prompt
      const LOCALE_NAMES: Record<string, string> = {
        en: 'English', et: 'Estonian', de: 'German', es: 'Spanish', fi: 'Finnish',
        fr: 'French', it: 'Italian', lt: 'Lithuanian', lv: 'Latvian', nl: 'Dutch',
        pl: 'Polish', pt: 'Portuguese', ru: 'Russian', sv: 'Swedish', uk: 'Ukrainian',
      };
      const langName = LOCALE_NAMES[targetLocale] || targetLocale;

      const sourceJson = JSON.stringify({
        title: quest.title,
        description: quest.description || '',
        steps: quest.steps || [],
      });

      const translatePrompt = `You are a professional translator for an intergenerational learning platform called Rootwise.
Translate the following quest content into ${langName} (locale code: ${targetLocale}).

Rules:
- Keep the same JSON structure
- Preserve proper nouns, brand names (Rootwise, etc.), and technical terms
- Use clear, age-appropriate language suitable for ages 11-100
- Translate naturally, not word-for-word
- Return ONLY valid JSON, no markdown, no explanation

Source JSON:
${sourceJson}`;

      const geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: translatePrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                description: { type: 'STRING' },
                steps: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['title', 'description', 'steps'],
            },
          },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('Gemini translate error:', errText);
        return new Response(JSON.stringify({ error: 'Translation failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

      let translation: { title: string; description: string; steps: string[] };
      try {
        translation = JSON.parse(rawText);
      } catch {
        console.error('Failed to parse translation JSON:', rawText);
        return new Response(JSON.stringify({ error: 'Translation parse failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 4. Cache the translation
      await supabase.from('quest_translations').upsert({
        quest_id: questId,
        locale: targetLocale,
        title: translation.title,
        description: translation.description,
        steps: translation.steps,
      }, { onConflict: 'quest_id,locale' });

      return new Response(JSON.stringify({ translation, cached: false }), {
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
