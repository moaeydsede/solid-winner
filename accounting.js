import { ACCOUNT_TYPES, n, periodFromDate, signForType } from "./app.js";

// -----------------------------
// Data contract (Firestore)
// companies/{companyId}/chartOfAccounts/{accountId}
//   { code, name, type, parentId, isCash, isAR, isAP, isInventory, isFxMonetary, departmentIds[] }
// companies/{companyId}/journalEntries/{jeId}
//   { date, period, currency, fxRate, memo, ref, status: 'posted'|'draft', source: {type, id}, createdAt }
// companies/{companyId}/journalEntries/{jeId}/lines/{lineId}
//   { accountId, debit, credit, amount, baseDebit, baseCredit, departmentId, entityType, entityId, docId, lineNo }
// companies/{companyId}/documents/{docId}
//   { docType, date, period, currency, fxRate, counterpartyType, counterpartyId, ref, status }
// companies/{companyId}/documents/{docId}/documentLines/{lineId}
//   { description, qty, unitPrice, amount, accountId, taxCode }
// companies/{companyId}/periodClosings/{periodKey}
//   { period, closedAt, closedBy, notes }
// companies/{companyId}/exchangeRates/{YYYY-MM-DD}_{CCY}
//   { date, currency, rateToBase }
// companies/{companyId}/budgets/{budgetId}
//   { year, currency, createdAt }
// companies/{companyId}/budgets/{budgetId}/lines/{lineId}
//   { accountId, departmentId, month, amountBase }
// companies/{companyId}/alerts/{alertId}
//   { ruleId, createdAt, severity, title, details, period, status: 'open'|'ack'|'snooze', snoozeUntil }
// companies/{companyId}/alerts_log/{logId}
//   { alertId, action, at, by, note }

// -----------------------------
// Accounting math
// -----------------------------

export function jeTotals(lines){
  const t = lines.reduce((acc,l)=>{
    acc.debit += n(l.debit || 0);
    acc.credit += n(l.credit || 0);
    acc.baseDebit += n(l.baseDebit ?? l.debit ?? 0);
    acc.baseCredit += n(l.baseCredit ?? l.credit ?? 0);
    return acc;
  }, {debit:0, credit:0, baseDebit:0, baseCredit:0});
  t.diff = +(t.debit - t.credit).toFixed(6);
  t.baseDiff = +(t.baseDebit - t.baseCredit).toFixed(6);
  return t;
}

export function validateBalanced(lines){
  const t = jeTotals(lines);
  return Math.abs(t.baseDiff) < 0.0001;
}

export function toBase(amount, fxRate){
  return +(n(amount) * n(fxRate || 1)).toFixed(6);
}

export function buildJournalFromDocument(doc, docLines, mapping){
  // mapping: function(doc, docLines) => { header, lines }
  // Used by UI templates (AR invoice, AP invoice, cash sale, etc.).
  const { header, lines } = mapping(doc, docLines);
  const je = {
    date: doc.date,
    period: doc.period || periodFromDate(doc.date),
    currency: doc.currency,
    fxRate: n(doc.fxRate || 1),
    memo: header.memo || "",
    ref: doc.ref || "",
    status: "posted",
    source: { type: "document", id: doc.id },
  };
  const jeLines = lines.map((l, idx)=>{
    const debit = n(l.debit || 0);
    const credit = n(l.credit || 0);
    return {
      lineNo: idx+1,
      accountId: l.accountId,
      debit,
      credit,
      baseDebit: toBase(debit, je.fxRate),
      baseCredit: toBase(credit, je.fxRate),
      departmentId: l.departmentId || "",
      entityType: l.entityType || doc.counterpartyType || "",
      entityId: l.entityId || doc.counterpartyId || "",
      docId: doc.id,
      memo: l.memo || "",
    };
  });
  return { je, lines: jeLines };
}

