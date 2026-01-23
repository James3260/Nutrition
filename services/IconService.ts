
import { GoogleGenAI } from "@google/genai";

declare global {
  // Define the AIStudio interface for managing API keys in the environment.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Removed readonly modifier to ensure identical modifiers with environmental declarations.
    aistudio: AIStudio;
  }
}

export class IconService {
  static async generateAppIcon(): Promise<string> {
    // Rule: When using gemini-3-pro-image-preview, users MUST select their own API key.
    if (!(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }

    // Rule: Create a new GoogleGenAI instance right before making an API call to ensure it uses the latest key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Nouveau prompt ultra-premium pour un logo iconique
    const prompt = "A high-end luxury mobile app icon for 'NutriTrack AI'. A minimalist abstract 3D emblem: a singular, glowing emerald-green crystalline structure shaped like a stylized 'N' that subtly evokes an organic leaf. The icon features a soft internal bioluminescence, encased in a polished dark obsidian glass frame with elegant chamfered edges. Photorealistic 8k render, cinematic studio lighting, deep shadows, premium aesthetic, set against a solid deep midnight black background. No text, symmetrical, masterpiece.";

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
        // Find the image part as recommended by the SDK guidelines.
        for (const part of firstCandidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const base64EncodeString: string = part.inlineData.data;
            return `data:image/png;base64,${base64EncodeString}`;
          }
        }
      }

      throw new Error("Aucune donnée d'image trouvée dans la réponse.");
    } catch (error: any) {
      // Rule: If Requested entity was not found, prompt user to select a key again.
      if (error.message?.includes("Requested entity was not found")) {
        await window.aistudio.openSelectKey();
      }
      console.error("Erreur IconService:", error);
      throw error;
    }
  }

  static applyIcon(base64Icon: string) {
    // Update Favicon
    let favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(favicon);
    }
    favicon.href = base64Icon;

    // Update Apple Touch Icon
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.getElementsByTagName('head')[0].appendChild(appleIcon);
    }
    appleIcon.href = base64Icon;

    // Create and update Web Manifest
    const manifestContent = {
      "name": "NutriTrack AI Premium",
      "short_name": "NutriTrack",
      "start_url": "/",
      "display": "standalone",
      "background_color": "#020617",
      "theme_color": "#10b981",
      "icons": [
        {
          "src": base64Icon,
          "sizes": "1024x1024",
          "type": "image/png",
          "purpose": "any"
        },
        {
          "src": base64Icon,
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "maskable"
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
