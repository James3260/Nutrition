
export class BiometricService {
  /**
   * Vérifie si le navigateur supporte la biométrie et si le contexte est sécurisé
   */
  static isAvailable(): boolean {
    const isSecureContext = window.isSecureContext;
    const hasSupport = !!(window.PublicKeyCredential && 
                        window.crypto && 
                        window.crypto.subtle);
    
    // WebAuthn est souvent bloqué dans les iframes sans permissions explicites
    const isInsideIframe = window.self !== window.top;
    
    return hasSupport && isSecureContext && !isInsideIframe;
  }

  /**
   * Enregistre un nouvel identifiant biométrique
   */
  static async registerBiometrics(userEmail: string): Promise<string | null> {
    if (!this.isAvailable()) {
      console.warn("Biometrics not available in this environment (check HTTPS or Iframe context)");
      return null;
    }

    try {
      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const userId = window.crypto.getRandomValues(new Uint8Array(16));

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "NutriTrack AI",
          id: window.location.hostname || "localhost",
        },
        user: {
          id: userId,
          name: userEmail,
          displayName: userEmail,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      return btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    } catch (err: any) {
      if (err.name === 'SecurityError') {
        console.error("Biometrics blocked by browser security (Ancestors origin mismatch).");
      } else {
        console.error("Biometric Registration Error:", err);
      }
      return null;
    }
  }

  /**
   * Vérifie l'identité via biométrie
   */
  static async authenticate(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const options: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname || "localhost",
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: options,
      });

      return !!assertion;
    } catch (err) {
      console.error("Biometric Authentication Error:", err);
      return false;
    }
  }
}
