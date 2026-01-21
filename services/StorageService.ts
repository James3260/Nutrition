
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
        request.onerror = () => reject(request.error);
        request.onblocked = () => console.warn("IndexedDB blocked");
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
      const fallback = localStorage.getItem(`fallback_${key}`);
      return fallback ? JSON.parse(fallback) : null;
    }
  }

  /**
   * Utilise maintenant le lien de production stable
   */
  static generateSyncLink(): string {
    return CloudSyncService.generateMasterLink();
  }
}
