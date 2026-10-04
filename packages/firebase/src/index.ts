import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import type { Draft } from '@lipiflow/library';
import { setAccessTokenProvider, setApiOrigin } from '@lipiflow/library/client';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '';
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY ?? '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID ?? '';
export const firebaseConfigured = Boolean(projectId && apiKey && authDomain && appId);
const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId, apiKey, authDomain, appId })
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
const isLoopback = ['127.0.0.1', 'localhost'].includes(globalThis.location?.hostname ?? '');
if (auth && db && isLoopback && import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

setAccessTokenProvider(async () => (auth?.currentUser ? auth.currentUser.getIdToken() : ''));
setApiOrigin(import.meta.env.VITE_LIPIFLOW_API_URL ?? '');

export { onAuthStateChanged, signOut };
export async function signInGoogle() {
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  const provider = new GoogleAuthProvider();
  if (matchMedia('(pointer: coarse)').matches) return signInWithRedirect(auth, provider);
  return signInWithPopup(auth, provider);
}
export async function signInEmail(email: string, password: string) {
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  return signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function createEmailAccount(email: string, password: string) {
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}
export async function resetEmailPassword(email: string) {
  if (!auth) throw new Error('Firebase sign-in is not configured yet.');
  return sendPasswordResetEmail(auth, email.trim());
}
export async function currentAccount(user: User) {
  const { claims } = await user.getIdTokenResult();
  return {
    id: user.uid,
    name: user.displayName || user.email || 'LipiFlow member',
    role: claims.role === 'admin' ? 'admin' : 'user',
    email: user.email ?? '',
  } as const;
}
export async function saveProfile(user: User) {
  if (!db) return;
  await setDoc(
    doc(db, 'profiles', user.uid),
    {
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
export async function readFavourites(uid: string): Promise<string[]> {
  if (!db) return [];
  const result = await getDocs(collection(db, 'users', uid, 'favourites'));
  return result.docs.map((item) => item.id);
}
export async function writeFavourite(uid: string, fontId: string, save: boolean) {
  if (!db) throw new Error('Firebase Firestore is not configured yet.');
  const reference = doc(db, 'users', uid, 'favourites', fontId);
  if (save) await setDoc(reference, { fontId, createdAt: serverTimestamp() });
  else await deleteDoc(reference);
}
export async function readDrafts(uid: string): Promise<Draft[]> {
  if (!db) return [];
  const items = await getDocs(
    query(collection(db, 'users', uid, 'drafts'), orderBy('updatedAt', 'desc')),
  );
  return items.docs.map((item) => {
    const saved = item.data(),
      updated = saved.updatedAt?.toDate?.();
    return {
      id: item.id,
      title: String(saved.title ?? ''),
      text: String(saved.text ?? ''),
      updatedAt: updated instanceof Date ? updated.getTime() : Date.now(),
    };
  });
}
export async function saveDraft(uid: string, title: string, text: string) {
  if (!db) throw new Error('Firebase Firestore is not configured yet.');
  if (!title.trim() || title.length > 100 || text.length > 200_000)
    throw new Error('Draft title or text is too long.');
  if ((await getDocs(query(collection(db, 'users', uid, 'drafts')))).size >= 50)
    throw new Error('Delete a saved draft before adding another.');
  await setDoc(doc(collection(db, 'users', uid, 'drafts')), {
    title: title.trim(),
    text,
    updatedAt: serverTimestamp(),
  });
}
export async function removeDraft(uid: string, id: string) {
  if (!db) throw new Error('Firebase Firestore is not configured yet.');
  await deleteDoc(doc(db, 'users', uid, 'drafts', id));
}
