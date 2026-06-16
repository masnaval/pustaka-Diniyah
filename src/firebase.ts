import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  query,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  where,
  Timestamp,
  writeBatch,
  ref,
  uploadBytes,
  getDownloadURL
};
export type { User };
