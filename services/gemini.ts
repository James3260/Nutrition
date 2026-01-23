
import { GoogleGenAI, Type } from "@google/genai";
import { MealPlan, User } from "../types";

const MEAL_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      description: "A 30-day meal plan based on the user's specific request and start date",
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.INTEGER },
          lunch: { type: Type.STRING, description: "ID of the lunch recipe" },
          dinner: { type: Type.STRING, description: "ID of the dinner recipe" }
        },
        required: ["day", "lunch", "dinner"]
      }
    },
    recipes: {
      type: Type.ARRAY,
      description: "List of unique recipes with custom portions (grams) calculated for the user",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                amount: { type: Type.STRING, description: "Portion EXACTE en grammes (ex: '150g') calculée selon le BMR de l'utilisateur" }
              },
              required: ["item", "amount"]
            }
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          calories: { type: Type.INTEGER, description: "Total calories for this specific portion" }
        },
        required: ["id", "name", "ingredients", "steps", "calories"]
      }
    }
  },
  required: ["days", "recipes"]
};

const CHAT_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING, description: "La réponse naturelle et encourageante du coach" },
    readyToGenerate: { type: Type.BOOLEAN, description: "Passer à TRUE uniquement quand l'utilisateur a validé le concept et fourni toutes les infos (poids, taille, âge, date début)" },
    suggestedConcept: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING, description: "Résumé du type de cuisine et de la stratégie calorique" },
        exampleMeals: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    extractedInfo: {
      type: Type.OBJECT,
      properties: {
        weight: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
        age: { type: Type.NUMBER },
        gender: { type: Type.STRING, enum: ["man", "woman"] },
        baseActivityLevel: { type: Type.STRING, enum: ["sedentary", "light", "moderate", "active", "very_active"] },
        goal: { type: Type.STRING },
        startDate: { type: Type.STRING, description: "La date de début souhaitée" },
        exclusions: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    }
  },
  required: ["reply"]
};

export const chatWithAI = async (message: string, user: User, chatHistory: any[]): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Tu es l'Expert NutriTrack Crystal, le coach nutritionnel le plus avancé.
  Ta mission : Créer un plan de 30 jours 100% personnalisé pour la perte de poids.
  
  PROTOCOLE OBLIGATOIRE :
  1. ANALYSE PHYSIQUE : Si manquant, demande : Poids, Taille, Âge, Sexe. (Crucial pour le BMR).
  2. PRÉFÉRENCES : Demande les goûts, allergies et ce qu'il déteste.
  3. LOGISTIQUE : Demande la date de début souhaitée, le nombre de repas par jour et si les repas peuvent être répétés (ex: cuisiner pour 2 jours).
  4. CONCEPT : Une fois les infos reçues, propose un "Concept de Plan" (ex: Méditerranéen, 1600kcal) et demande "Es-tu d'accord pour que je génère ce plan de 30 jours ?".
  5. GÉNÉRATION : Ne déclenche 'readyToGenerate' que si l'utilisateur dit OUI/VALIDÉ après ton concept.

  TON TON : Professionnel, bienveillant, expert.
  
  DONNÉES UTILISATEUR : ${JSON.stringify(user)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: CHAT_EXTRACTION_SCHEMA,
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Chat error:", error);
    return { reply: "Une erreur est survenue, veuillez réessayer." };
  }
};

export const generateMealPlan = async (userContext: any, user: User): Promise<MealPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `GÉNÈRE UN PLAN DE 30 JOURS COMPLET.
  Utilisateur : ${user.name}, ${user.gender}, ${user.age} ans, ${user.height}cm, ${user.weightHistory?.[user.weightHistory.length-1]?.weight}kg.
  Contexte additionnel : ${JSON.stringify(userContext)}
  
  RÈGLES STRICTES :
  1. Calcule le BMR et ajuste chaque grammage d'ingrédient pour créer un déficit calorique sain (env -300 à -500 kcal).
  2. Chaque recette doit avoir des quantités en GRAMMES (ex: 125g de poulet, 60g de riz cru).
  3. Le plan doit durer exactement 30 jours.
  4. Respecte les exclusions alimentaires mentionnées.`;

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
    // Ajouter la date de début extraite ou aujourd'hui par défaut
    result.startDate = userContext.startDate || new Date().toISOString();
    return result;
  } catch (error) {
    console.error("Erreur Planification:", error);
    throw error;
  }
};
