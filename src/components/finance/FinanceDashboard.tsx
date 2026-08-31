"use client";

import React, { useState, useTransition } from "react";
import { format, isSameMonth, parseISO } from "date-fns";
import {
  Wallet,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Tag,
  AlertCircle,
  CheckCircle2,
  Layers,
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Receipt,
  PiggyBank,
  Check,
  X,
} from "lucide-react";
import {
  createTransaction,
  deleteTransaction,
  createBudget,
  deleteBudget,
  createSubscription,
  deleteSubscription,
  createAccount,
  deleteAccount,
} from "@/server/actions/extensions";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  accountId: string | null;
  amount: string;
  date: Date | string;
  category: string;
  description: string | null;
  accountName?: string | null;
}

interface Budget {
  id: string;
  category: string;
  monthlyLimit: string;
}

interface Subscription {
  id: string;
  name: string;
  amount: string;
  renewalDate: Date | string;
  cycle: string | null;
}

interface FinanceDashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  subscriptions: Subscription[];
}

const CATEGORY_PRESETS = [
  "Housing",
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Utilities",
  "Entertainment",
  "Health & Wellness",
  "Education",
  "Shopping",
  "Personal Care",
  "Subscriptions",
  "General",
];

const ACCOUNT_TYPES = [
  { id: "checking", label: "Checking" },
  { id: "savings", label: "Savings" },
  { id: "credit", label: "Credit Card" },
  { id: "cash", label: "Cash" },
  { id: "investment", label: "Investment" },
];

