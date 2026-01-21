
import { GoogleGenAI } from "@google/genai";

export class IconService {
  static async generateAppIcon(): Promise<string> {
    // Rule: When using gemini-3-pro-image-preview, users MUST select their own API key.
    if (!(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }

    // Rule: Create a new GoogleGenAI instance right before making an API call to ensure it uses the latest key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = "A high-end, professional, modern minimalist app icon for 'NutriTrack AI'. The design features a stylized vibrant emerald green leaf intertwined with sleek digital AI circuit lines. Soft shadows, premium 3D render feel, white background, centered, symmetrical, 1024x1024 resolution.";

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("Le modèle n'a renvoyé aucun résultat.");
      }

      const firstCandidate = response.candidates[0];
      if (firstCandidate.content && firstCandidate.content.parts) {
        // Find the image part, do not assume it is the first part.
        for (const part of firstCandidate.content.parts) {
          if (part.inlineData) {
            const base64EncodeString: string = part.inlineData.data;
            return `data:image/png;base64,${base64EncodeString}`;
          }
        }
      }

      throw new Error("Aucune donnée d'image trouvée dans la réponse.");
    } catch (error: any) {
      console.error("Erreur IconService:", error);
      throw error;
    }
  }

  static applyIcon(base64Icon: string) {
    let favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(favicon);
    }
    favicon.href = base64Icon;

    let appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.getElementsByTagName('head')[0].appendChild(appleIcon);
    }
    appleIcon.href = base64Icon;

    const manifestContent = {
      "name": "NutriTrack AI - Assistant Nutrition",
      "short_name": "NutriTrack",
      "start_url": "/",
      "display": "standalone",
      "background_color": "#f8fafc",
      "theme_color": "#10b981",
      "icons": [
        {
          "src": base64Icon,
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "any maskable"
        }
      ]
    };
    
    const stringManifest = JSON.stringify(manifestContent);
    const blob = new Blob([stringManifest], {type: 'application/json'});
    const manifestURL = URL.createObjectURL(blob);
    
    let manifestTag = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (manifestTag) {
      manifestTag.href = manifestURL;
    }
  }
}
