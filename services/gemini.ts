
import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { MealPlan, User, Recipe } from "../types";

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
  const simplifiedHistory = chatHistory.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content || "..." }] 
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
    2. Si l'utilisateur demande un plan, utilise l'outil 'propose_meal_plan_concept' avec une semaine type.
    3. Si l'utilisateur dit "Pas de petit déjeuner", laisse le champ 'breakfast' vide dans l'outil.
    4. Si l'utilisateur demande "7 repas répétés", propose une 'weeklyPreview' de 7 jours dans l'outil.
    5. IMPORTANT : Si tu ne peux pas utiliser un outil, RÉPONDS JUSTE PAR TEXTE.
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

    if (response.functionCalls) {
      for (const call of response.functionCalls) {
        if (call.name === 'update_user_profile') result.extractedInfo = { ...result.extractedInfo, ...call.args };
        if (call.name === 'propose_meal_plan_concept') {
          result.suggestedConcept = call.args;
          if (!result.suggestedConcept.startDate) result.suggestedConcept.startDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        }
        if (call.name === 'log_workout') result.actionLog.push({ type: 'workout', data: call.args });
        if (call.name === 'log_hydration') result.actionLog.push({ type: 'hydration', data: call.args });
        if (call.name === 'log_meal') result.actionLog.push({ type: 'meal', data: call.args });
      }
    }

    if (!result.reply && result.suggestedConcept) {
      result.reply = `J'ai préparé une ébauche de semaine type ! Cliquez sur "Valider" pour l'étendre à tout le mois, ou demandez-moi des modifications.`;
    }

    if (!result.reply && !result.suggestedConcept && result.actionLog.length === 0) {
      throw new Error("Empty response");
    }

    return result;

  } catch (error) {
    console.warn("Fallback Mode Texte", error);
    // --- TENTATIVE 2 : MODE TEXTE SEUL (Fallback) ---
    try {
        const fallbackResponse = await ai.models.generateContent({
            model: modelName,
            contents: [...simplifiedHistory, { role: 'user', parts: currentParts }],
            config: {
                systemInstruction: "Tu es un assistant nutritionnel. L'utilisateur a rencontré une erreur technique avec l'interface visuelle. Réponds simplement à sa demande par texte (liste de repas, conseils, etc).",
            }
        });

        return {
            reply: fallbackResponse.text || "Je vous ai compris, mais je préfère vous répondre par écrit pour le moment.",
            extractedInfo: {},
            suggestedConcept: undefined,
            actionLog: []
        };
    } catch (finalError) {
        return { reply: "Je suis là. Que souhaitez-vous manger ?" };
    }
  }
};

// --- GÉNÉRATION DU PLAN COMPLET (30 Jours) ---
// VERSION OPTIMISÉE : Si une semaine type existe, on la duplique mathématiquement pour éviter les erreurs d'IA.
export const generateMealPlan = async (concept: any, user: User): Promise<MealPlan> => {
  const startDate = concept.startDate || new Date().toISOString().split('T')[0];

  // STRATÉGIE RAPIDE : Construction locale si la preview existe
  // Cela garantit le succès à 100% pour les demandes "répéter 7 repas"
  if (concept.weeklyPreview && Array.isArray(concept.weeklyPreview) && concept.weeklyPreview.length > 0) {
    console.log("Génération algorithmique locale (rapide)...");
    
    const days: any[] = [];
    const recipes: Recipe[] = [];
    const recipeMap = new Map<string, string>(); // Nom -> ID

    // Fonction utilitaire pour créer/récupérer une recette
    const getOrCreateRecipeId = (mealName: string, calories: number = 500): string => {
       if (!mealName) return "";
       if (recipeMap.has(mealName)) return recipeMap.get(mealName)!;
       
       const id = `rec_${Math.random().toString(36).substr(2, 9)}`;
       recipes.push({
         id,
         name: mealName,
         calories: calories, // Estimation par défaut si pas fournie
         ingredients: [{ item: mealName, amount: "1 portion" }],
         steps: ["Préparer les ingrédients.", "Cuisiner selon vos préférences.", "Servir chaud."],
         totalWeight: "400g"
       });
       recipeMap.set(mealName, id);
       return id;
    };

    // On génère 30 jours en bouclant sur la preview
    for (let i = 0; i < 30; i++) {
       // On trouve le jour correspondant dans la preview (modulo la longueur de la preview)
       // Ex: si preview a 7 jours, jour 8 reprend le jour 1
       const templateDayIndex = i % concept.weeklyPreview.length;
       const templateDay = concept.weeklyPreview[templateDayIndex];

       days.push({
         day: i + 1,
         breakfast: templateDay.breakfast ? getOrCreateRecipeId(templateDay.breakfast, 400) : undefined,
         lunch: getOrCreateRecipeId(templateDay.lunch || "Déjeuner équilibré", 700),
         snack: templateDay.snack ? getOrCreateRecipeId(templateDay.snack, 200) : undefined,
         dinner: getOrCreateRecipeId(templateDay.dinner || "Dîner léger", 500),
       });
    }

    return {
      startDate,
      days,
      recipes
    };
  }

  // FALLBACK IA : Uniquement si pas de preview visuelle (cas rare)
  if (!process.env.API_KEY) throw new Error("API Key manquante");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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

  const prompt = `Génère un plan de repas de 30 jours (JSON). TITRE: ${concept.title}. DÉBUT: ${startDate}. Si tu n'as pas de détails précis, invente des recettes saines.`;

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
    console.error("Erreur Planification IA:", error);
    throw new Error("Génération échouée");
  }
};
