
import { GoogleGenAI, Type } from "@google/genai";

export class RootwiseAIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateQuest(topic: string, userLevel: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Create a productive multi-generational 'Quest' for the topic: ${topic}. 
        The quest should be achievable for a ${userLevel} user. 
        Return JSON with: title, description (compelling), 3 actionable steps, and a category (one of: Technology, Environment, Finance, Arts, Lifestyle, Education, History).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              category: { type: Type.STRING }
            },
            required: ["title", "description", "steps", "category"]
          }
        }
      });
      const text = response.text;
      if (!text) return null;
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  }

  async getAiMentorResponse(history: { role: string; parts: { text: string }[] }[]): Promise<string> {
    try {
      // Build proper multi-turn contents array
      const contents = history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts.map((p) => ({ text: p.text })),
      }));

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
        config: {
          systemInstruction: "You are Rootwise AI, a wise and encouraging mentor for an intergenerational wisdom platform. You help connect generations through shared wisdom and roots. Your tone is warm, patient, and highly productive. Encourage users to share their unique life perspectives regardless of age. When asked about quests, suggest collaborative activities between different generations. Keep responses concise but meaningful — aim for 2-4 paragraphs max."
        }
      });
      return response.text ?? "I'm having a little trouble right now. Please try again.";
    } catch (error) {
      console.error("AI Mentor Error:", error);
      return "I'm having a little trouble connecting right now, but I'm still here to support your growth journey. Please try again in a moment.";
    }
  }

  async generateQuestImage(_prompt: string): Promise<string | null> {
    // Image generation requires a dedicated image model (e.g., Imagen)
    // gemini-2.0-flash is text-only and cannot generate images
    return null;
  }
}
