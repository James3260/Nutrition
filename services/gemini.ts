
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
      startDate: { type: Type.STRING, description: "Date de début du régime au format YYYY-MM-DD" }
    }
  }
};

export const proposeConceptTool: FunctionDeclaration = {
  name: "propose_meal_plan_concept",
  description: "Propose un concept de plan de repas. DÉCLENCHE LA GÉNÉRATION. Si l'utilisateur donne une date (ex: mars 2026), l'inclure dans startDate.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Titre accrocheur du plan" },
      description: { type: Type.STRING, description: "Description courte de la stratégie" },
      startDate: { type: Type.STRING, description: "Date de début (YYYY-MM-DD). Par défaut: aujourd'hui." },
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
  const modelName = 'gemini-2.5-flash';

  const systemInstruction = `Tu es Crystal, une IA nutritionniste de luxe.
  CONTEXTE : Tu discutes avec ${user.name || 'un utilisateur'}.
  DONNÉES ACTUELLES : Poids: ${user.weightHistory?.[user.weightHistory.length-1]?.weight || '?'}kg, Taille: ${user.height || '?'}cm.
  
  RÈGLES :
  1. Si l'utilisateur demande un programme pour une date spécifique (ex: "Mars 2026"), utilise l'outil 'propose_meal_plan_concept' avec la bonne 'startDate'.
  2. Réponds toujours poliment et de manière concise.
  3. Si tu utilises un outil, fais toujours une phrase de confirmation pour l'utilisateur.
  `;

  const contents: { role: string, parts: any[] }[] = chatHistory.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content || " " }]
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

    if (response.text) {
      result.reply = response.text;
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

    // Fallback si pas de texte généré par le modèle
    if (!result.reply || result.reply.trim().length === 0) {
      if (Object.keys(result.extractedInfo).length > 0) {
        result.reply = `Profil mis à jour.`;
      } else if (result.suggestedConcept) {
        result.reply = `Voici une proposition pour votre programme "${result.suggestedConcept.title}". Souhaitez-vous que je le génère ?`;
      } else {
        result.reply = "Je vous écoute.";
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

// --- GÉNÉRATION DU PLAN COMPLET ---
export const generateMealPlan = async (concept: any, user: User): Promise<MealPlan> => {
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

  const startDate = concept.startDate || new Date().toISOString();

  const prompt = `GÉNÈRE UN PLAN DE REPAS COMPLET DE 30 JOURS.
  Concept: "${concept.title}" - ${concept.description}.
  Profil Utilisateur: ${user.gender || 'non spécifié'}, ${user.age || 30} ans, ${user.weightHistory?.[user.weightHistory.length-1]?.weight || 70}kg.
  Exclusions alimentaires: ${user.exclusions?.join(', ') || 'Aucune'}.
  Date de début du programme: ${startDate}.
  
  EXIGENCES STRICTES :
  1. Retourne EXCLUSIVEMENT du JSON respectant le schéma fourni.
  2. Fournis 30 jours de planification (déjeuner et dîner).
  3. Crée une liste de recettes détaillée avec ingrédients précis et étapes de préparation.
  4. Les recettes doivent être variées et adaptées au concept.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Modèle puissant pour la génération complexe
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    // On force la date de début retournée par l'outil ou par défaut aujourd'hui
    result.startDate = startDate;
    
    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    throw error;
  }
};