export function FinanceDashboard({
  accounts,
  transactions,
  budgets,
  subscriptions,
}: FinanceDashboardProps) {
  const [isPending, startTransition] = useTransition();

  // Modals & Panels state
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Quick-add Transaction Form State
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Groceries");
  const [txCustomCategory, setTxCustomCategory] = useState("");
  const [txAccountId, setTxAccountId] = useState(accounts[0]?.id || "");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txDescription, setTxDescription] = useState("");

  // Budget Form State
  const [budgetCategory, setBudgetCategory] = useState("Groceries");
  const [budgetLimit, setBudgetLimit] = useState("");

  // Subscription Form State
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subRenewal, setSubRenewal] = useState(new Date().toISOString().split("T")[0]);
  const [subCycle, setSubCycle] = useState("monthly");

  // Account Form State
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("checking");

  // Filter Transactions
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Current Month Calculations
  const currentMonthDate = new Date();
  const currentMonthTransactions = transactions.filter((tx) => {
    const d = typeof tx.date === "string" ? parseISO(tx.date) : new Date(tx.date);
    return isSameMonth(d, currentMonthDate);
  });

  const totalSpentThisMonth = currentMonthTransactions.reduce(
    (acc, tx) => acc + Math.abs(parseFloat(tx.amount) || 0),
    0
  );

  const totalMonthlyBudget = budgets.reduce(
    (acc, b) => acc + (parseFloat(b.monthlyLimit) || 0),
    0
  );

  const totalMonthlySubscriptions = subscriptions.reduce((acc, s) => {
    const val = parseFloat(s.amount) || 0;
    if (s.cycle === "yearly") return acc + val / 12;
    if (s.cycle === "weekly") return acc + val * 4.33;
    return acc + val;
  }, 0);

  // Category Spend mapping
  const categorySpendMap: Record<string, number> = {};
  currentMonthTransactions.forEach((tx) => {
    const cat = tx.category.trim();
    const amt = Math.abs(parseFloat(tx.amount) || 0);
    categorySpendMap[cat] = (categorySpendMap[cat] || 0) + amt;
  });

  // Handlers
  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory =
      txCategory === "Custom" ? txCustomCategory.trim() : txCategory;
    const amt = parseFloat(txAmount);
    if (!amt || isNaN(amt)) return;

    startTransition(async () => {
      await createTransaction({
        amount: amt,
        category: finalCategory || "General",
        accountId: txAccountId || null,
        date: txDate,
        description: txDescription || null,
      });
      setTxAmount("");
      setTxDescription("");
      setShowAddTx(false);
    });
  };

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(budgetLimit);
    if (!budgetCategory || !limit || limit <= 0) return;

    startTransition(async () => {
      await createBudget({
        category: budgetCategory,
        monthlyLimit: limit,
      });
      setBudgetLimit("");
      setShowAddBudget(false);
    });
  };

  const handleCreateSub = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(subAmount);
    if (!subName.trim() || !amt || amt <= 0) return;

    startTransition(async () => {
      await createSubscription({
        name: subName.trim(),
        amount: amt,
        renewalDate: subRenewal,
        cycle: subCycle,
      });
      setSubName("");
      setSubAmount("");
      setShowAddSub(false);
    });
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    startTransition(async () => {
      await createAccount({
        name: accName.trim(),
        type: accType,
      });
      setAccName("");
      setShowAddAccount(false);
    });
  };

  const filteredTransactions =
    filterCategory === "all"
      ? transactions
      : transactions.filter(
          (t) => t.category.toLowerCase() === filterCategory.toLowerCase()
        );

  const budgetUsagePercent =
    totalMonthlyBudget > 0
      ? Math.min(Math.round((totalSpentThisMonth / totalMonthlyBudget) * 100), 100)
      : 0;

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Extensions
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              Finance-lite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Finance & Budgets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track expenses, manage category limits, and monitor recurring subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddTx(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Spent This Month
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ${totalSpentThisMonth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentMonthTransactions.length} transaction{currentMonthTransactions.length === 1 ? "" : "s"} in {format(currentMonthDate, "MMMM")}
            </p>
          </div>
        </div>

        {/* Total Monthly Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Monthly Budget
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ${totalMonthlyBudget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetUsagePercent > 90
                      ? "bg-rose-500"
                      : budgetUsagePercent > 75
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${budgetUsagePercent}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {budgetUsagePercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Subscriptions
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ${totalMonthlySubscriptions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-500">/mo</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {subscriptions.length} active recurring service{subscriptions.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Accounts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Accounts
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {accounts.length}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500">
                {accounts.length > 0
                  ? accounts.map((a) => a.name).slice(0, 2).join(", ") + (accounts.length > 2 ? "..." : "")
                  : "No accounts linked"}
              </p>
              <button
                type="button"
                onClick={() => setShowAddAccount(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Budgets & Subscriptions (Left) / Recent Transactions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (Budgets + Subscriptions + Accounts) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Category Budgets Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  Category Budgets
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly caps for major expense categories
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBudget(true)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                + Set Budget
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {budgets.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  No category budgets set yet. Click &quot;+ Set Budget&quot; to establish monthly limits.
                </div>
              ) : (
                budgets.map((b) => {
                  const spent = categorySpendMap[b.category] || 0;
                  const limit = parseFloat(b.monthlyLimit) || 1;
                  const pct = Math.round((spent / limit) * 100);
                  const isOver = spent > limit;
                  const isWarning = spent >= limit * 0.8 && !isOver;

                  return (
                    <div key={b.id} className="group flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {b.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            ${spent.toFixed(2)}{" "}
                            <span className="text-slate-400 font-normal">
                              / ${parseFloat(b.monthlyLimit).toFixed(0)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              startTransition(async () => {
                                await deleteBudget(b.id);
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition cursor-pointer p-0.5"
                            title="Delete budget"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver
                              ? "bg-rose-500"
                              : isWarning
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-medium ${
                            isOver
                              ? "text-rose-600 flex items-center gap-1"
                              : isWarning
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          {isOver && <AlertCircle className="w-3 h-3" />}
                          {pct}% used
                        </span>
                        <span className="text-slate-400">
                          {isOver
                            ? `$${(spent - limit).toFixed(2)} over limit`
                            : `$${(limit - spent).toFixed(2)} remaining`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Subscriptions Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-indigo-600" />
                  Subscriptions & Renewals
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track recurring services and renewal dates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSub(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                + Add
              </button>
            </div>

            <div className="mt-4 flex flex-col divide-y divide-slate-100">
              {subscriptions.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  No subscriptions added. Track Netflix, Spotify, cloud storage, etc.
                </div>
              ) : (
                subscriptions.map((s) => {
                  const renDate = typeof s.renewalDate === "string" ? parseISO(s.renewalDate) : new Date(s.renewalDate);
                  return (
                    <div
                      key={s.id}
                      className="group py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                          {s.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {s.name}
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Renews {format(renDate, "MMM d, yyyy")}
                            <span className="capitalize px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {s.cycle || "monthly"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-slate-900">
                            ${parseFloat(s.amount).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            /{s.cycle === "yearly" ? "yr" : "mo"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              await deleteSubscription(s.id);
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition cursor-pointer p-1"
                          title="Delete subscription"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Accounts Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                Managed Accounts
              </h2>
              <button
                type="button"
                onClick={() => setShowAddAccount(true)}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
              >
                + Account
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {accounts.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No accounts created. Add Checking, Savings, or Cash to tag your transactions.
                </p>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
                  >
                    <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                      {acc.type}
                    </span>
                    <span>{acc.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(async () => {
                          await deleteAccount(acc.id);
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transactions List */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            {/* Header & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-700" />
                  Recent Transactions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredTransactions.length} recorded entries
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List */}
            <div className="mt-4 flex flex-col divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No transactions found. Click &quot;Add Transaction&quot; above to log an expense.
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const txDateObj = typeof tx.date === "string" ? parseISO(tx.date) : new Date(tx.date);
                  const amt = parseFloat(tx.amount);
                  const isExpense = amt >= 0; // standard positive amounts are expense entries

                  return (
                    <div
                      key={tx.id}
                      className="group py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs hover:bg-slate-50/60 -mx-2 px-2 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isExpense
                              ? "bg-slate-100 text-slate-700"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {isExpense ? (
                            <ArrowUpRight className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {tx.description || tx.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                              {tx.category}
                            </span>
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center gap-2">
                            <span>{format(txDateObj, "MMM d, yyyy")}</span>
                            {tx.accountName && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 font-medium">
                                  {tx.accountName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right font-bold text-sm text-slate-900">
                          ${amt.toFixed(2)}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              await deleteTransaction(tx.id);
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition cursor-pointer p-1.5 rounded-lg hover:bg-rose-50"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modals & Forms */}
      {/* ------------------------------------------------------------- */}

      {/* Modal: Quick-add Transaction */}
      {showAddTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Add Transaction
              </h3>
              <button
                type="button"
                onClick={() => setShowAddTx(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="mt-4 flex flex-col gap-4">
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount ($) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-400 font-semibold"
                  />
                </div>
              </div>

              {/* Date & Account */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account
                  </label>
                  <select
                    value={txAccountId}
                    onChange={(e) => setTxAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">No Account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                >
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Custom">+ Custom Category</option>
                </select>

                {txCategory === "Custom" && (
                  <input
                    type="text"
                    placeholder="Enter custom category name"
                    value={txCustomCategory}
                    onChange={(e) => setTxCustomCategory(e.target.value)}
                    className="w-full mt-2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Trader Joe's groceries, dinner with team"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTx(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Set Budget */}
      {showAddBudget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-600" />
                Set Category Budget
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBudget(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                >
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Limit ($) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 500"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBudget(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Set Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Subscription */}
      {showAddSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-indigo-600" />
                Add Subscription
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSub(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSub} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, Spotify, iCloud"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="14.99"
                    value={subAmount}
                    onChange={(e) => setSubAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cycle
                  </label>
                  <select
                    value={subCycle}
                    onChange={(e) => setSubCycle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden capitalize"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Renewal Date *
                </label>
                <input
                  type="date"
                  required
                  value={subRenewal}
                  onChange={(e) => setSubRenewal(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSub(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Account */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600" />
                Add Account
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAccount(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chase Sapphire, Main Checking, Cash"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Type
                </label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PieChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
