
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
  // Vérification de sécurité pour aider au débogage
  if (!process.env.API_KEY) {
    console.error("API_KEY manquante");
    return { 
      reply: "⚠️ Configuration requise : La clé API Google (API_KEY) est absente. Veuillez l'ajouter dans les variables d'environnement de votre projet Vercel." 
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Tu es l'Expert NutriTrack Crystal, le coach nutritionnel le plus avancé.
  Ta mission : Créer un plan de 30 jours 100% personnalisé pour la perte de poids.
  
  PROTOCOLE OBLIGATOIRE :
  1. ANALYSE PHYSIQUE : Si manquant, demande : Poids, Taille, Âge, Sexe. (Crucial pour le BMR).
  2. PRÉFÉRENCES : Demande les goûts, allergies et ce qu'il déteste.
  3. LOGISTIQUE : Demande la date de début souhaitée.
  4. CONCEPT : Une fois les infos reçues, propose un "Concept de Plan" et demande validation.
  5. GÉNÉRATION : Ne déclenche 'readyToGenerate' que si l'utilisateur valide explicitement.

  TON TON : Professionnel, bienveillant, expert, concis (style SMS).
  
  DONNÉES UTILISATEUR : ${JSON.stringify({
    name: user.name,
    age: user.age,
    gender: user.gender,
    weight: user.weightHistory?.[user.weightHistory.length-1]?.weight,
    height: user.height
  })}`;

  // Conversion de l'historique pour le SDK (mapping 'assistant' -> 'model')
  const historyContents = chatHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Ajout du message actuel
  const contents = [
    ...historyContents,
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: CHAT_EXTRACTION_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    return JSON.parse(text);

  } catch (error) {
    console.error("Chat error:", error);
    // Fallback gracieux en cas d'erreur technique
    return { 
      reply: "Désolé, j'ai eu un petit vertige numérique. Pouvez-vous reformuler ?" 
    };
  }
};

export const generateMealPlan = async (userContext: any, user: User): Promise<MealPlan> => {
  if (!process.env.API_KEY) throw new Error("API Key manquante");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `GÉNÈRE UN PLAN DE 30 JOURS COMPLET.
  Utilisateur : ${user.name}, ${user.gender || 'non spécifié'}, ${user.age || 30} ans, ${user.height || 170}cm, ${user.weightHistory?.[user.weightHistory.length-1]?.weight || 70}kg.
  Contexte additionnel : ${JSON.stringify(userContext)}
  
  RÈGLES STRICTES :
  1. Calcule le BMR et ajuste chaque grammage d'ingrédient pour créer un déficit calorique sain (env -300 à -500 kcal).
  2. Chaque recette doit avoir des quantités en GRAMMES (ex: 125g de poulet, 60g de riz cru).
  3. Le plan doit durer exactement 30 jours.
  4. Respecte les exclusions alimentaires mentionnées.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Modèle plus puissant pour la génération complexe
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
