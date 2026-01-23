
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
    return { reply: "⚠️ Erreur : Clé API manquante." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Choix du modèle : Audio nécessite gemini-2.5, Texte pur utilise gemini-3 pour la vitesse/intelligence
  const isAudioInput = typeof input !== 'string';
  const modelName = isAudioInput ? 'gemini-2.5-flash-preview' : 'gemini-3-flash-preview';

  const systemInstruction = `Tu es Crystal, coach nutrition d'élite.
  TON STYLE : Court, vif, empathique. Comme un SMS d'un ami expert.
  
  RÈGLE ABSOLUE : Chaque réponse doit contenir du TEXTE, même si tu utilises un outil.
  Si l'utilisateur dit juste "Bonjour", réponds poliment et demande son objectif. N'appelle pas d'outil pour "Bonjour".
  
  PROCESSUS :
  1. Pose UNE question à la fois pour connaître : Poids, Taille, Âge, Sexe, Objectif.
  2. UTILISE L'OUTIL 'update_user_profile' dès qu'une info est donnée. ACCOMPAGNE CELA D'UNE PHRASE DE CONFIRMATION.
  3. Quand tu as tout, UTILISE L'OUTIL 'propose_meal_plan_concept'.
  
  Ne renvoie JAMAIS de JSON brut dans le texte visible.`;

  // On limite l'historique pour éviter de saturer le contexte
  const limitedHistory = chatHistory.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }] // On garde l'historique en texte
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

    // ANALYSE DE LA RÉPONSE
    const result = {
      reply: "",
      extractedInfo: {} as any,
      suggestedConcept: undefined as any
    };

    // 1. Récupérer le texte
    if (response.text) {
      result.reply = response.text;
    }

    // 2. Vérifier les appels d'outils (Function Calls)
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

    // --- FALLBACKS INTELLIGENTS ---
    // Si l'IA a utilisé un outil mais n'a rien dit (bug fréquent), on génère une réponse logique.
    if (!result.reply && Object.keys(result.extractedInfo).length > 0) {
        const infoKeys = Object.keys(result.extractedInfo).join(', ');
        result.reply = `C'est noté (${infoKeys}). Avez-vous d'autres précisions ou préférences ?`;
    }

    if (!result.reply && result.suggestedConcept) {
      result.reply = "J'ai bien analysé vos besoins. Voici le concept que je vous propose :";
    }
    
    // Fallback ultime
    if (!result.reply && !result.suggestedConcept) {
        result.reply = "Je vous écoute, dites-m'en plus sur vos objectifs.";
    }

    return result;

  } catch (error) {
    console.error("Chat error:", error);
    return { 
      reply: "Désolé, une erreur de connexion est survenue. Pouvez-vous répéter ?" 
    };
  }
};

// --- GÉNÉRATION DU PLAN (Reste sur Gemini 3 Pro pour la complexité) ---
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
  Préférences détectées: ${JSON.stringify(userContext)}
  
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
