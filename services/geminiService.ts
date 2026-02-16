
import { supabase } from './supabase';
import i18next from 'i18next';

export class RootwiseAIService {
  private async callProxy(action: string, payload: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const res = await supabase.functions.invoke('gemini-proxy', {
      body: { action, payload },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async generateQuest(topic: string, userLevel: string) {
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
      const result = await this.callProxy('generateQuest', { topic, userLevel, locale });
      return result.quest || null;
    } catch (error) {
      console.error("Quest generation error:", error);
      return null;
    }
  }

  async getAiMentorResponse(history: { role: string; parts: { text: string }[] }[]): Promise<string> {
    try {
      // Check rate limit
      const { data: usage } = await supabase.rpc('check_ai_usage', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_type: 'chat',
      });
      if (usage && !usage.allowed) {
        return i18next.t('ai.rateLimitChat', { limit: usage.limit });
      }

      const contents = history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts.map((p) => ({ text: p.text })),
      }));

      const systemInstruction = `You are Rootwise AI, a wise and encouraging mentor for an intergenerational wisdom platform. You help connect generations through shared wisdom and roots. Your tone is warm, patient, and highly productive. Encourage users to share their unique life perspectives regardless of age. When asked about quests, suggest collaborative activities between different generations. Keep responses concise but meaningful — aim for 2-4 paragraphs max. IMPORTANT: Always respond in the user's language. The user's current language is: ${i18next.language || 'en'}.`;

      const result = await this.callProxy('chat', { contents, systemInstruction, locale: i18next.language || 'en' });
      const baseText = result.text ?? i18next.t('ai.troubleNow');

      if (result.createdQuest?.id) {
        return `${baseText}\n\n${i18next.t('ai.questCreated', { title: result.createdQuest.title, id: result.createdQuest.id })}`;
      }

      return baseText;
    } catch (error) {
      console.error("AI Mentor Error:", error);
      return i18next.t('ai.troubleConnecting');
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

