import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let app;
let auth;
let db;

if (
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
) {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Set persistence to LOCAL to persist user across sessions
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting persistence:', error);
  });
} else {
  console.warn(
    'Firebase is not configured. Set REACT_APP_FIREBASE_* environment variables to enable authentication.'
  );
  // Provide stub objects so app can run without Firebase
  auth = {
    currentUser: null,
  };
  db = null;
}

export { auth, db, app };

// Authentication functions for Firebase
export async function signInWithEmail(email, password) {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signUpWithEmail(email, password) {
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signOut() {
  const { signOut: firebaseSignOut } = await import('firebase/auth');
  await firebaseSignOut(auth);
}

export async function getCurrentUser() {
  return auth.currentUser;
}

// User role management functions (Firestore)
export async function createUserWithRole(email, password, role) {
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const { setDoc, doc } = await import('firebase/firestore');

  // Create user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  // Store user role in Firestore
  await setDoc(doc(db, 'profiles', userCredential.user.uid), {
    id: userCredential.user.uid,
    email: userCredential.user.email,
    role: role,
    createdAt: new Date(),
  });

  return {
    uid: userCredential.user.uid,
    email: userCredential.user.email,
    role,
  };
}

export async function signInAndGetRole(email, password) {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const { getDoc, doc } = await import('firebase/firestore');

  // Sign in user
  const userCredential = await signInWithEmailAndPassword(auth, email, password);

  // Get user role from Firestore
  try {
    const docSnap = await getDoc(doc(db, 'profiles', userCredential.user.uid));
    if (docSnap.exists()) {
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        role: docSnap.data().role,
      };
    } else {
      // Default to employee if no profile exists
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        role: 'employee',
      };
    }
  } catch (error) {
    console.error('Error fetching user role:', error);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      role: 'employee',
    };
  }
}

export async function getRole(uid) {
  const { getDoc, doc } = await import('firebase/firestore');

  try {
    const docSnap = await getDoc(doc(db, 'profiles', uid));
    if (docSnap.exists()) {
      return docSnap.data().role;
    }
    return undefined;
  } catch (error) {
    console.error('Error fetching role:', error);
    return undefined;
  }
}

export async function signOutUser() {
  await signOut();
}
