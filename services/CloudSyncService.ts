
/**
 * CloudSyncService v8.1 - Resilience Layer
 * Gère la synchronisation Firebase avec sécurité renforcée.
 */
export class CloudSyncService {
  private static DATA_KEY = "nutritrack_vault_id";
  // REMPLACEZ PAR VOTRE URL FIREBASE (ex: https://votre-projet.firebaseio.com)
  private static FIREBASE_URL = "https://nutritrack-v7-default-rtdb.europe-west1.firebasedatabase.app";

  static async init() {
    const params = new URLSearchParams(window.location.search);
    const vaultId = params.get('vault');
    if (vaultId) {
      this.setVaultId(vaultId);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Fixed: Added missing ensureVaultExists method for SyncModal.tsx
  static async ensureVaultExists(): Promise<string | null> {
    let id = this.getVaultId();
    if (!id) {
      // Create a unique vault ID if none exists in storage
      id = `vault_${Math.random().toString(36).substring(2, 10)}`;
      this.setVaultId(id);
    }
    return id;
  }

  static isUrlValid(): boolean {
    return !this.FIREBASE_URL.includes("default-rtdb");
  }

  static generateMasterLink(): string {
    const id = this.getVaultId();
    if (!id) return window.location.origin;
    return `${window.location.origin}?vault=${id}`;
  }

  static deriveVaultIdFromEmail(email: string): string {
    const sanitized = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `user_${sanitized}`;
  }

  static getVaultId(): string | null {
    return localStorage.getItem(this.DATA_KEY);
  }

  static setVaultId(id: string) {
    localStorage.setItem(this.DATA_KEY, id);
  }

  static isConfigured(): boolean {
    return !!this.getVaultId() && this.isUrlValid();
  }

  static disconnect() {
    localStorage.removeItem(this.DATA_KEY);
  }

  static async pushData(data: any): Promise<boolean> {
    const id = this.getVaultId();
    if (!id || !this.isUrlValid()) return false;

    try {
      const response = await fetch(`${this.FIREBASE_URL}/${id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, _last_sync: Date.now() })
      });
      return response.ok;
    } catch (e) {
      console.warn("Cloud Sync Fail (Silently falling back to local)");
      return false;
    }
  }

  static async pullData(): Promise<any | null> {
    const id = this.getVaultId();
    if (!id || !this.isUrlValid()) return null;

    try {
      const response = await fetch(`${this.FIREBASE_URL}/${id}.json`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  static exportToFile(data: any) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutritrack_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
