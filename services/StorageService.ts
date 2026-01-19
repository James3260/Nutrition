
import { User, MealPlan } from "../types";
import { CloudSyncService } from "./CloudSyncService";

export class StorageService {
  private static DB_NAME = "NutriTrackDB";
  private static STORE_NAME = "AppData";

  static async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async saveData(key: string, data: any): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      store.put(data, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async loadData(key: string): Promise<any> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async maintenance(user: User): Promise<User> {
    const updatedUser = { ...user };
    const MAX_HISTORY = 365;
    if (updatedUser.weightHistory && updatedUser.weightHistory.length > MAX_HISTORY) {
      updatedUser.weightHistory = updatedUser.weightHistory.slice(-MAX_HISTORY);
    }
    if (updatedUser.workouts && updatedUser.workouts.length > MAX_HISTORY) {
      updatedUser.workouts = updatedUser.workouts.slice(-MAX_HISTORY);
    }
    return updatedUser;
  }

  static generateSyncLink(data: any): string {
    // On ajoute la config cloud pour que le lien configure automatiquement le nouveau navigateur
    const cloudConfig = CloudSyncService.getConfig();
    const fullPayload = { ...data, cloudConfig };
    const json = JSON.stringify(fullPayload);
    const base64 = btoa(encodeURIComponent(json));
    return `${window.location.origin}${window.location.pathname}#sync=${base64}`;
  }

  static decodeSyncLink(hash: string): any {
    try {
      const base64 = hash.replace("#sync=", "");
      const json = decodeURIComponent(atob(base64));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
}
