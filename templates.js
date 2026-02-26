import { buildJournalFromDocument } from "./accounting.js";
import { n } from "./app.js";

// Default account codes used by templates. These are looked up by UI.
export const DEFAULT_CODES = {
  cash: "1000",
  ar: "1100",
  ap: "2100",
  sales: "4000",
  cogs: "5000",
  inventory: "1200",
  expense: "6000",
  tax: "2300",
  fxGainLoss: "7990",
};

export function template_ar_invoice({ accountByCode }){
  // Debit AR, Credit Revenue
  return (doc, docLines)=>{
    const ar = accountByCode(DEFAULT_CODES.ar);
    const sales = accountByCode(DEFAULT_CODES.sales);
    const total = docLines.reduce((s,l)=>s+n(l.amount),0);
    return {
      header: { memo: `AR Invoice • ${doc.ref||''}` },
      lines: [
        { accountId: ar?.id, debit: total, credit: 0, entityType: "customer", entityId: doc.counterpartyId },
        { accountId: sales?.id, debit: 0, credit: total },
      ]
    };
  };
}

export function template_ar_payment({ accountByCode }){
  // Debit Cash, Credit AR
  return (doc, docLines)=>{
    const cash = accountByCode(DEFAULT_CODES.cash);
    const ar = accountByCode(DEFAULT_CODES.ar);
    const total = docLines.reduce((s,l)=>s+n(l.amount),0);
    return {
      header: { memo: `AR Payment • ${doc.ref||''}` },
      lines: [
        { accountId: cash?.id, debit: total, credit: 0, entityType: "customer", entityId: doc.counterpartyId },
        { accountId: ar?.id, debit: 0, credit: total, entityType: "customer", entityId: doc.counterpartyId },
      ]
    };
  };
}

export function template_ap_invoice({ accountByCode }){
  // Debit Expense/COGS (from doc line accountId), Credit AP
  return (doc, docLines)=>{
    const ap = accountByCode(DEFAULT_CODES.ap);
    const total = docLines.reduce((s,l)=>s+n(l.amount),0);
    const expenseLines = docLines.length ? docLines.map(l=>({ accountId: l.accountId, debit: n(l.amount), credit: 0, memo: l.description||"" }))
      : [{ accountId: accountByCode(DEFAULT_CODES.expense)?.id, debit: total, credit: 0 }];
    return {
      header: { memo: `AP Invoice • ${doc.ref||''}` },
      lines: [
        ...expenseLines,
        { accountId: ap?.id, debit: 0, credit: total, entityType: "supplier", entityId: doc.counterpartyId },
      ]
    };
  };
}

export function template_ap_payment({ accountByCode }){
  // Debit AP, Credit Cash
  return (doc, docLines)=>{
    const cash = accountByCode(DEFAULT_CODES.cash);
    const ap = accountByCode(DEFAULT_CODES.ap);
    const total = docLines.reduce((s,l)=>s+n(l.amount),0);
    return {
      header: { memo: `AP Payment • ${doc.ref||''}` },
      lines: [
        { accountId: ap?.id, debit: total, credit: 0, entityType: "supplier", entityId: doc.counterpartyId },
        { accountId: cash?.id, debit: 0, credit: total },
      ]
    };
  };
}

export function template_general({}){
  // Document lines already specify accountId and sign.
  return (doc, docLines)=>{
    const lines = docLines.map(l=>({
      accountId: l.accountId,
      debit: n(l.debit||0),
      credit: n(l.credit||0),
      memo: l.description||"",
    }));
    return { header:{ memo:`Journal • ${doc.ref||''}` }, lines };
  };
}

export function buildJEFromDocType(docType, doc, docLines, deps){
  const t = String(docType||"").toLowerCase();
  const factory = {
    ar_invoice: template_ar_invoice(deps),
    ar_payment: template_ar_payment(deps),
    ap_invoice: template_ap_invoice(deps),
    ap_payment: template_ap_payment(deps),
    general: template_general(deps),
  }[t];
  if(!factory) throw new Error("نوع المستند غير مدعوم في القوالب.");
  return buildJournalFromDocument({ ...doc, id: doc.id }, docLines, factory);
}
