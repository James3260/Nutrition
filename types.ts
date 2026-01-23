
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
}

export interface DayPlan {
  day: number;
  lunch: string;
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
  date: string;
  mealType: 'lunch' | 'dinner';
  recipeId: string;
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
  picture?: string; // Ajouté pour Google
  googleId?: string; // Ajouté pour Google
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
}

export type Tab = 'daily' | 'assistant' | 'calendar' | 'shopping' | 'recipes' | 'sport' | 'admin';
