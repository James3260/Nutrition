
import {GoogleGenAI} from "@google/genai";

// The local declare global block was removed because it caused duplicate identifier and modifier conflict errors
// with the existing ambient environment declarations. We now access aistudio via the window object.

export class IconService {
  static async generateAppIcon(): Promise<string> {
    // Règle : Pour gemini-3-pro-image-preview, l'utilisateur doit sélectionner sa clé via l'interface aistudio.
    // Using a type assertion on window to satisfy the compiler while avoiding declaration conflicts.
    const aistudio = (window as any).aistudio;
    if (!(await aistudio.hasSelectedApiKey())) {
      await aistudio.openSelectKey();
    }

    // Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date key from the dialog.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prompt "Modern Crystal" : lumineux, épuré, organique et technologique
    const prompt = "Luxury minimalist 3D mobile app icon for 'NutriTrack AI'. A stylized letter 'N' formed by two interlocking translucent emerald-green glass ribbons that subtly resemble organic leaves. The structure features soft prismatic light refractions and a high-gloss crystalline finish. Set against a pure, clean, bright white background with soft ambient occlusion shadows. 8k resolution, cinematic lighting, sophisticated wellness aesthetic, no text, centered, masterpiece.";

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
        // Iterate through all parts as nano banana series models can return mixed content types.
        for (const part of firstCandidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }

      throw new Error("Aucune donnée d'image trouvée.");
    } catch (error: any) {
      // If the request fails with "Requested entity was not found", reset the selection state and prompt the user again.
      if (error.message?.includes("Requested entity was not found")) {
        await aistudio.openSelectKey();
      }
      console.error("Erreur IconService:", error);
      throw error;
    }
  }

  static applyIcon(base64Icon: string) {
    // Mise à jour du Favicon
    let favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(favicon);
    }
    favicon.href = base64Icon;

    // Mise à jour de l'icône iOS
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.getElementsByTagName('head')[0].appendChild(appleIcon);
    }
    appleIcon.href = base64Icon;

    // Création d'un Manifest dynamique pour la PWA
    const manifestContent = {
      "name": "NutriTrack AI Premium",
      "short_name": "NutriTrack",
      "description": "Assistant Nutritionnel IA de Luxe",
      "start_url": "/",
      "display": "standalone",
      "background_color": "#ffffff",
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
