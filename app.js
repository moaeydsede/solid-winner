// Financial Analytics SUITE • PRO+ (Accounting-grade)
// Flat (GitHub Pages) app powered by Firebase Auth + Firestore.
// This file provides shared helpers + accounting engine entrypoints.

export const CFG = {
  firebaseConfig: {
    apiKey: "AIzaSyCP1-oYeXWdMCd_vJvpfSWZgBrDP3kzyo8",
    authDomain: "account-ceb7b.firebaseapp.com",
    projectId: "account-ceb7b",
    storageBucket: "account-ceb7b.firebasestorage.app",
    messagingSenderId: "19287318305",
    appId: "1:19287318305:web:0c8b0d14710f8dd9e02860"
  },
  ADMIN_UID: "46iC2fVDFEcP2mF859JyNyshpDz1",
  DEFAULT_COMPANY_ID: "main",
  DEFAULT_BASE_CURRENCY: "EGP",
};

// -----------------------------
// DOM helpers
// -----------------------------
export const $ = (id)=>document.getElementById(id);
export const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

export const toast = (t)=>{
  const el = $("toast");
  if(!el) return;
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(window.__toast_t);
  window.__toast_t = setTimeout(()=>el.classList.remove("show"), 2600);
};

export const clamp = (x,a,b)=>Math.max(a, Math.min(b,x));
export const n = (v)=>{ const x=Number(v); return Number.isFinite(x)?x:0; };

export const money = (val, ccy)=>{
  try{ return new Intl.NumberFormat("ar-EG", {style:"currency", currency:ccy, maximumFractionDigits:2}).format(n(val)); }
  catch{ return (n(val)).toFixed(2)+" "+ccy; }
};

export const pct = (v)=>{
  const x = Number(v);
  if(!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("ar-EG", {style:"percent", maximumFractionDigits:1}).format(x);
};

export function ym(dateStr){ return String(dateStr||"").slice(0,7); }
export function y(dateStr){ return String(dateStr||"").slice(0,4); }

export function rangeForPeriod(kind, anchorDateStr){
  const d = anchorDateStr ? new Date(anchorDateStr) : new Date();
  const y0 = d.getFullYear();
  const m0 = d.getMonth();
  const pad = (x)=>String(x).padStart(2,"0");
  let startM=0, endM=11;
  if(kind==="month"){ startM=m0; endM=m0; }
  if(kind==="quarter"){ const q = Math.floor(m0/3); startM=q*3; endM=q*3+2; }
  if(kind==="half"){ const h = m0<6 ? 0 : 1; startM=h*6; endM=h*6+5; }
  if(kind==="year"){ startM=0; endM=11; }
  const start = `${y0}-${pad(startM+1)}-01`;
  const end = new Date(y0, endM+1, 0).toISOString().slice(0,10);
  return {start, end};
}

export function fmtVar(cur, prev){
  const d = cur - prev;
  const p = (prev!==0) ? d/prev : NaN;
  return {delta:d, pct:p};
}

export function safeDiv(a,b){ return b? a/b : NaN; }

// -----------------------------
// Drawer UI
// -----------------------------
export function setActiveNav(active){
  document.querySelectorAll("[data-nav]").forEach(a=>{
    const key=a.getAttribute("data-nav");
    if(key===active) a.classList.add("active"); else a.classList.remove("active");
  });
}
export function openDrawer(){
  $("backdrop")?.classList.add("show");
  $("drawer")?.classList.add("show");
}
export function closeDrawer(){
  $("backdrop")?.classList.remove("show");
  $("drawer")?.classList.remove("show");
}
export function wireDrawer(active){
  setActiveNav(active);
  $("btnMenu")?.addEventListener("click", openDrawer);
  $("backdrop")?.addEventListener("click", closeDrawer);
  document.querySelectorAll("#drawer a").forEach(a=>a.addEventListener("click", closeDrawer));
}

// -----------------------------
// Company context
// -----------------------------
export function getCompanyId(){
  return localStorage.getItem("companyId") || CFG.DEFAULT_COMPANY_ID;
}
export function setCompanyId(v){
  localStorage.setItem("companyId", String(v||CFG.DEFAULT_COMPANY_ID));
}

// -----------------------------
// Legacy helpers (backward compatibility)
// Existing pages previously computed KPIs from flat "transactions".
// We keep these exports so legacy screens still work.
// -----------------------------
export function computeKPIs(rows){
  const sumBy = (t)=> rows.reduce((s,r)=> s + (r.type===t ? n(r.amount):0), 0);
  const revenue = sumBy("sale");
  const cogs = sumBy("cogs");
  const opex = sumBy("expense");
  const oi = sumBy("other_income");
  const oe = sumBy("other_expense");
  const tax = sumBy("tax");
  const gross = revenue - cogs;
  const ebit = gross - opex + oi - oe;
  const net = ebit - tax;
  const receipts = sumBy("receipt");
  const payments = sumBy("payment");
  const netCash = receipts - payments;
  const grossMargin = revenue>0 ? gross/revenue : 0;
  const ebitMargin = revenue>0 ? ebit/revenue : 0;
  const netMargin = revenue>0 ? net/revenue : 0;
  return { revenue,cogs,opex,oi,oe,tax,gross,ebit,net, receipts,payments,netCash, grossMargin,ebitMargin,netMargin };
}

export function groupByMonth(rows){
  const m = new Map();
  for(const r of rows){
    const k = ym(r.date);
    if(!k) continue;
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  const keys=[...m.keys()].sort();
  return {keys, m};
}

// -----------------------------
// Accounting v2 helpers
// -----------------------------

export const ACCOUNT_TYPES = /** @type {const} */ ({
  asset: "asset",
  liability: "liability",
  equity: "equity",
  revenue: "revenue",
  cogs: "cogs",
  expense: "expense",
  other_income: "other_income",
  other_expense: "other_expense",
  tax: "tax",
});

export function signForType(accountType){
  // Used for statement presentation: revenues positive, expenses negative.
  if([ACCOUNT_TYPES.revenue, ACCOUNT_TYPES.other_income].includes(accountType)) return +1;
  if([ACCOUNT_TYPES.cogs, ACCOUNT_TYPES.expense, ACCOUNT_TYPES.other_expense, ACCOUNT_TYPES.tax].includes(accountType)) return -1;
  return +1; // BS types
}

export function periodFromDate(dateStr){
  // YYYY-MM from YYYY-MM-DD
  return ym(dateStr);
}

export function normalizeDocType(t){
  return String(t||"").trim().toLowerCase();
}

export function uuid(prefix="id"){
  // Not cryptographically strong, but OK for client ids.
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
