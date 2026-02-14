
import { supabase } from './supabase';

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
        return { error: `Daily quest generation limit reached (${usage.limit}/day). Upgrade to Pro for unlimited.` };
      }

      const result = await this.callProxy('generateQuest', { topic, userLevel });
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
        return `You've reached your daily AI chat limit (${usage.limit} messages/day). Upgrade to Pro for unlimited AI mentoring!`;
      }

      const contents = history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts.map((p) => ({ text: p.text })),
      }));

      const systemInstruction = "You are Rootwise AI, a wise and encouraging mentor for an intergenerational wisdom platform. You help connect generations through shared wisdom and roots. Your tone is warm, patient, and highly productive. Encourage users to share their unique life perspectives regardless of age. When asked about quests, suggest collaborative activities between different generations. Keep responses concise but meaningful — aim for 2-4 paragraphs max.";

      const result = await this.callProxy('chat', { contents, systemInstruction });
      return result.text ?? "I'm having a little trouble right now. Please try again.";
    } catch (error) {
      console.error("AI Mentor Error:", error);
      return "I'm having a little trouble connecting right now. Please try again in a moment.";
    }
  }

  async generateQuestImage(_prompt: string): Promise<string | null> {
    // Image generation requires a dedicated image model
    return null;
  }
}

