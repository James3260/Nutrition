
import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { MealPlan, User } from "../types";

// --- DÉFINITION DES OUTILS (TOOLS) ---
// On rend TOUT optionnel pour éviter que Gemini ne plante s'il manque un détail.

export const updateUserTool: FunctionDeclaration = {
  name: "update_user_profile",
  description: "Enregistre les préférences utilisateur.",
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

export const proposeConceptTool: FunctionDeclaration = {
  name: "propose_meal_plan_concept",
  description: "Affiche un aperçu visuel d'une semaine type.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      startDate: { type: Type.STRING },
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
        }
      }
    }
    // AUCUN required : on laisse l'IA remplir ce qu'elle peut
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
    }
  }
};

export const logHydrationTool: FunctionDeclaration = {
  name: "log_hydration",
  description: "Enregistre de l'eau bue.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: { type: Type.NUMBER }
    }
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
    }
  }
};

export const tools: Tool[] = [
  { functionDeclarations: [updateUserTool, proposeConceptTool, logWorkoutTool, logHydrationTool, logMealTool] }
];

// --- CHAT PRINCIPAL AVEC FALLBACK ---
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
    return { reply: "⚠️ Erreur : Clé API manquante." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview'; 

  // Nettoyage de l'historique pour éviter les boucles d'erreur
  // On ne garde que le texte des messages précédents pour simplifier le contexte
  const simplifiedHistory = chatHistory.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content || "..." }] // Force un texte même si vide
  }));

  const currentParts: any[] = [];
  if (typeof input === 'string') {
    currentParts.push({ text: input });
  } else {
    currentParts.push({ 
      inlineData: { mimeType: input.mimeType, data: input.imageBase64 } 
    });
    currentParts.push({ text: input.text || "Analyse." });
  }

  // --- TENTATIVE 1 : AVEC OUTILS (Mode App) ---
  try {
    const systemInstruction = `Tu es Crystal, une IA experte en nutrition.
    Ta mission : Aider l'utilisateur à bien manger et atteindre ses objectifs.
    
    RÈGLES :
    1. Sois naturelle et conversationnelle (comme un humain).
    2. Si l'utilisateur demande un plan, utilise l'outil 'propose_meal_plan_concept'.
    3. Si l'utilisateur donne une info (poids, sport), utilise les outils correspondants.
    4. IMPORTANT : Si tu ne peux pas utiliser un outil pour une raison quelconque, RÉPONDS JUSTE PAR TEXTE. Ne plante pas.
    5. Si l'utilisateur demande "7 repas répétés sur un mois", utilise 'propose_meal_plan_concept' avec une 'weeklyPreview' de 7 jours, et mets dans la description que ce sera répété.
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [...simplifiedHistory, { role: 'user', parts: currentParts }],
      config: {
        systemInstruction,
        tools: tools,
        temperature: 0.7,
      },
    });

    const result = {
      reply: response.text || "",
      extractedInfo: {} as any,
      suggestedConcept: undefined as any,
      actionLog: [] as any[] 
    };

    // Traitement des outils (si ça a marché)
    if (response.functionCalls) {
      for (const call of response.functionCalls) {
        if (call.name === 'update_user_profile') result.extractedInfo = { ...result.extractedInfo, ...call.args };
        if (call.name === 'propose_meal_plan_concept') {
          result.suggestedConcept = call.args;
          // Valeur par défaut pour éviter crash UI
          if (!result.suggestedConcept.startDate) result.suggestedConcept.startDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        }
        if (call.name === 'log_workout') result.actionLog.push({ type: 'workout', data: call.args });
        if (call.name === 'log_hydration') result.actionLog.push({ type: 'hydration', data: call.args });
        if (call.name === 'log_meal') result.actionLog.push({ type: 'meal', data: call.args });
      }
    }

    // Si on a un concept mais pas de texte, on ajoute un texte générique
    if (!result.reply && result.suggestedConcept) {
      result.reply = `Voici une proposition pour votre demande ! Qu'en pensez-vous ?`;
    }

    // Si vraiment rien (ni texte ni outil), on lance une erreur pour déclencher le fallback
    if (!result.reply && !result.suggestedConcept && result.actionLog.length === 0) {
      throw new Error("Empty response");
    }

    return result;

  } catch (error) {
    console.warn("Mode Outils échoué, passage en mode conversationnel pur (Fallback ChatGPT-style)", error);

    // --- TENTATIVE 2 : MODE TEXTE SEUL (Fallback) ---
    // Si la logique complexe plante, on demande juste à l'IA de répondre à la question par texte.
    // C'est ce qui garantit que l'utilisateur a toujours une réponse.
    try {
        const fallbackResponse = await ai.models.generateContent({
            model: modelName, // On reste sur Flash pour la vitesse
            contents: [...simplifiedHistory, { role: 'user', parts: currentParts }],
            config: {
                systemInstruction: "Tu es un assistant nutritionnel utile. Réponds à la demande de l'utilisateur par texte simplement. Ne cherche pas à utiliser d'outils complexes, donne juste les conseils ou les menus demandés sous forme de liste texte.",
                // PAS D'OUTILS ICI
            }
        });

        return {
            reply: fallbackResponse.text || "Je vous ai compris, mais je préfère vous répondre par écrit pour le moment. Que souhaitez-vous savoir exactement ?",
            extractedInfo: {},
            suggestedConcept: undefined,
            actionLog: []
        };
    } catch (finalError) {
        return { reply: "Je suis là, mais j'ai un peu de mal à traiter cette demande spécifique. Pouvons-nous essayer une question plus simple ?" };
    }
  }
};

// --- GÉNÉRATION DU PLAN COMPLET (30 Jours) ---
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
  
  // Construction du prompt intelligent
  let previewStr = "";
  if (concept.weeklyPreview && Array.isArray(concept.weeklyPreview)) {
      previewStr = concept.weeklyPreview.map((d: any) => 
        `Jour Type ${d.day}: Matin=${d.breakfast || 'Non'}, Midi=${d.lunch}, Soir=${d.dinner}`
      ).join('\n');
  }

  const prompt = `Génère un plan de repas de 30 jours (JSON).
  
  TITRE: ${concept.title}
  INFO: ${concept.description}
  DÉBUT: ${startDate}
  
  MODÈLE DE BASE (à répéter ou varier selon la demande) :
  ${previewStr}
  
  INSTRUCTIONS :
  1. Si le titre mentionne "répété", répète les repas de la semaine type sur tout le mois.
  2. Sinon, varie les plaisirs.
  3. Génère bien 30 jours complets.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // On garde Pro pour le JSON complexe
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });
    
    const result = JSON.parse(response.text || '{}');
    result.startDate = startDate;
    
    if(result.recipes) {
        result.recipes.forEach((r: any, idx: number) => {
            if(!r.id) r.id = `rec_${idx}`;
            if(!r.totalWeight) r.totalWeight = "400g";
        });
    }

    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    // Si le JSON échoue, on ne plante pas tout l'app, on renvoie une erreur propre
    throw new Error("La génération du calendrier a échoué. Essayez de demander quelque chose de plus simple pour commencer.");
  }
};
