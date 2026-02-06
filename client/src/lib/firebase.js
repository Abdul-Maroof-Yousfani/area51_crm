import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBwQsjNBEMOYavhGC660Q4pmng1oCofh8o",
  authDomain: "area-51-crm.firebaseapp.com",
  projectId: "area-51-crm",
  storageBucket: "area-51-crm.firebasestorage.app",
  messagingSenderId: "438467751802",
  appId: "1:438467751802:web:7c2256f6bf0e88487f30c3",
  measurementId: "G-6HZKZC5TKX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const appId = 'crm_v1_production';

export default app;
