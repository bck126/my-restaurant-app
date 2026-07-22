import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ชุด Config จาก Firebase ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyDDfwPHQOoS1MDse4EH93ztwg2OLW805qs",
  authDomain: "my-restaurant-app-c5c12.firebaseapp.com",
  projectId: "my-restaurant-app-c5c12",
  storageBucket: "my-restaurant-app-c5c12.firebasestorage.app",
  messagingSenderId: "1017880090435",
  appId: "1:1017880090435:web:ce7abb74ab0b1750af01f6"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
