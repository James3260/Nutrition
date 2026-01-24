
import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { MealPlan, User } from "../types";

// --- DÉFINITION DES OUTILS (TOOLS) ---

export const updateUserTool: FunctionDeclaration = {
  name: "update_user_profile",
  description: "Enregistre les données utilisateur (poids, âge, objectif, etc).",
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
  description: "Propose un concept de plan de repas pour déclencher la génération complète.",
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

export const logWorkoutTool: FunctionDeclaration = {
  name: "log_workout",
  description: "Enregistre une séance de sport dans l'onglet Activité.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, enum: ["RUNNING", "CYCLING", "SWIMMING", "WALKING", "WEIGHTLIFTING", "CROSSFIT", "HIIT", "YOGA", "PILATES", "TEAM_SPORTS"], description: "Type de sport normalisé" },
      duration: { type: Type.NUMBER, description: "Durée en minutes" },
      intensity: { type: Type.STRING, enum: ["low", "medium", "high"], description: "Intensité de l'effort" },
      caloriesEstimate: { type: Type.NUMBER, description: "Estimation des calories brûlées (facultatif)" }
    },
    required: ["type", "duration"]
  }
};

export const logHydrationTool: FunctionDeclaration = {
  name: "log_hydration",
  description: "Enregistre un apport en eau dans le Dashboard.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: { type: Type.NUMBER, description: "Quantité d'eau en ml" }
    },
    required: ["amount"]
  }
};

export const logMealTool: FunctionDeclaration = {
  name: "log_meal",
  description: "Enregistre un repas consommé (via texte ou analyse photo) dans le Dashboard.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nom du plat identifié" },
      calories: { type: Type.NUMBER, description: "Estimation calorique totale" },
      mealType: { type: Type.STRING, enum: ["breakfast", "lunch", "dinner", "snack"], description: "Type de repas" }
    },
    required: ["name", "calories", "mealType"]
  }
};

export const tools: Tool[] = [
  { functionDeclarations: [updateUserTool, proposeConceptTool, logWorkoutTool, logHydrationTool, logMealTool] }
];

// --- CHAT PRINCIPAL ---
export const chatWithAI = async (
  input: string | { imageBase64: string, mimeType: string, text?: string }, 
  user: User, 
  chatHistory: any[],
  context?: {
    caloriesEaten: number;
    caloriesBurned: number;
    hydrationCurrent: number;
    hydrationGoal: number;
  }
): Promise<any> => {
  if (!process.env.API_KEY) {
    return { reply: "⚠️ Erreur : Clé API manquante. Vérifiez la configuration." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash'; // Idéal pour le multimodal rapide

  // Construction d'un contexte "Temps Réel" pour l'IA
  const contextStr = context ? `
  ÉTAT DU JOUR (Temps Réel) :
  - Hydratation : ${context.hydrationCurrent}ml / ${context.hydrationGoal}ml.
  - Calories mangées (confirmées) : ${context.caloriesEaten} kcal.
  - Calories brûlées (sport) : ${context.caloriesBurned} kcal.
  ` : '';

  const systemInstruction = `Tu es Crystal, une IA nutritionniste de luxe connectée à une application de biologie.
  
  CONTEXTE UTILISATEUR :
  Nom: ${user.name}.
  Poids: ${user.weightHistory?.[user.weightHistory.length-1]?.weight || '?'}kg.
  ${contextStr}
  
  TES SUPER-POUVOIRS (OUTILS) :
  1. ANALYSE VISUELLE : Si l'utilisateur envoie une image de nourriture, analyse-la, estime les calories et UTILISE 'log_meal'.
  2. Si l'utilisateur dit "J'ai mangé une pomme", UTILISE 'log_meal'.
  3. Si l'utilisateur dit "J'ai couru 10min", UTILISE 'log_workout'.
  4. Si l'utilisateur dit "J'ai bu un verre d'eau", UTILISE 'log_hydration'.
  5. Si l'utilisateur veut un programme, UTILISE 'propose_meal_plan_concept'.

  RÈGLES :
  - Sois proactive. Si on t'envoie une photo, sois impressionnée et précise sur l'analyse nutritionnelle.
  - Analyse les données. Si l'utilisateur a beaucoup brûlé de calories, suggère de bien manger.
  - Réponse courte, élégante et encourageante.
  `;

  const contents: { role: string, parts: any[] }[] = chatHistory.slice(-10).map(msg => {
    // Si le message historique avait une image (non stockée dans l'historique texte brut pour l'instant), on met un placeholder
    // Dans une version avancée, on stockerait l'historique multimodal.
    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || " " }]
    };
  });

  // Construction du message actuel (Texte ou Multimodal)
  const currentParts: any[] = [];
  
  if (typeof input === 'string') {
    currentParts.push({ text: input });
  } else {
    // Cas Multimodal (Image)
    currentParts.push({ 
      inlineData: { 
        mimeType: input.mimeType, 
        data: input.imageBase64 
      } 
    });
    // Texte d'accompagnement ou prompt par défaut pour l'image
    currentParts.push({ text: input.text || "Analyse cette image nutritionnellement et enregistre le repas." });
  }
  
  contents.push({ role: 'user', parts: currentParts });

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
      suggestedConcept: undefined as any,
      actionLog: [] as any[] // Pour stocker les actions sport/eau/repas
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
        if (call.name === 'log_workout') {
          result.actionLog.push({ type: 'workout', data: call.args });
        }
        if (call.name === 'log_hydration') {
          result.actionLog.push({ type: 'hydration', data: call.args });
        }
        if (call.name === 'log_meal') {
          result.actionLog.push({ type: 'meal', data: call.args });
        }
      }
    }

    // Fallback message si l'IA a juste exécuté une action sans parler
    if (!result.reply || result.reply.trim().length === 0) {
      if (result.actionLog.length > 0) {
         const type = result.actionLog[0].type;
         if (type === 'workout') result.reply = "Séance enregistrée ! 💪 Excellente activité.";
         if (type === 'hydration') result.reply = "Hydratation ajoutée. 💧";
         if (type === 'meal') result.reply = `Repas enregistré : ${result.actionLog[0].data.name} (${result.actionLog[0].data.calories} kcal). 🍽️`;
      } else if (Object.keys(result.extractedInfo).length > 0) {
        result.reply = `Profil mis à jour.`;
      } else if (result.suggestedConcept) {
        result.reply = `Je peux générer le programme "${result.suggestedConcept.title}". On y va ?`;
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
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    result.startDate = startDate;
    
    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    throw error;
  }
};
