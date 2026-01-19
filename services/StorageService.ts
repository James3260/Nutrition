
import { User, MealPlan } from "../types";
import { CloudSyncService } from "./CloudSyncService";

export class StorageService {
  private static DB_NAME = "NutriTrackDB";
  private static STORE_NAME = "AppData";

  static async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error("IndexedDB Error:", request.error);
          reject(request.error);
        };
        request.onblocked = () => {
          console.warn("IndexedDB blocked. Please close other tabs of this app.");
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  static async saveData(key: string, data: any): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, "readwrite");
        const store = transaction.objectStore(this.STORE_NAME);
        store.put(data, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.warn("Could not save to IndexedDB, falling back to local storage", e);
      localStorage.setItem(`fallback_${key}`, JSON.stringify(data));
    }
  }

  static async loadData(key: string): Promise<any> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, "readonly");
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Could not load from IndexedDB, falling back to local storage", e);
      const fallback = localStorage.getItem(`fallback_${key}`);
      return fallback ? JSON.parse(fallback) : null;
    }
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
    const cloudConfig = CloudSyncService.getConfig();
    const fullPayload = { ...data, cloudConfig };
    const json = JSON.stringify(fullPayload);
    // Use encodeURIComponent to handle special characters in base64 safely
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
