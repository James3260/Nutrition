
import { GoogleGenAI, Type } from "@google/genai";
import { MealPlan, User } from "../types";

const MEAL_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      description: "A 30-day meal plan",
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
      description: "List of unique recipes used in the plan",
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
                amount: { type: Type.STRING, description: "EXACT portion in grams tailored to user's body" }
              },
              required: ["item", "amount"]
            }
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          calories: { type: Type.INTEGER }
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
    reply: { type: Type.STRING, description: "La réponse naturelle de l'assistant" },
    extractedInfo: {
      type: Type.OBJECT,
      properties: {
        weight: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
        age: { type: Type.NUMBER },
        gender: { type: Type.STRING, enum: ["man", "woman"] },
        baseActivityLevel: { type: Type.STRING, enum: ["sedentary", "light", "moderate", "active", "very_active"] },
        goal: { type: Type.STRING, description: "L'objectif de perte de poids de l'utilisateur" }
      }
    }
  },
  required: ["reply"]
};

export const chatWithAI = async (message: string, user: User): Promise<{ reply: string, extractedInfo?: any }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Tu es NutriTrack, un coach nutritionnel expert. 
  Ton but est d'aider l'utilisateur à perdre du poids. 
  
  CONTEXTE UTILISATEUR :
  - Nom: ${user.name}
  - Profil actuel: ${JSON.stringify({ 
      poids: user.weightHistory?.[user.weightHistory.length-1]?.weight, 
      taille: user.height, 
      age: user.age, 
      activite: user.baseActivityLevel 
    })}
  
  RÈGLES :
  1. Si des informations manquent (poids, taille, âge, sexe, niveau d'activité), pose UNE SEULE question à la fois pour les obtenir.
  2. Sois encourageant et professionnel.
  3. Si l'utilisateur te donne une info, confirme-la et passe à la suivante ou propose de créer le plan si tout est complet.
  4. Réponds TOUJOURS en JSON selon le schéma fourni.`;

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

    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Chat error:", error);
    return { reply: "Désolé, j'ai rencontré une erreur technique. Peux-tu répéter ?" };
  }
};

export const generateMealPlan = async (userPrompt: string, user: User): Promise<MealPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const morphoContext = `
    PROFIL PHYSIQUE : ${user.gender === 'man' ? 'Homme' : 'Femme'}, ${user.age} ans, ${user.height}cm, 
    poids actuel ${user.weightHistory?.[user.weightHistory.length - 1]?.weight || '70'}kg, 
    activité : ${user.baseActivityLevel}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Génère un plan de 30 jours basé sur : "${userPrompt}"\n${morphoContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erreur MealPlan:", error);
    throw error;
  }
};
