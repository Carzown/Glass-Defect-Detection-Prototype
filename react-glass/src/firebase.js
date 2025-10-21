// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getDatabase, ref, set, get, child } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCqsLsSLk9w-7utZtme1xgfypZO6UFFqhA",
  authDomain: "glass-defect-detection.firebaseapp.com",
  databaseURL: "https://glass-defect-detection-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "glass-defect-detection",
  storageBucket: "glass-defect-detection.firebasestorage.app",
  messagingSenderId: "1046439055879",
  appId: "1:1046439055879:web:94b3a479f3acbb4ca010a2",
  measurementId: "G-K4TT0Y6KFF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export async function createUserWithRole(email, password, role) {
  // Creates a Firebase Auth user and stores role in Realtime DB
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await set(ref(db, `users/${uid}`), { email, role });
  return { uid, email, role };
}

export async function signInAndGetRole(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const snap = await get(child(ref(db), `users/${uid}`));
  const role = snap.exists() ? snap.val().role : undefined;
  return { uid, email: cred.user.email, role };
}

export async function getRole(uid) {
  const snap = await get(child(ref(db), `users/${uid}`));
  return snap.exists() ? snap.val().role : undefined;
}

export async function signOutUser() {
  await signOut(auth);
}