export function aggregateTrialBalance(journalLines, coaById){
  // journalLines are expected in base currency amounts.
  const map = new Map();
  for(const l of journalLines){
    const accId = l.accountId;
    if(!accId) continue;
    if(!map.has(accId)) map.set(accId, {accountId:accId, debit:0, credit:0, net:0, type:(coaById.get(accId)?.type||"")});
    const row = map.get(accId);
    row.debit += n(l.baseDebit ?? l.debit ?? 0);
    row.credit += n(l.baseCredit ?? l.credit ?? 0);
  }
  for(const r of map.values()){
    r.net = r.debit - r.credit;
  }
  return [...map.values()];
}

export function splitStatements(tbRows, coaById){
  const pnl = [];
  const bs = [];
  for(const r of tbRows){
    const acc = coaById.get(r.accountId);
    const t = acc?.type;
    const name = acc?.name || r.accountId;
    const code = acc?.code || "";
    const row = {...r, name, code, type:t||""};
    if([
      ACCOUNT_TYPES.revenue, ACCOUNT_TYPES.cogs, ACCOUNT_TYPES.expense,
      ACCOUNT_TYPES.other_income, ACCOUNT_TYPES.other_expense, ACCOUNT_TYPES.tax
    ].includes(t)) pnl.push(row);
    else bs.push(row);
  }
  return { pnl, bs };
}

export function pnlTotals(pnlRows){
  const sumType = (t)=> pnlRows.filter(r=>r.type===t).reduce((s,r)=>s + (signForType(t) * r.net), 0);
  const revenue = sumType(ACCOUNT_TYPES.revenue);
  const cogs = -sumType(ACCOUNT_TYPES.cogs);
  const expense = -sumType(ACCOUNT_TYPES.expense);
  const otherIncome = sumType(ACCOUNT_TYPES.other_income);
  const otherExpense = -sumType(ACCOUNT_TYPES.other_expense);
  const tax = -sumType(ACCOUNT_TYPES.tax);
  const gross = revenue - cogs;
  const ebit = gross - expense + otherIncome - otherExpense;
  const net = ebit - tax;
  return { revenue, cogs, expense, otherIncome, otherExpense, tax, gross, ebit, net };
}

export function balanceSheetTotals(bsRows){
  const sum = (type)=> bsRows.filter(r=>r.type===type).reduce((s,r)=>s + r.net, 0);
  const assets = sum(ACCOUNT_TYPES.asset);
  // Liabilities + Equity are credit-nature; in our net(debit-credit) they usually negative.
  const liabilities = -sum(ACCOUNT_TYPES.liability);
  const equity = -sum(ACCOUNT_TYPES.equity);
  const liabEq = liabilities + equity;
  return { assets, liabilities, equity, liabEq, diff: assets - liabEq };
}

export function computeDirectCashFlow(journalLines, cashAccountIds){
  // Direct: group cash movements; positive = inflow.
  const cashSet = new Set(cashAccountIds);
  let inflow = 0;
  let outflow = 0;
  for(const l of journalLines){
    if(!cashSet.has(l.accountId)) continue;
    const net = n(l.baseDebit ?? 0) - n(l.baseCredit ?? 0);
    if(net >= 0) inflow += net; else outflow += -net;
  }
  return { inflow, outflow, netCash: inflow - outflow };
}

export function computeIndirectCashFlow({ netIncome, deltaAR, deltaAP, deltaInventory, depreciation=0, other=0 }){
  // Simplified Indirect.
  const wc = (-deltaAR) + (deltaAP) + (-deltaInventory);
  const netCash = netIncome + depreciation + wc + other;
  return { netCash, wc, depreciation, other };
}

export function anomalyScore(values){
  // values: last 3 months + current (length 4). Basic z-score.
  const xs = values.slice(0,3).map(n);
  const cur = n(values[3]);
  const mean = xs.reduce((s,x)=>s+x,0) / (xs.length||1);
  const var0 = xs.reduce((s,x)=> s + Math.pow(x-mean,2), 0) / (xs.length||1);
  const sd = Math.sqrt(var0) || 1;
  const z = (cur-mean)/sd;
  return { z, mean, sd };
}
