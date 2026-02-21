
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { REALITY_FIRST_SYSTEM_PROMPT, STORYBOARD_SYSTEM_PROMPT, STORYBOARD_LAYOUTS } from "../constants";
import { GeneratedPrompt, AspectRatio } from "../types";

export class GeminiService {
  private static getAiClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  static async generateRealityPrompt(
    query: string, 
    aspectRatio: string, 
    mode: 'single' | 'storyboard',
    style: string,
    layoutId?: string
  ): Promise<GeneratedPrompt> {
    const ai = this.getAiClient();
    
    const systemInstruction = mode === 'storyboard' ? STORYBOARD_SYSTEM_PROMPT : REALITY_FIRST_SYSTEM_PROMPT;
    const layout = STORYBOARD_LAYOUTS.find(l => l.id === layoutId);
    
    let promptText = "";
    if (mode === 'storyboard') {
      promptText = `Construct a storyboard sequence for: "${query}". 
      Required Layout: ${layout?.description}. 
      Style: ${style}. 
      Task: Create a positive prompt that describes a single image containing ${layout?.panels} sequential panels. Front-load the layout and medium.`;
    } else {
      promptText = `Create an image prompt for: "${query}". 
      Aspect ratio: ${aspectRatio}. 
      Style: ${style}. 
      Task: Front-load Aspect Ratio, Medium, and Shot Type. Ensure it is a complete master prompt.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      },
    });

    try {
      const jsonStr = response.text?.trim() || "{}";
      const cleanJson = jsonStr.replace(/^```json\n?|\n?```$/g, '');
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse prompt JSON", e);
      throw new Error("Failed to generate structured prompt strategy.");
    }
  }

  static async generateImage(prompt: string, negPrompt: string, aspectRatio: string): Promise<string> {
    const ai = this.getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Reverted to Flash model
      contents: { 
        parts: [{ text: `MASTER POSITIVE: ${prompt}\n\nSTRICT NEGATIVES: ${negPrompt}, no text, whitespace, frames, watermark, signature, borders.` }] 
      },
      config: { 
        imageConfig: { 
          aspectRatio: aspectRatio as any
        } 
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("The synthesis engine returned no visual data.");
  }

  static async editImage(originalImageData: string, editPrompt: string): Promise<string> {
    const ai = this.getAiClient();
    const [header, data] = originalImageData.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ inlineData: { data, mimeType } }, { text: editPrompt }] 
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Failed to refine image data.");
  }
}
