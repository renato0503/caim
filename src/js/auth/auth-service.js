import { getFirebaseApp, isFirebaseConfigured } from '../firebase/firebase-config.js';
import { dbService } from '../db/db-service.js';

let auth = null;

async function getAuth() {
  if (!auth) {
    const app = await getFirebaseApp();
    const { getAuth } = await import('firebase/auth');
    auth = getAuth(app);
  }
  return auth;
}

export const authService = {
  isConfigured: isFirebaseConfigured,

  currentUser() {
    return auth?.currentUser || null;
  },

  async onAuthStateChanged(cb) {
    if (!isFirebaseConfigured) {
      cb(null);
      return () => {};
    }
    const a = await getAuth();
    return a.onAuthStateChanged(cb);
  },

  async signup({ name, email, password, whatsapp }) {
    const a = await getAuth();
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const cred = await createUserWithEmailAndPassword(a, email, password);
    await updateProfile(cred.user, { displayName: name });
    await dbService.createUserProfile(cred.user.uid, { name, email, whatsapp });
    return cred.user;
  },

  async login(email, password) {
    const a = await getAuth();
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const cred = await signInWithEmailAndPassword(a, email, password);
    return cred.user;
  },

  async logout() {
    if (!auth) return;
    const a = await getAuth();
    const { signOut } = await import('firebase/auth');
    return signOut(a);
  },

  async getIdToken() {
    const user = this.currentUser();
    if (!user) return null;
    return user.getIdToken();
  },

  // S20: recuperação de senha (link por email)
  async sendPasswordReset(email) {
    const a = await getAuth();
    const { sendPasswordResetEmail } = await import('firebase/auth');
    return sendPasswordResetEmail(a, email);
  },

  // S20: reenvio do link de verificação de email
  async sendEmailVerification() {
    const user = this.currentUser();
    if (!user) return null;
    const { sendEmailVerification } = await import('firebase/auth');
    return sendEmailVerification(user);
  },

  // S20: o email foi verificado?
  isEmailVerified() {
    const user = this.currentUser();
    return !!user?.emailVerified;
  },

  // S20: mapeia erros de auth que exigem ação do usuário (token expirado/desativado)
  friendlyAuthError(error) {
    const code = error?.code || '';
    const map = {
      'auth/email-already-in-use': 'Este email já está cadastrado.',
      'auth/invalid-credential': 'Email ou senha incorretos.',
      'auth/wrong-password': 'Email ou senha incorretos.',
      'auth/user-not-found': 'Email não cadastrado.',
      'auth/weak-password': 'Senha muito fraca (mín. 6 caracteres).',
      'auth/invalid-email': 'Email inválido.',
      'auth/user-token-expired': 'Sessão expirada. Entre novamente para continuar.',
      'auth/user-disabled': 'Esta conta foi desativada. Contate o suporte.',
      'auth/network-request-failed': 'Sem conexão. Verifique sua internet e tente de novo.',
    };
    return map[code] || error?.message || 'Falha na autenticação.';
  },
};
