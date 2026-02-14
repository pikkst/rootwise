
import { GoogleGenAI, Type } from "@google/genai";

export class RootwiseAIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateQuest(topic: string, userLevel: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a productive multi-generational 'Quest' for the topic: ${topic}. 
        The quest should be achievable for a ${userLevel} user. 
        Return JSON with: title, description (compelling), 3 actionable steps, and a category.`,
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
      return JSON.parse(response.text);
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  }

  async getAiMentorResponse(history: { role: string, parts: { text: string }[] }[]) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: history.map(h => ({ text: h.parts[0].text })) },
        config: {
          systemInstruction: "You are Rootwise AI, a wise and encouraging mentor. You help connect generations through shared wisdom and roots. Your tone is warm, patient, and highly productive. Encourage users to share their unique life perspectives regardless of age."
        }
      });
      return response.text;
    } catch (error) {
      console.error("AI Mentor Error:", error);
      return "I'm having a little trouble connecting right now, but I'm still here to support your growth journey.";
    }
  }

  async generateQuestImage(prompt: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A beautiful, symbolic, high-quality 3D digital art piece representing: ${prompt}. Clean, modern, uplifting style.` }] },
        config: {
          imageConfig: { aspectRatio: "16:9" }
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Image Generation Error:", error);
      return "https://picsum.photos/800/450";
    }
  }
}
