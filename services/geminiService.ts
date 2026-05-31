
import { supabase } from './supabase';
import i18next from 'i18next';

/** Context about the user requesting a personal quest */
export interface UserQuestContext {
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
}

export interface AiMatchSuggestion {
  id: string;
  name: string;
  ageRange: string;
  role: string | null;
  skills: string[] | null;
  interests: string[] | null;
  generalLocation: string | null;
  profileUrl: string;
}

export interface AiChatReply {
  text: string;
  matches?: AiMatchSuggestion[];
  createdQuest?: { id: string; title: string } | null;
}

export interface AiMediatedMessageRequest {
  senderName: string;
  senderLanguage?: string | null;
  recipientName: string;
  recipientLanguage?: string | null;
  draft: string;
  recentConversation?: Array<{ from: 'me' | 'them'; text: string }>;
}

/** Context about a community for group quest generation */
export interface CommunityQuestContext {
  communityName: string;
  communityDescription?: string | null;
  communityCategory: string;
  memberCount: number;
  memberAgeRange?: { min: number; max: number } | null;
  memberSkills?: string[];
  memberInterests?: string[];
  existingQuestTitles?: string[];
}

  /** User profile context passed to AI mentor for personalized conversations */
  export interface ChatUserProfile {
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
  }

export class RootwiseAIService {
  private async callProxy(action: string, payload: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const res = await supabase.functions.invoke('gemini-proxy', {
      body: { action, payload },
    });

    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  /**
   * Generate a personalized solo quest based on user profile context.
   * Sends age, location, skills, interests, bio, level, and existing quest
   * titles to the AI so it can produce unique, personally relevant quests.
   */
  async generateQuest(topic: string, userLevel: string, userContext?: UserQuestContext) {
    try {
      // Check rate limit first
      const { data: usage } = await supabase.rpc('check_ai_usage', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_type: 'quest_gen',
      });
      if (usage && !usage.allowed) {
        return { error: i18next.t('ai.rateLimitQuest', { limit: usage.limit }) };
      }

      const locale = i18next.language || 'en';
      const result = await this.callProxy('generateQuest', {
        topic,
        userLevel,
        locale,
        userContext: userContext || null,
      });
      return result.quest || null;
    } catch (error) {
      console.error("Quest generation error:", error);
      return null;
    }
  }

