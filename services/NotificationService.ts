
import { MealPlan } from "../types";

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.log("Ce navigateur ne supporte pas les notifications bureau");
      return false;
    }

    if (Notification.permission === "granted") return true;

    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  static send(title: string, body: string) {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "https://cdn-icons-png.flaticon.com/512/706/706164.png",
      });
    }
  }

  static checkAndNotify(mealPlan: MealPlan, userName: string) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dayOfMonth = (now.getDate() - 1) % 30;

    const LUNCH_TIME = { h: 12, m: 0 };
    const DINNER_TIME = { h: 19, m: 0 };

    let mealType: 'lunch' | 'dinner' | null = null;

    if (hours === LUNCH_TIME.h && minutes === LUNCH_TIME.m) mealType = 'lunch';
    if (hours === DINNER_TIME.h && minutes === DINNER_TIME.m) mealType = 'dinner';

    if (mealType && mealPlan.days[dayOfMonth]) {
      const recipeId = mealPlan.days[dayOfMonth][mealType];
      const recipe = mealPlan.recipes.find(r => r.id === recipeId);
      
      if (recipe) {
        const title = mealType === 'lunch' ? "🍱 C'est l'heure du déjeuner !" : "🌙 C'est l'heure du dîner !";
        const body = `Bonjour ${userName}, votre repas prévu est : ${recipe.name}. Bon appétit !`;
        this.send(title, body);
      }
    }
  }
}
