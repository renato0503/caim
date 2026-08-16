/**
 * Configuração do Firebase (projeto real: cerraimobile).
 * Habilite Authentication (Email/Senha) e Firestore no console para o
 * fluxo completo (login, dashboard, deploy). O valor é público (client-side).
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyA2VTK8v4cdtl1je_-ip8qYxSvO8mDjZrc',
  authDomain: 'cerraimobile.firebaseapp.com',
  projectId: 'cerraimobile',
  storageBucket: 'cerraimobile.firebasestorage.app',
  messagingSenderId: '600754439954',
  appId: '1:600754439954:web:25aa0e9980d2625b5a95cb',
  // S11: Firebase App Check (reCAPTCHA Enterprise). Ative preenchendo a site key
  // em https://console.firebase.google.com/project/cerraimobile/appcheck
  appCheckSiteKey: '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.projectId &&
    !firebaseConfig.projectId.startsWith('YOUR_') &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith('YOUR_')
);

let appInstance = null;

export async function getFirebaseApp() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase não configurado — preencha src/js/firebase/firebase-config.js');
  }
  if (!appInstance) {
    const { initializeApp } = await import('firebase/app');
    appInstance = initializeApp(firebaseConfig);
    if (firebaseConfig.appCheckSiteKey) {
      // S11: App Check com reCAPTCHA Enterprise (hardening pré-Go-Live)
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      initializeAppCheck(appInstance, {
        provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  }
  return appInstance;
}

export function deployFunctionUrl(name = 'githubDeployProxy') {
  return `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/${name}`;
}
