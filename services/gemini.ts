
import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { MealPlan, User } from "../types";

// --- DÉFINITION DES OUTILS (TOOLS) ---

export const updateUserTool: FunctionDeclaration = {
  name: "update_user_profile",
  description: "Enregistre les préférences et données utilisateur (poids, allergies, etc).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      weight: { type: Type.NUMBER },
      height: { type: Type.NUMBER },
      age: { type: Type.NUMBER },
      gender: { type: Type.STRING },
      goal: { type: Type.STRING },
      exclusions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Liste des ingrédients exclus/allergies" },
      startDate: { type: Type.STRING }
    }
  }
};

// Outil de proposition visuelle (Semainier)
export const proposeConceptTool: FunctionDeclaration = {
  name: "propose_meal_plan_concept",
  description: "Affiche ou met à jour le SEMAINIER TYPE (7 jours) pour validation visuelle par l'utilisateur.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Titre du plan (ex: 'Semaine Équilibre & Budget')" },
      description: { type: Type.STRING, description: "Résumé de la stratégie (ex: 'Sans petit-déj, focus dîner léger')." },
      startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
      weeklyPreview: { 
        type: Type.ARRAY, 
        description: "Liste des 7 jours types.",
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            breakfast: { type: Type.STRING, description: "Laisser vide si l'utilisateur ne prend pas de petit-déj" },
            breakfastWeight: { type: Type.STRING },
            lunch: { type: Type.STRING },
            lunchWeight: { type: Type.STRING },
            snack: { type: Type.STRING, description: "Laisser vide si pas de collation demandée" },
            snackWeight: { type: Type.STRING },
            dinner: { type: Type.STRING },
            dinnerWeight: { type: Type.STRING }
          }
        }
      }
    },
    required: ["title", "description", "weeklyPreview"]
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
  const modelName = 'gemini-3-flash-preview'; 

  const contextStr = context ? `
  STATS LIVE:
  - Eau: ${context.hydrationCurrent}/${context.hydrationGoal}ml.
  - Cal. Mangées: ${context.caloriesEaten}.
  ` : '';

  const todayDate = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // INSTRUCTIONS SYSTÈME : PROCESSUS INTERACTIF DE VALIDATION
  const systemInstruction = `Tu es Crystal, Chef Nutritionniste & Coach.
  
  TON OBJECTIF : Construire le plan parfait AVEC l'utilisateur. Ne génère pas le mois complet tout de suite. Procède par étapes.

  PROCESSUS OBLIGATOIRE (Si demande de plan/menu) :
  1. **PROPOSITION INITIALE (Draft)** : Utilise IMMÉDIATEMENT l'outil 'propose_meal_plan_concept' pour afficher une semaine type (7 jours).
     - Si budget serré : Propose des plats économiques.
     - Par défaut : Mets Déjeuner + Dîner.
  
  2. **QUESTIONNEMENT STRATÉGIQUE** : Accompagne TOUJOURS ta proposition visuelle de questions pour affiner :
     - "Voulez-vous inclure un **Petit-Déjeuner** ?"
     - "Avez-vous besoin de **Collations** ou de **Desserts** ?"
     - "Y a-t-il des **ingrédients interdits** ou des allergies ?"
  
  3. **ITÉRATION** :
     - Si l'utilisateur répond "Ajoute le petit-déj" -> Rappelle 'propose_meal_plan_concept' avec les petits-déjeuners ajoutés.
     - Si l'utilisateur dit "Pas de porc" -> Mets à jour le profil (update_user_profile) ET rappelle 'propose_meal_plan_concept' avec des repas sans porc.
     - Si l'utilisateur demande "Change le mardi midi par une Pizza" -> Modifie le jour spécifique dans l'outil.

  4. **VALIDATION** : Une fois que l'utilisateur semble satisfait de la semaine type affichée, invite-le à cliquer sur "Valider & Générer le Mois".

  RÈGLES D'OR :
  - Sois force de proposition. Ne dis pas "Que voulez-vous manger ?", dis "Voici une proposition, on l'ajuste ?"
  - Remplis les grammages (lunchWeight, etc.) avec des estimations réalistes.
  - Si aucune date n'est donnée, commence le ${tomorrowDate}.

  PROFIL : ${user.name}, Allergies connues: ${user.exclusions?.join(', ') || 'Aucune'}.
  ${contextStr}
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
          if (!result.suggestedConcept.startDate) {
             result.suggestedConcept.startDate = tomorrowDate;
          }
        }
        if (call.name === 'log_workout') result.actionLog.push({ type: 'workout', data: call.args });
        if (call.name === 'log_hydration') result.actionLog.push({ type: 'hydration', data: call.args });
        if (call.name === 'log_meal') result.actionLog.push({ type: 'meal', data: call.args });
      }
    }

    // Fallback texte si outil activé sans texte
    if (!result.reply && result.suggestedConcept) {
      result.reply = `Voici une première ébauche pour votre semaine ! 🥗\n\nSouhaitez-vous que j'ajoute des **petits-déjeuners** ou des **collations** ? Avez-vous des intolérances particulières ?`;
    } else if (!result.reply) {
      result.reply = "Je mets à jour vos données.";
    }

    return result;

  } catch (error) {
    console.error("Chat error:", error);
    return { 
      reply: "J'ai eu un petit souci de connexion. Pouvez-vous me redire si vous voulez inclure le petit-déjeuner ?" 
    };
  }
};

