
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
  description: "Génère la structure visuelle du plan repas. À utiliser DÈS QUE l'utilisateur demande des repas, un menu ou un planning.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Titre du plan (ex: 'Challenge 20€ - 7 Repas')" },
      description: { type: Type.STRING, description: "Description de la stratégie, du budget total estimé et des astuces." },
      startDate: { type: Type.STRING, description: "Date de début (Si non précisée, mettre la date de demain)." },
      weeklyPreview: { 
        type: Type.ARRAY, 
        description: "Menu type détaillé.",
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER, description: "Numéro du jour (1 à 7)" },
            breakfast: { type: Type.STRING, description: "Petit-déjeuner" },
            breakfastWeight: { type: Type.STRING, description: "Poids portion (ex: '300g')" },
            lunch: { type: Type.STRING, description: "Déjeuner" },
            lunchWeight: { type: Type.STRING, description: "Poids portion (ex: '450g')" },
            snack: { type: Type.STRING, description: "Collation" },
            snackWeight: { type: Type.STRING, description: "Poids portion (ex: '150g')" },
            dinner: { type: Type.STRING, description: "Dîner" },
            dinnerWeight: { type: Type.STRING, description: "Poids portion (ex: '350g')" }
          },
          required: ["day", "lunch", "lunchWeight", "dinner", "dinnerWeight"] 
        }
      }
    },
    required: ["title", "description", "weeklyPreview", "startDate"]
  }
};

export const logWorkoutTool: FunctionDeclaration = {
  name: "log_workout",
  description: "Enregistre une séance de sport.",
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
  description: "Enregistre de l'eau bue.",
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
  description: "Enregistre un repas mangé.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nom du plat" },
      calories: { type: Type.NUMBER, description: "Calories" },
      mealType: { type: Type.STRING, enum: ["breakfast", "lunch", "dinner", "snack"], description: "Type" }
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
  const modelName = 'gemini-3-pro-preview'; 

  const contextStr = context ? `
  STATS LIVE:
  - Eau: ${context.hydrationCurrent}/${context.hydrationGoal}ml.
  - Cal. Mangées: ${context.caloriesEaten}.
  - Cal. Brûlées: ${context.caloriesBurned}.
  ` : '';

  const todayDate = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // INSTRUCTIONS SYSTÈME : DÉBRIDAGE TOTAL
  const systemInstruction = `Tu es Crystal, une IA experte absolue en Nutrition, Cuisine et Budget.
  
  TES DIRECTIVES PRIORITAIRES (LIBERTÉ TOTALE) :
  1. TU ES "CAPABLE" DE TOUT : Ne dis jamais "je ne comprends pas" ou "hors de mes compétences". Tu sais gérer les budgets (ex: 20€/semaine), les régimes complexes, tout.
  2. SOIS PROACTIVE ET INTELLIGENTE :
     - Si l'utilisateur demande "7 repas pour 20€", NE DEMANDE PAS LA DATE. Prends l'initiative : suppose que ça commence DEMAIN (${tomorrowDate}) et génère le plan TOUT DE SUITE.
     - Si l'utilisateur ne précise pas s'il veut un petit-déj, décide pour lui (ex: propose-le ou non selon le budget).
     - Remplis les vides toi-même. L'utilisateur veut un résultat, pas un interrogatoire.
  3. GESTION DU BUDGET (CRITIQUE) :
     - Si on te donne un prix (ex: 20€), tu DOIS le respecter. Utilise des ingrédients low-cost (oeufs, riz, haricots, surgelés).
     - Fais des plans "Batch Cooking" ou "Restes" pour économiser.
  4. UTILISATION DES OUTILS :
     - Dès qu'il est question de manger, de plan ou de menu : UTILISE L'OUTIL 'propose_meal_plan_concept' IMMÉDIATEMENT. C'est ta façon de répondre.
     - Dans 'weeklyPreview', mets les repas. Si le budget est serré, tu peux répéter le même repas le midi et le soir (C'est économique).

  PROFIL UTILISATEUR :
  ${user.name}, ${user.weightHistory?.[user.weightHistory.length-1]?.weight || 'Poids inconnu'}kg.
  ${contextStr}
  DATE AUJOURD'HUI : ${todayDate}.

  Si l'input est "7 repas pour 20€", ta réponse DOIT être un appel de fonction 'propose_meal_plan_concept' avec un plan optimisé économiquement. Pas de blabla inutile avant.
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
    currentParts.push({ text: input.text || "Analyse cette image." });
  }
  
  contents.push({ role: 'user', parts: currentParts });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction,
        tools: tools,
        temperature: 0.6, // Créativité augmentée pour trouver des solutions
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

    // Fallback message intelligent
    if (!result.reply || result.reply.trim().length === 0) {
      if (result.suggestedConcept) {
        result.reply = `Challenge accepté ! Voici un plan optimisé pour votre budget : "${result.suggestedConcept.title}". J'ai sélectionné des ingrédients économiques et nutritifs. Cliquez pour voir le détail et les quantités.`;
      } else if (result.actionLog.length > 0) {
         const type = result.actionLog[0].type;
         if (type === 'workout') result.reply = "Sport enregistré !";
         if (type === 'hydration') result.reply = "Hydratation notée.";
         if (type === 'meal') result.reply = "Repas ajouté.";
      } else {
        result.reply = "C'est noté.";
      }
    }

    return result;

  } catch (error) {
    console.error("Chat error:", error);
    return { 
      reply: "Je suis prête à relever le défi, mais j'ai eu un petit hoquet technique. Répétez votre demande s'il vous plaît." 
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
            totalWeight: { type: Type.STRING, description: "Poids total de l'assiette en grammes (ex: '400g')" },
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

  // Construction du prompt de génération
  let previewStr = "";
  if (concept.weeklyPreview && Array.isArray(concept.weeklyPreview)) {
    previewStr = concept.weeklyPreview.map((d: any) => {
        let dayStr = `Jour ${d.day}: `;
        if (d.breakfast) dayStr += `Matin=${d.breakfast} (${d.breakfastWeight || '?'}), `;
        dayStr += `Midi=${d.lunch} (${d.lunchWeight || '?'}), `;
        if (d.snack) dayStr += `Snack=${d.snack} (${d.snackWeight || '?'}), `;
        dayStr += `Soir=${d.dinner} (${d.dinnerWeight || '?'})`;
        return dayStr;
    }).join('\n');
  }

  const prompt = `GÉNÈRE LE PLAN DÉTAILLÉ (30 JOURS).
  
  CONTEXTE : ${concept.title}
  DESCRIPTION : ${concept.description}
  DÉBUT : ${startDate}.
  
  STRUCTURE IMPÉRATIVE (Semainier validé) :
  ${previewStr}
  
  INSTRUCTIONS CRITIQUES :
  1. Respecte le budget implicite s'il y en a un (ingrédients simples si budget serré).
  2. Si le semainier a des trous (ex: pas de petit-déj), ne génère PAS de petit-déj pour le reste du mois non plus.
  3. 'totalWeight' est OBLIGATOIRE pour chaque recette.
  4. Fais varier les repas sur les semaines suivantes tout en gardant la logique économique.
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
