
import { User, MealPlan } from "../types";
import { StorageService } from "./StorageService";

interface CloudConfig {
  url: string;
  key: string;
}

export class CloudSyncService {
  private static CONFIG_KEY = "nutritrack_cloud_config";
  private static cachedConfig: CloudConfig | null = null;

  static async init() {
    const saved = await StorageService.loadData(this.CONFIG_KEY);
    if (saved) this.cachedConfig = saved;
  }

  static async setConfig(url: string, key: string) {
    this.cachedConfig = { url, key };
    await StorageService.saveData(this.CONFIG_KEY, { url, key });
  }

  static getConfig(): CloudConfig | null {
    return this.cachedConfig;
  }

  static isConfigured(): boolean {
    return !!this.cachedConfig;
  }

  static async pushData(userId: string, data: any): Promise<boolean> {
    const config = this.getConfig();
    if (!config) return false;

    try {
      const response = await fetch(`${config.url}/rest/v1/backups?email=eq.${userId}`, {
        method: 'POST',
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          email: userId,
          payload: data,
          updated_at: new Date().toISOString()
        })
      });
      return response.ok;
    } catch (e) {
      console.error("Cloud Push Error:", e);
      return false;
    }
  }

  static async pullData(userId: string): Promise<any | null> {
    const config = this.getConfig();
    if (!config) return null;

    try {
      const response = await fetch(`${config.url}/rest/v1/backups?email=eq.${userId}&select=payload`, {
        method: 'GET',
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`,
        }
      });
      const result = await response.json();
      return result?.[0]?.payload || null;
    } catch (e) {
      console.error("Cloud Pull Error:", e);
      return null;
    }
  }

  static generateSetupLink(): string {
    const config = this.getConfig();
    if (!config) return "";
    const payload = btoa(JSON.stringify({ cloudConfig: config }));
    return `${window.location.origin}${window.location.pathname}#setup=${payload}`;
  }
}
