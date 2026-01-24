
export interface Ingredient {
  item: string;
  amount: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  steps: string[];
  calories: number;
  totalWeight?: string; // Nouveau : Poids total de l'assiette (ex: "450g")
}

export interface DayPlan {
  day: number;
  breakfast?: string;
  lunch: string;
  snack?: string;
  dinner: string;
}

export interface MealPlan {
  days: DayPlan[];
  recipes: Recipe[];
  startDate?: string; // Date ISO du début du programme
}

export interface WorkoutSession {
  id: string;
  date: string;
  type: string;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  caloriesBurned: number;
  // Nouveaux champs détaillés
  distance?: number;   // km
  elevation?: number;  // m (dénivelé)
  sets?: number;       // Séries
  reps?: number;       // Répétitions
  weightLoad?: number; // Charge en kg
}

export interface WeightRecord {
  date: string;
  weight: number;
}

export interface HydrationRecord {
  date: string;
  amount: number;
}

export interface EatenMealRecord {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;      // Nom du plat (ex: "Salade César")
  calories: number;  // Calories réelles ou estimées par IA
  recipeId?: string; // Optionnel : lien vers une recette du plan
  imageUrl?: string; // Optionnel : photo du repas
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  type: 'system' | 'meal' | 'profile' | 'sport' | 'admin';
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  picture?: string;
  googleId?: string;
  role: 'admin' | 'user';
  status: 'authorized' | 'pending';
  isAuthenticated: boolean;
  biometricId?: string;
  exclusions?: string[];
  workouts?: WorkoutSession[];
  weightHistory?: WeightRecord[];
  weightGoal?: number;
  hydrationGoal?: number;
  hydrationRecords?: HydrationRecord[];
  eatenMeals?: EatenMealRecord[];
  height?: number;
  age?: number;
  gender?: 'man' | 'woman';
  baseActivityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  // Nouvelles préférences de notifications
  lunchTime?: string; // format "HH:mm"
  dinnerTime?: string; // format "HH:mm"
}

export type Tab = 'daily' | 'assistant' | 'calendar' | 'shopping' | 'recipes' | 'sport' | 'admin';
