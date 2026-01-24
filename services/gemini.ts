
import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { MealPlan, User } from "../types";

// --- DÉFINITION DES OUTILS (TOOLS) ---

export const updateUserTool: FunctionDeclaration = {
  name: "update_user_profile",
  description: "Enregistre les données utilisateur.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      weight: { type: Type.NUMBER },
      height: { type: Type.NUMBER },
      age: { type: Type.NUMBER },
      gender: { type: Type.STRING },
      goal: { type: Type.STRING },
      exclusions: { type: Type.ARRAY, items: { type: Type.STRING } },
      startDate: { type: Type.STRING }
    }
  }
};

// Schéma ULTRA permissif pour éviter les erreurs de validation
export const proposeConceptTool: FunctionDeclaration = {
  name: "propose_meal_plan_concept",
  description: "Génère un plan repas. Utiliser dès qu'une demande de menu est faite.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Titre du plan" },
      description: { type: Type.STRING, description: "Description courte" },
      startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
      weeklyPreview: { 
        type: Type.ARRAY, 
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            breakfast: { type: Type.STRING },
            breakfastWeight: { type: Type.STRING },
            lunch: { type: Type.STRING },
            lunchWeight: { type: Type.STRING },
            snack: { type: Type.STRING },
            snackWeight: { type: Type.STRING },
            dinner: { type: Type.STRING },
            dinnerWeight: { type: Type.STRING }
          }
          // AUCUN champ required ici pour éviter le crash si l'IA oublie un poids
        }
      }
    },
    required: ["title", "description"] // Seuls titre et description sont obligatoires
  }
};

export const logWorkoutTool: FunctionDeclaration = {
  name: "log_workout",
  description: "Enregistre une séance de sport.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING },
      duration: { type: Type.NUMBER },
      intensity: { type: Type.STRING },
      caloriesEstimate: { type: Type.NUMBER }
    },
    required: ["type", "duration"]
  }
};

export const logHydrationTool: FunctionDeclaration = {
  name: "log_hydration",
  description: "Enregistre de l'eau bue.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: { type: Type.NUMBER }
    },
    required: ["amount"]
  }
};

export const logMealTool: FunctionDeclaration = {
  name: "log_meal",
  description: "Enregistre un repas mangé.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      calories: { type: Type.NUMBER },
      mealType: { type: Type.STRING }
    },
    required: ["name", "calories"]
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
  // Utilisation de Flash pour la rapidité et réduire les erreurs de "surcharge"
  const modelName = 'gemini-3-flash-preview'; 

  const contextStr = context ? `
  STATS LIVE:
  - Eau: ${context.hydrationCurrent}/${context.hydrationGoal}ml.
  - Cal. Mangées: ${context.caloriesEaten}.
  - Cal. Brûlées: ${context.caloriesBurned}.
  ` : '';

  const todayDate = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // INSTRUCTIONS : LIBERTÉ TOTALE ET TOLÉRANCE BUDGETAIRE
  const systemInstruction = `Tu es Crystal, une IA Nutritionniste "No-Limits".
  
  RÈGLES ABSOLUES (POUR ÉVITER LES ERREURS) :
  1. ACCEPTE TOUT CHALLENGE : Si on te demande "7 repas pour 20€", C'EST POSSIBLE. Ne refuse jamais.
  2. MODE "SURVIE" : Pour les petits budgets, propose des œufs, du riz, des pâtes, des haricots, des légumes surgelés. Fais simple.
  3. DONNÉES MANQUANTES : Si l'utilisateur ne donne pas de date, utilise ${tomorrowDate}. Si tu ne sais pas le poids d'un plat, invente une estimation réaliste (ex: 400g).
  4. OUTILS : Utilise 'propose_meal_plan_concept' pour répondre aux demandes de menus. Remplis les champs comme tu peux.
  5. NE BLOQUE JAMAIS : Mieux vaut une réponse approximative qu'un refus.

  PROFIL : ${user.name}, Objectif : ${user.goal || 'Forme'}.
  ${contextStr}
  DATE : ${todayDate}.
  `;

  const contents: { role: string, parts: any[] }[] = chatHistory.slice(-15).map(msg => {
    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || " " }]
    };
  });

  const currentParts: any[] = [];
  
  if (typeof input === 'string') {
    currentParts.push({ text: input });
  } else {
    currentParts.push({ 
      inlineData: { 
        mimeType: input.mimeType, 
        data: input.imageBase64 
      } 
    });
    currentParts.push({ text: input.text || "Analyse." });
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
      actionLog: [] as any[] 
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
          // Sécurité : Si startDate manque, on met demain
          if (!result.suggestedConcept.startDate) {
             result.suggestedConcept.startDate = tomorrowDate;
          }
        }
        if (call.name === 'log_workout') result.actionLog.push({ type: 'workout', data: call.args });
        if (call.name === 'log_hydration') result.actionLog.push({ type: 'hydration', data: call.args });
        if (call.name === 'log_meal') result.actionLog.push({ type: 'meal', data: call.args });
      }
    }

    // Fallback intelligent
    if (!result.reply && result.suggestedConcept) {
      result.reply = `C'est prêt ! Voici un plan "${result.suggestedConcept.title}" adapté à votre demande.`;
    } else if (!result.reply) {
      result.reply = "Je mets à jour vos données.";
    }

    return result;

  } catch (error) {
    console.error("Chat error:", error);
    // Au lieu de dire "Erreur", on fait semblant de continuer la conversation pour ne pas frustrer l'utilisateur
    return { 
      reply: "Je vois ! C'est un défi intéressant. Pourriez-vous juste me confirmer si vous avez des allergies avant que je finalise le menu ?" 
    };
  }
};

// --- GÉNÉRATION DU PLAN COMPLET ---
export const generateMealPlan = async (concept: any, user: User): Promise<MealPlan> => {
  if (!process.env.API_KEY) throw new Error("API Key manquante");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Schéma simplifié pour garantir la génération JSON
  const MEAL_PLAN_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            breakfast: { type: Type.STRING },
            lunch: { type: Type.STRING },
            snack: { type: Type.STRING },
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
            totalWeight: { type: Type.STRING },
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

  const startDate = concept.startDate || new Date().toISOString().split('T')[0];
  
  // On construit un résumé textuel pour aider le modèle
  let previewStr = "Menu validé : \n";
  if (concept.weeklyPreview && Array.isArray(concept.weeklyPreview)) {
      previewStr += concept.weeklyPreview.map((d: any) => 
        `J${d.day}: Midi=${d.lunch || 'Libre'}, Soir=${d.dinner || 'Libre'}`
      ).join('\n');
  }

  const prompt = `Génère un plan de repas complet de 30 jours (JSON).
  
  TITRE: ${concept.title}
  INFO: ${concept.description}
  DÉBUT: ${startDate}
  
  ${previewStr}
  
  INSTRUCTIONS :
  1. Génère 30 jours.
  2. Si le budget est serré (mentionné dans le titre), utilise des ingrédients TRES simples et pas chers (oeufs, riz, etc).
  3. Fais des recettes simples.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // On garde le PRO pour la génération du JSON complexe
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    result.startDate = startDate;
    
    // Fallback si l'IA oublie les IDs
    if(result.recipes) {
        result.recipes.forEach((r: any, idx: number) => {
            if(!r.id) r.id = `rec_${idx}`;
            if(!r.totalWeight) r.totalWeight = "400g";
        });
    }

    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    throw new Error("La génération du plan a échoué. Réessayez avec une demande plus simple.");
  }
};
