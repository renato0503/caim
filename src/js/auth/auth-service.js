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
};
