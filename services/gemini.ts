
import { GoogleGenAI, Type, Modality, FunctionDeclaration, Tool } from "@google/genai";
import { MealPlan, User } from "../types";

// --- DÉFINITION DES OUTILS (TOOLS) ---
export const updateUserTool: FunctionDeclaration = {
  name: "update_user_profile",
  description: "Enregistre les informations physiques ou les préférences de l'utilisateur détectées dans la conversation.",
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

// --- TTS (Synthèse vocale) ---
export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Voix douce
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.warn("TTS Error:", error);
    return null;
  }
};

// --- CHAT PRINCIPAL ---
export const chatWithAI = async (input: string | { audioData: string, mimeType: string }, user: User, chatHistory: any[]): Promise<any> => {
  if (!process.env.API_KEY) {
    return { reply: "⚠️ Erreur : Clé API manquante. Vérifiez la configuration." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isAudioInput = typeof input !== 'string';
  // On utilise Gemini 2.5 Flash pour une réponse plus rapide et stable avec les outils
  const modelName = 'gemini-2.5-flash';

  const systemInstruction = `Tu es Crystal, coach nutrition d'élite.
  TON STYLE : Court, vif, empathique. Comme un SMS d'un ami expert.
  
  RÈGLE CRITIQUE : Tu DOIS toujours répondre avec du TEXTE, même quand tu utilises un outil. 
  Ne laisse jamais de réponse vide.
  
  MISSION : 
  1. Pose UNE question à la fois (Poids, Taille, Âge, Sexe, Objectif).
  2. Appelle 'update_user_profile' dès que tu reçois une donnée.
  3. Appelle 'propose_meal_plan_concept' quand tu as toutes les infos.`;

  // On limite l'historique pour éviter les erreurs de token et garder le focus
  const limitedHistory = chatHistory.slice(-15).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content || " " }] // Sécurité anti-vide dans l'historique
  }));

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

  const contents = [
    ...limitedHistory,
    { role: 'user', parts: [currentPart] }
  ];

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

    // Extraction sécurisée du texte
    try {
      if (response.text) {
        result.reply = response.text;
      }
    } catch (e) {
      // Ignorer l'erreur getter si le texte n'est pas dispo
    }

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

    // --- FALLBACK IMPÉRATIF ---
    // Si l'IA n'a rien renvoyé comme texte (bug fréquent avec les tools), on génère une réponse nous-mêmes.
    if (!result.reply || result.reply.trim() === "") {
      if (Object.keys(result.extractedInfo).length > 0) {
        // L'IA a mis à jour des infos mais n'a rien dit.
        const keys = Object.keys(result.extractedInfo).join(", ");
        result.reply = `C'est noté, j'ai mis à jour : ${keys}. On continue ?`;
      } else if (result.suggestedConcept) {
        result.reply = "J'ai préparé une idée de programme pour vous. Regardez ci-dessous :";
      } else {
        // Cas rare où l'IA bug complètement
        result.reply = "Je vous écoute. Pouvez-vous préciser votre demande ?";
      }
    }

    return result;

  } catch (error) {
    console.error("Chat error:", error);
    return { 
      reply: "Désolé, j'ai eu un petit souci de connexion. Pouvez-vous répéter ?" 
    };
  }
};

// --- GÉNÉRATION DU PLAN ---
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
  Préférences: ${JSON.stringify(userContext)}
  
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
