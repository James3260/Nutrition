
import { GoogleGenAI, Type, Modality, FunctionDeclaration, Tool } from "@google/genai";
import { MealPlan, User } from "../types";

// --- DÉFINITION DES OUTILS (TOOLS) ---
export const updateUserTool: FunctionDeclaration = {
  name: "update_user_profile",
  description: "Enregistre les données utilisateur. À utiliser DÈS qu'une info est donnée (poids, âge, objectif, etc).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      weight: { type: Type.NUMBER, description: "Poids en kg" },
      height: { type: Type.NUMBER, description: "Taille en cm" },
      age: { type: Type.NUMBER, description: "Âge" },
      gender: { type: Type.STRING, enum: ["man", "woman"], description: "Genre" },
      goal: { type: Type.STRING, description: "Objectif (ex: perte de poids)" },
      exclusions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Allergies ou aliments détestés" },
      startDate: { type: Type.STRING, description: "Date de début du régime" }
    }
  }
};

export const proposeConceptTool: FunctionDeclaration = {
  name: "propose_meal_plan_concept",
  description: "Propose un concept de plan de repas quand l'utilisateur a donné assez d'infos. DÉCLENCHE LA GÉNÉRATION DU PLAN.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Titre accrocheur du plan" },
      description: { type: Type.STRING, description: "Description courte de la stratégie" },
      exampleMeals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 exemples de plats" }
    },
    required: ["title", "description", "exampleMeals"]
  }
};

export const tools: Tool[] = [
  { functionDeclarations: [updateUserTool, proposeConceptTool] }
];

// --- CHAT PRINCIPAL ---
export const chatWithAI = async (input: string | { audioData: string, mimeType: string }, user: User, chatHistory: any[]): Promise<any> => {
  if (!process.env.API_KEY) {
    return { reply: "⚠️ Erreur : Clé API manquante. Vérifiez la configuration." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Utilisation de Gemini 2.5 Flash pour la rapidité et la fiabilité des outils
  const modelName = 'gemini-2.5-flash';

  const systemInstruction = `Tu es Crystal, une IA nutritionniste avancée.
  CONTEXTE : Tu discutes avec ${user.name || 'un utilisateur'}.
  DONNÉES ACTUELLES : Poids: ${user.weightHistory?.[user.weightHistory.length-1]?.weight || '?'}kg, Taille: ${user.height || '?'}cm.
  
  RÈGLES ABSOLUES :
  1. RÉPOND TOUJOURS avec une phrase complète, même si tu utilises un outil. Ne sois JAMAIS muette.
  2. Si l'utilisateur donne une info (poids, taille, âge), utilise 'update_user_profile' ET confirme vocalement (ex: "J'ai noté 75kg.").
  3. Sois proactive, empathique et professionnelle. Style conversationnel fluide (comme ChatGPT).
  `;

  // Construction de l'historique pour l'API
  // On type explicitement contents pour accepter des parts hétérogènes (text ou inlineData)
  const contents: { role: string, parts: any[] }[] = chatHistory.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content || " " }]
  }));

  // Ajout du message actuel
  let currentPart;
  if (typeof input === 'string') {
    currentPart = { text: input };
  } else {
    currentPart = {
      inlineData: {
        mimeType: input.mimeType,
        data: input.audioData
      }
    };
  }
  contents.push({ role: 'user', parts: [currentPart] });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction,
        tools: tools,
        temperature: 0.7,
      },
    });

    const result = {
      reply: "",
      extractedInfo: {} as any,
      suggestedConcept: undefined as any
    };

    // 1. Récupération du texte (si présent)
    if (response.text) {
      result.reply = response.text;
    }

    // 2. Gestion des Appels de Fonction (Tools)
    const functionCalls = response.functionCalls; 
    
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'update_user_profile') {
          result.extractedInfo = { ...result.extractedInfo, ...call.args };
        }
        if (call.name === 'propose_meal_plan_concept') {
          result.suggestedConcept = call.args;
        }
      }
    }

    // 3. FALLBACK CRITIQUE : Si l'IA a utilisé un outil mais n'a rien dit (bug fréquent)
    if (!result.reply || result.reply.trim().length === 0) {
      if (Object.keys(result.extractedInfo).length > 0) {
        // Elle a mis à jour des infos
        const infoKeys = Object.keys(result.extractedInfo).join(', ');
        result.reply = `C'est enregistré (${infoKeys}). Avez-vous d'autres précisions à apporter ?`;
      } else if (result.suggestedConcept) {
        // Elle propose un plan
        result.reply = "J'ai analysé vos besoins. Voici le programme que je vous propose :";
      } else {
        // Cas par défaut
        result.reply = "J'ai bien reçu l'information. Souhaitez-vous continuer ?";
      }
    }

    return result;

  } catch (error) {
    console.error("Chat error:", error);
    return { 
      reply: "Je rencontre une difficulté technique momentanée. Pouvez-vous reformuler ?" 
    };
  }
};

// --- GÉNÉRATION DU PLAN (inchangé mais nécessaire pour l'export) ---
export const generateMealPlan = async (userContext: any, user: User): Promise<MealPlan> => {
  if (!process.env.API_KEY) throw new Error("API Key manquante");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const MEAL_PLAN_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            lunch: { type: Type.STRING },
            dinner: { type: Type.STRING }
          }
        }
      },
      recipes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { item: { type: Type.STRING }, amount: { type: Type.STRING } }
              }
            },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            calories: { type: Type.INTEGER }
          }
        }
      }
    }
  };

  const prompt = `GÉNÈRE UN PLAN DE 30 JOURS.
  Profil: ${user.gender || 'non spécifié'}, ${user.age || 30} ans, ${user.weightHistory?.[user.weightHistory.length-1]?.weight || 70}kg.
  Objectif: ${userContext.goal || 'Perte de poids saine'}.
  Règles: 30 jours complets, recettes détaillées, grammages précis, déficit calorique calculé.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });
    const result = JSON.parse(response.text || '{}');
    result.startDate = userContext.startDate || new Date().toISOString();
    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    throw error;
  }
};