// --- GÉNÉRATION DU PLAN COMPLET (30 Jours) ---
export const generateMealPlan = async (concept: any, user: User): Promise<MealPlan> => {
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

  const startDate = concept.startDate || new Date().toISOString().split('T')[0];
  
  // Analyse de la structure validée pour la répliquer sur le mois
  const hasBreakfast = concept.weeklyPreview?.some((d: any) => d.breakfast);
  const hasSnack = concept.weeklyPreview?.some((d: any) => d.snack);

  // Construction du résumé pour le prompt
  let previewStr = "STRUCTURE VALIDÉE (SEMAINE TYPE) : \n";
  if (concept.weeklyPreview && Array.isArray(concept.weeklyPreview)) {
      previewStr += concept.weeklyPreview.map((d: any) => 
        `J${d.day}: Matin=${d.breakfast || 'NON'}, Midi=${d.lunch}, Snack=${d.snack || 'NON'}, Soir=${d.dinner}`
      ).join('\n');
  }

  const prompt = `GÉNÈRE LE PLAN FINAL DE 30 JOURS (JSON).
  
  TITRE: ${concept.title}
  INFO: ${concept.description}
  DÉBUT: ${startDate}
  
  ${previewStr}
  
  INSTRUCTIONS STRICTES :
  1. STRUCTURE : ${hasBreakfast ? "GÉNÈRE IMPÉRATIVEMENT un 'breakfast' pour CHAQUE jour du mois." : "NE GÉNÈRE PAS de petit-déjeuner (laisser vide)."}
  2. STRUCTURE : ${hasSnack ? "GÉNÈRE IMPÉRATIVEMENT un 'snack' pour CHAQUE jour du mois." : "NE GÉNÈRE PAS de collation (laisser vide)."}
  3. DIVERSITÉ : Utilise la "Semaine Type" comme base pour le style, mais varie les recettes sur les 30 jours pour ne pas manger la même chose tout le temps, tout en respectant le budget/thème.
  4. EXCLUSIONS : Respecte strictement les allergies : ${user.exclusions?.join(', ') || 'Aucune'}.
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
    
    if(result.recipes) {
        result.recipes.forEach((r: any, idx: number) => {
            if(!r.id) r.id = `rec_${idx}`;
            if(!r.totalWeight) r.totalWeight = "400g";
        });
    }

    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    throw new Error("La génération a échoué. Veuillez réessayer.");
  }
};
