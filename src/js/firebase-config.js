import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA2VTK8v4cdtl1je_-ip8qYxSvO8mDjZrc",
  authDomain: "cerraimobile.firebaseapp.com",
  projectId: "cerraimobile",
  storageBucket: "cerraimobile.firebasestorage.app",
  messagingSenderId: "600754439954",
  appId: "1:600754439954:web:25aa0e9980d2625b5a95cb",
  measurementId: "G-6XGDL1DDTJ"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics, firebaseConfig };