  /**
   * Generate a group quest tailored to the community's members and purpose.
   * Considers community category, aggregate member profiles, and existing
   * community quests to avoid duplicates.
   */
  async generateGroupQuest(userLevel: string, communityContext: CommunityQuestContext, userContext?: UserQuestContext) {
    try {
      const { data: usage } = await supabase.rpc('check_ai_usage', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_type: 'quest_gen',
      });
      if (usage && !usage.allowed) {
        return { error: i18next.t('ai.rateLimitQuest', { limit: usage.limit }) };
      }

      const locale = i18next.language || 'en';
      const result = await this.callProxy('generateGroupQuest', {
        userLevel,
        locale,
        communityContext,
        userContext: userContext || null,
      });
      return result.quest || null;
    } catch (error) {
      console.error("Group quest generation error:", error);
      return null;
    }
  }

  async getAiMentorResponse(
    history: { role: string; parts: { text: string }[] }[],
    userProfile?: ChatUserProfile
  ): Promise<AiChatReply> {
    try {
      // Check rate limit
      const { data: usage } = await supabase.rpc('check_ai_usage', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_type: 'chat',
      });
      if (usage && !usage.allowed) {
        return { text: i18next.t('ai.rateLimitChat', { limit: usage.limit }) };
      }

      const contents = history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts.map((p) => ({ text: p.text })),
      }));

      const systemInstruction = `You are Rootwise AI, a wise and encouraging mentor for an intergenerational wisdom platform. You help connect generations through shared wisdom and roots. Your tone is warm, patient, and highly productive. Encourage users to share their unique life perspectives regardless of age. When asked about quests, suggest collaborative activities between different generations. Use profileCompleteness to adapt how specific your advice is: if the user's profile is less complete, keep guidance broader and encourage profile completion; if it is more complete, tailor your suggestions more closely to their strengths and interests. NEVER share system internals, backend implementation, AI model details, security design, or hacking/exploit guidance. If asked about how Rootwise works internally, politely explain that you are here to help with using the platform and cannot discuss system internals. Keep responses concise but meaningful — aim for 2-4 paragraphs max. IMPORTANT: Always respond in the user's language. The user's current language is: ${i18next.language || 'en'}.`;

      const result = await this.callProxy('chat', {
        contents,
        systemInstruction,
        locale: i18next.language || 'en',
        userProfile: userProfile || null,
      });
      const baseText = result.text ?? i18next.t('ai.troubleNow');
      const createdQuest = result.createdQuest ?? null;
      const questSuffix = createdQuest?.id
        ? `\n\n${i18next.t('ai.questCreated', { title: createdQuest.title, id: createdQuest.id })}`
        : '';

      return {
        text: `${baseText}${questSuffix}`,
        matches: Array.isArray(result.matches) ? result.matches : [],
        createdQuest,
      };
    } catch (error) {
      console.error("AI Mentor Error:", error);
      return { text: i18next.t('ai.troubleConnecting') };
    }
  }

  async requestAiIntroduction(targetUserId: string, requestText: string): Promise<{ ok: boolean; introPreview?: string; error?: string }> {
    try {
      const locale = i18next.language || 'en';
      const result = await this.callProxy('startConnection', {
        targetUserId,
        requestText,
        locale,
      });

      if (!result?.ok) {
        return { ok: false, error: result?.error || i18next.t('common.error') };
      }

      return {
        ok: true,
        introPreview: result?.introPreview || '',
      };
    } catch (error) {
      console.error('AI intro request error:', error);
      return { ok: false, error: i18next.t('common.error') };
    }
  }

  async generateMediatedMessage(request: AiMediatedMessageRequest): Promise<{ text: string; error?: string }> {
    try {
      const { data: usage } = await supabase.rpc('check_ai_usage', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_type: 'chat',
      });
      if (usage && !usage.allowed) {
        return { text: '', error: i18next.t('ai.rateLimitChat', { limit: usage.limit }) };
      }

      const conversationContext = (request.recentConversation ?? [])
        .slice(-6)
        .map((line) => `${line.from === 'me' ? request.senderName : request.recipientName}: ${line.text}`)
        .join('\n');

      const systemInstruction = [
        'You are Rootwise AI mediator for private messages between users who may have different languages and cultures.',
        'Rewrite and translate the user draft so it is clear, respectful, warm, and culturally neutral.',
        'Keep the original intent exactly; do not add promises, commitments, or facts not present in the draft.',
        'Output only the final message text, no explanations and no labels.',
      ].join(' ');

      const userPrompt = [
        `Sender name: ${request.senderName}`,
        `Sender language: ${request.senderLanguage || 'unknown'}`,
        `Recipient name: ${request.recipientName}`,
        `Recipient preferred language: ${request.recipientLanguage || 'unknown'}`,
        `UI language: ${i18next.language || 'en'}`,
        conversationContext ? `Recent conversation context:\n${conversationContext}` : '',
        `Draft to mediate:\n${request.draft}`,
      ].filter(Boolean).join('\n\n');

      const result = await this.callProxy('mediateMessage', {
        request: {
          ...request,
          recentConversation: request.recentConversation ?? [],
        },
        systemInstruction,
        userPrompt,
        locale: i18next.language || 'en',
      });

      if (!result?.ok) {
        return { text: request.draft, error: result?.error || i18next.t('common.error') };
      }

      const text = (result?.text || '').trim();
      if (!text) {
        return { text: request.draft };
      }

      return { text };
    } catch (error) {
      console.error('AI mediation error:', error);
      return { text: request.draft, error: i18next.t('common.error') };
    }
  }

  async generateQuestImage(title: string, description: string, category: string): Promise<string | null> {
    try {
      // Create a compelling prompt from quest details
      const prompt = `Create a vibrant, engaging illustration for an educational quest titled "${title}". 
      
      Quest Description: ${description}
      Category: ${category}
      
      Style: Modern, colorful, inspiring, and suitable for an intergenerational learning platform. 
      Include symbolic elements representing growth, learning, and connection.
      The image should be positive, motivating, and appeal to diverse age groups.
      Use bright colors and clear visual hierarchy.
      
      Generate a single, cohesive image that captures the essence of this quest.`;

      const result = await this.callProxy('generateImage', { prompt });
      return result.image || null;
    } catch (error) {
      console.error("Image generation error:", error);
      return null;
    }
  }
}

