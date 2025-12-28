
import { GoogleGenAI, Type } from "@google/genai";
import { BookPage, ImageSize } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async findTrendingTopic(): Promise<{ topic: string; title: string; reason: string }> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Analyze current Google Trends for digital products and kids' learning materials. Identify a high-demand niche and suggest a book title with reasons based on recent search data. Focus on topics that are trending but underserved.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            title: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["topic", "title", "reason"]
        }
      }
    });

    try {
      return JSON.parse(response.text.trim());
    } catch (e) {
      throw new Error("Failed to analyze trends. Please try again.");
    }
  }

  async generateStoryStructure(topic: string, pageCount: number, useDeepThinking: boolean = false): Promise<BookPage[]> {
    const ai = this.getAI();
    // Exclusively use Flash model for all text tasks to stay within free tier limits
    const model = "gemini-3-flash-preview";
    
    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pageNumber: { type: Type.INTEGER },
            text: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
          },
          required: ["pageNumber", "text", "imagePrompt"],
        },
      },
      tools: [{ googleSearch: {} }],
      // Use Thinking Config with Flash model for better reasoning while staying on free tier
      thinkingConfig: { thinkingBudget: useDeepThinking ? 16384 : 0 }
    };

    const response = await ai.models.generateContent({
      model,
      contents: `Create a children's book story about "${topic}" with ${pageCount} pages. 
      For each page, provide:
      1. Story text in Thai (1-2 engaging sentences suitable for children).
      2. Detailed English image prompt for high-quality children's book illustration.
      The story should have a clear beginning, middle, and end.`,
      config,
    });

    try {
      return JSON.parse(response.text.trim());
    } catch (e) {
      throw new Error("Invalid structure generated. Retrying might help.");
    }
  }

  async generateImage(prompt: string, size: ImageSize = '1K', usePro: boolean = false): Promise<string> {
    const ai = this.getAI();
    // Exclusively use Flash Image model for free tier compliance
    const model = 'gemini-2.5-flash-image';
    
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: `${prompt}. Whimsical children's book illustration style, soft lighting, vibrant colors, clean lines, high quality digital art.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      },
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image generation failed.");
  }

  async editImage(base64Image: string, editPrompt: string): Promise<string> {
    const ai = this.getAI();
    const mimeType = base64Image.split(';')[0].split(':')[1];
    const data = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: `Modify this image based on: ${editPrompt}. Keep the same children's book illustration style and characters.` }
        ],
      },
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image editing failed.");
  }

  async generateSEO(topic: string, bookTitle: string): Promise<{ title: string; description: string; keywords: string[] }> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: `Create Etsy and Amazon SEO data for a digital children's book: "${bookTitle}" (Topic: ${topic}). 
      Provide:
      - A catchy, SEO-optimized title in Thai.
      - A detailed product description in Thai highlighting benefits and content.
      - 13 English tags/keywords separated by commas.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "description", "keywords"]
        }
      },
    });

    try {
      return JSON.parse(response.text.trim());
    } catch (e) {
      throw new Error("SEO generation failed.");
    }
  }

  async analyzeReferenceImage(base64Image: string): Promise<string> {
    const ai = this.getAI();
    const mimeType = base64Image.split(';')[0].split(':')[1];
    const data = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: "Analyze this image and describe its artistic style, color palette, and character design for reference in 2-3 sentences. Focus on descriptive visual elements." }
        ],
      },
    });
    return response.text;
  }
}

export const gemini = new GeminiService();
