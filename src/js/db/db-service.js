import { getFirebaseApp, isFirebaseConfigured } from '../firebase/firebase-config.js';

let db = null;

async function getDb() {
  if (!db) {
    const app = await getFirebaseApp();
    const { getFirestore } = await import('firebase/firestore');
    db = getFirestore(app);
  }
  return db;
}

export const dbService = {
  isConfigured: isFirebaseConfigured,

  async createUserProfile(uid, { name, email, whatsapp = '' }) {
    const d = await getDb();
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(doc(d, 'users', uid), {
      name,
      email,
      whatsapp,
      role: 'client',
      llm_keys: [],
      createdAt: serverTimestamp(),
    });
  },

  async getUserProfile(uid) {
    const d = await getDb();
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(d, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async updateLlmKeys(uid, keys) {
    const d = await getDb();
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(d, 'users', uid), { llm_keys: keys });
  },

  async addProject(ownerId, { name, url, fileCount }) {
    const d = await getDb();
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    return addDoc(collection(d, 'projects'), {
      ownerId,
      name,
      url,
      fileCount,
      createdAt: serverTimestamp(),
    });
  },

  async listProjects(ownerId) {
    const d = await getDb();
    const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(
      query(collection(d, 'projects'), where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map((s) => ({ id: s.id, ...s.data() }));
  },
};
