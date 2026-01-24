
/**
 * CloudSyncService v10.2 - Google Persistence Layer
 * Synchronisation automatique basée sur l'ID unique Google de l'utilisateur.
 */
export class CloudSyncService {
  private static DATA_KEY = "nutritrack_user_id";

  // ---------------------------------------------------------------------------
  // CONFIGURATION FIREBASE
  // URL fournie par l'utilisateur pour la persistance des données
  // ---------------------------------------------------------------------------
  private static FIREBASE_URL = "https://nutritrack-1aa13-default-rtdb.firebaseio.com"; 

  static init() {
    // Nettoyage des anciens paramètres d'URL si présents
    const params = new URLSearchParams(window.location.search);
    if (params.has('vault')) {
      const vaultId = params.get('vault');
      if (vaultId) this.setUserId(vaultId);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  static isConfigured(): boolean {
    return !!this.getUserId();
  }

  static getUserId(): string | null {
    return localStorage.getItem(this.DATA_KEY);
  }

  static setUserId(id: string) {
    localStorage.setItem(this.DATA_KEY, id);
  }

  static getVaultId(): string | null {
    return this.getUserId();
  }

  static setVaultId(id: string) {
    this.setUserId(id);
  }

  static ensureVaultExists(): Promise<string | null> {
    let id = this.getUserId();
    if (!id) {
      id = "nutri_" + Math.random().toString(36).substr(2, 9);
      this.setUserId(id);
    }
    return Promise.resolve(id);
  }

  static generateMasterLink(): string {
    const id = this.getUserId();
    if (!id) return window.location.origin;
    return `${window.location.origin}?vault=${id}`;
  }

  static exportToFile(data: any) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutritrack_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static disconnect() {
    localStorage.removeItem(this.DATA_KEY);
  }

  /**
   * Pousse les données vers le Cloud Firebase
   */
  static async pushData(data: any): Promise<boolean> {
    const id = this.getUserId();
    if (!id) return false;

    // --- MODE SIMULATION (DEMO) ---
    // Si l'utilisateur n'a pas mis sa propre URL (détecté par le mot "demo" dans l'url par défaut), 
    // on fait semblant que ça marche pour l'UX.
    if (this.FIREBASE_URL.includes("nutritrack-demo-default")) {
       await new Promise(r => setTimeout(r, 800)); 
       return true; 
    }

    try {
      // Nettoyage de l'URL pour éviter les doubles slashs si l'utilisateur en a mis un à la fin
      const baseUrl = this.FIREBASE_URL.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/users/${id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, _last_sync: Date.now() })
      });
      return response.ok;
    } catch (e) {
      console.warn("Cloud Push Fail:", e);
      return false;
    }
  }

  /**
   * Récupère les données depuis le Cloud Firebase
   */
  static async pullData(): Promise<any | null> {
    const id = this.getUserId();
    if (!id) return null;

    if (this.FIREBASE_URL.includes("nutritrack-demo-default")) {
       return null; 
    }

    try {
      const baseUrl = this.FIREBASE_URL.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/users/${id}.json`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.warn("Cloud Pull Fail:", e);
      return null;
    }
  }
}
