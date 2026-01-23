
import { MealPlan, User } from "../types";

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

  static checkAndNotify(mealPlan: MealPlan, user: User) {
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    
    // Heures par défaut si non définies
    const lunchPref = user.lunchTime || "12:00";
    const dinnerPref = user.dinnerTime || "19:00";

    const [lH, lM] = lunchPref.split(':').map(Number);
    const [dH, dM] = dinnerPref.split(':').map(Number);

    let mealType: 'lunch' | 'dinner' | null = null;

    if (currentH === lH && currentM === lM) mealType = 'lunch';
    else if (currentH === dH && currentM === dM) mealType = 'dinner';

    if (mealType) {
      // On calcule le jour du programme (index 0-29)
      const startDate = mealPlan.startDate ? new Date(mealPlan.startDate) : new Date();
      startDate.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayIndex = diffDays % 30;

      const dayData = mealPlan.days[dayIndex];
      if (dayData) {
        const recipeId = mealType === 'lunch' ? dayData.lunch : dayData.dinner;
        const recipe = mealPlan.recipes.find(r => r.id === recipeId);
        
        if (recipe) {
          const title = mealType === 'lunch' ? "🍱 C'est l'heure de votre déjeuner !" : "🌙 C'est l'heure de votre dîner !";
          const body = `Bonjour ${user.name.split(' ')[0]}, au menu : ${recipe.name}. Bon appétit !`;
          this.send(title, body);
        }
      }
    }
  }
}
