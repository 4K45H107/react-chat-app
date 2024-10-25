import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "reactchat-ed5f2.firebaseapp.com",
  projectId: "reactchat-ed5f2",
  storageBucket: "reactchat-ed5f2.appspot.com",
  messagingSenderId: "154253592516",
  appId: "1:154253592516:web:27d64937a8baf2a05e0691",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
