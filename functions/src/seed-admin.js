// CAIM — seed-admin.js
// Define um usuário como OWNER (admin da plataforma) no Firestore.
//
// Uso (o UID entra por variável de ambiente — NUNCA commitar secrets):
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\service-account.json
//   set CAIM_ADMIN_UID=<SEU_UID_FIREBASE>
//   npm run seed:admin
//
// Depois, dentro do app, logar com a conta e adicionar a API LLM em
// Configurações (a chave é cifrada e salva em users/{uid}/llm_keys).

const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.applicationDefault() });

const uid = process.env.CAIM_ADMIN_UID;
if (!uid) {
  console.error('Faltou CAIM_ADMIN_UID. Exporte a variável antes de rodar.');
  process.exit(1);
}

(async () => {
  const db = admin.firestore();
  const docRef = db.doc(`users/${uid}`);
  const snap = await docRef.get();
  const data = snap.exists ? snap.data() : {};
  await docRef.set({ ...data, role: 'owner' }, { merge: true });
  console.log(`OK: users/${uid} agora é OWNER.`);
  process.exit(0);
})().catch((err) => {
  console.error('Falha ao definir admin:', err.message);
  process.exit(1);
});
