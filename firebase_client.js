import { CFG, getCompanyId } from "./app.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

export const fbApp = initializeApp(CFG.firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);

// Best-effort Offline mode (PWA + Firestore persistence)
try{
  await enableIndexedDbPersistence(db);
}catch(e){
  // Multiple tabs or unsupported browser; ignore.
}

export const companyRef = ()=> doc(db, "companies", getCompanyId());
export const companyCol = (name)=> collection(db, "companies", getCompanyId(), name);

export async function ensureCompanySeed(){
  // Minimal seed to avoid empty state.
  const ref = companyRef();
  const snap = await getDoc(ref);
  if(snap.exists()) return;
  await setDoc(ref, {
    name: "Main Company",
    baseCurrency: CFG.DEFAULT_BASE_CURRENCY,
    createdAt: serverTimestamp(),
    version: "2.0"
  });
}

export function requireAuth(onAuthed){
  return onAuthStateChanged(auth, async (user)=>{
    if(!user){
      location.href = "login.html";
      return;
    }
    await ensureCompanySeed();
    onAuthed(user);
  });
}

export async function logout(){
  await signOut(auth);
  location.href = "login.html";
}
