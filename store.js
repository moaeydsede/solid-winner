import { companyCol, companyRef, db } from "./firebase_client.js";
import { n, periodFromDate, uuid } from "./app.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// -----------------------------
// Settings
// -----------------------------
export async function getCompanySettings(){
  const snap = await getDoc(companyRef());
  return snap.exists() ? snap.data() : { baseCurrency: "EGP" };
}

export async function getBaseCurrency(){
  const s = await getCompanySettings();
  return s.baseCurrency || "EGP";
}

// -----------------------------
// Chart of Accounts
// -----------------------------
export async function listCOA(){
  const q0 = query(companyCol("chartOfAccounts"), orderBy("code"));
  const snap = await getDocs(q0);
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}

export async function upsertAccount(acc){
  const id = acc.id || uuid("acc");
  const ref = doc(companyCol("chartOfAccounts"), id);
  await setDoc(ref, {
    code: String(acc.code||"").trim(),
    name: String(acc.name||"").trim(),
    type: String(acc.type||"").trim(),
    parentId: acc.parentId || "",
    isCash: !!acc.isCash,
    isAR: !!acc.isAR,
    isAP: !!acc.isAP,
    isInventory: !!acc.isInventory,
    isFxMonetary: !!acc.isFxMonetary,
    updatedAt: serverTimestamp(),
  }, {merge:true});
  return id;
}

export async function deleteAccount(id){
  await deleteDoc(doc(companyCol("chartOfAccounts"), id));
}

// -----------------------------
// Period close
// -----------------------------
export async function isPeriodClosed(period){
  const ref = doc(companyCol("periodClosings"), period);
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function closePeriod(period, userUid, notes=""){
  const ref = doc(companyCol("periodClosings"), period);
  await setDoc(ref, {
    period,
    closedAt: serverTimestamp(),
    closedBy: userUid,
    notes: String(notes||"")
  }, {merge:true});
}

export async function reopenPeriod(period){
  // Admin only action; deletes closing doc.
  await deleteDoc(doc(companyCol("periodClosings"), period));
}

// -----------------------------
// Exchange rates
// -----------------------------
export async function setFxRate(date, currency, rateToBase){
  const id = `${String(date).slice(0,10)}_${String(currency).toUpperCase()}`;
  await setDoc(doc(companyCol("exchangeRates"), id), {
    date: String(date).slice(0,10),
    currency: String(currency).toUpperCase(),
    rateToBase: n(rateToBase),
    updatedAt: serverTimestamp(),
  }, {merge:true});
}

export async function getFxRate(date, currency){
  const id = `${String(date).slice(0,10)}_${String(currency).toUpperCase()}`;
  const snap = await getDoc(doc(companyCol("exchangeRates"), id));
  if(snap.exists()) return n(snap.data().rateToBase);
  return 1;
}

// -----------------------------
// Journal entries (pagination)
// -----------------------------
export async function listJournalEntries({ from, to, pageSize=100, cursor=null }={}){
  let q0 = query(companyCol("journalEntries"), orderBy("date"), orderBy("createdAt"), limit(pageSize));
  if(from) q0 = query(companyCol("journalEntries"), where("date", ">=", from), orderBy("date"), orderBy("createdAt"), limit(pageSize));
  if(from && to) q0 = query(companyCol("journalEntries"), where("date", ">=", from), where("date", "<=", to), orderBy("date"), orderBy("createdAt"), limit(pageSize));
  if(cursor) q0 = query(q0, startAfter(cursor));
  const snap = await getDocs(q0);
  const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length-1] : null;
  return { rows, nextCursor };
}

export async function getJournalLinesForEntry(jeId){
  const q0 = query(collection(db, companyCol("journalEntries").path, jeId, "lines"), orderBy("lineNo"));
  const snap = await getDocs(q0);
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}

export async function createJournalEntry(je, lines, {duplicateRefPolicy="block"}={}){
  // Duplicate detection (by ref + date + currency)
  const refKey = String(je.ref||"").trim();
  if(refKey){
    const qDup = query(companyCol("journalEntries"), where("ref", "==", refKey), where("date", "==", je.date), limit(1));
    const dup = await getDocs(qDup);
    if(!dup.empty && duplicateRefPolicy==="block"){
      throw new Error("Duplicate detected: نفس المرجع موجود بالفعل لهذا التاريخ.");
    }
  }

  const period = je.period || periodFromDate(je.date);
  if(await isPeriodClosed(period)) throw new Error(`الفترة ${period} مقفلة ولا يمكن التسجيل بها.`);

  const jeRef = await addDoc(companyCol("journalEntries"), {
    date: String(je.date).slice(0,10),
    period,
    currency: String(je.currency||"EGP").toUpperCase(),
    fxRate: n(je.fxRate || 1),
    memo: String(je.memo||""),
    ref: String(je.ref||""),
    status: String(je.status||"posted"),
    source: je.source || {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  const linesCol = collection(db, companyCol("journalEntries").path, jeRef.id, "lines");
  lines.forEach((l, idx)=>{
    const ref = doc(linesCol);
    batch.set(ref, {
      lineNo: idx+1,
      accountId: l.accountId,
      debit: n(l.debit||0),
      credit: n(l.credit||0),
      baseDebit: n(l.baseDebit ?? l.debit ?? 0),
      baseCredit: n(l.baseCredit ?? l.credit ?? 0),
      departmentId: l.departmentId || "",
      entityType: l.entityType || "",
      entityId: l.entityId || "",
      docId: l.docId || "",
      memo: l.memo || "",
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return jeRef.id;
}

// -----------------------------
// Documents (header + lines)
// -----------------------------
export async function createDocument(doc0, lines){
  const period = doc0.period || periodFromDate(doc0.date);
  if(await isPeriodClosed(period)) throw new Error(`الفترة ${period} مقفلة ولا يمكن التسجيل بها.`);
  const docRef = await addDoc(companyCol("documents"), {
    docType: String(doc0.docType||"").toLowerCase(),
    date: String(doc0.date).slice(0,10),
    period,
    currency: String(doc0.currency||"EGP").toUpperCase(),
    fxRate: n(doc0.fxRate || 1),
    counterpartyType: String(doc0.counterpartyType||""),
    counterpartyId: String(doc0.counterpartyId||""),
    ref: String(doc0.ref||""),
    memo: String(doc0.memo||""),
    status: String(doc0.status||"posted"),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const batch = writeBatch(db);
  const linesCol = collection(db, companyCol("documents").path, docRef.id, "documentLines");
  lines.forEach((l, idx)=>{
    batch.set(doc(linesCol), {
      lineNo: idx+1,
      description: String(l.description||""),
      qty: n(l.qty||1),
      unitPrice: n(l.unitPrice||0),
      amount: n(l.amount ?? (n(l.qty||1)*n(l.unitPrice||0))),
      accountId: String(l.accountId||""),
      taxCode: String(l.taxCode||""),
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return docRef.id;
}
