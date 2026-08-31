"use server";

import { db } from "@/server/db";
import {
  accounts,
  transactions,
  budgets,
  subscriptions,
  metricDefinitions,
  metricLogs,
} from "@/server/db/schema";
import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ----------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------

export interface CreateAccountInput {
  name: string;
  type: string;
}

export async function createAccount(input: FormData | CreateAccountInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  let name = "";
  let type = "checking";

  if (input instanceof FormData) {
    name = (input.get("name") as string) || "";
    type = (input.get("type") as string) || "checking";
  } else {
    name = input.name;
    type = input.type || "checking";
  }

  const cleanName = name.trim();
  if (!cleanName) return { error: "Account name is required" };

  try {
    const [newAccount] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: cleanName,
        type: type.toLowerCase(),
      })
      .returning();

    revalidatePath("/finance");
    return { data: newAccount };
  } catch (err: any) {
    console.error("Failed to create account:", err);
    return { error: err.message || "Failed to create account" };
  }
}

export async function updateAccount(
  id: string,
  input: { name?: string; type?: string }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [updated] = await db
      .update(accounts)
      .set({
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.type !== undefined && { type: input.type.toLowerCase() }),
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: updated };
  } catch (err: any) {
    console.error("Failed to update account:", err);
    return { error: err.message || "Failed to update account" };
  }
}

export async function deleteAccount(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [deleted] = await db
      .update(accounts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: deleted };
  } catch (err: any) {
    console.error("Failed to delete account:", err);
    return { error: err.message || "Failed to delete account" };
  }
}

export async function getAccounts() {
  const user = await getCurrentUser();
  if (!user) return [];

  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), isNull(accounts.deletedAt)))
    .orderBy(desc(accounts.createdAt));
}

// ----------------------------------------------------------------------
// Transactions
// ----------------------------------------------------------------------

export interface CreateTransactionInput {
  accountId?: string | null;
  amount: number;
  date?: Date | string;
  category: string;
  description?: string | null;
}

export async function createTransaction(
  input: FormData | CreateTransactionInput
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  let accountId: string | null = null;
  let amount = 0;
  let txDate = new Date();
  let category = "General";
  let description: string | null = null;

  if (input instanceof FormData) {
    accountId = (input.get("accountId") as string) || null;
    const amountVal = input.get("amount") as string;
    amount = parseFloat(amountVal) || 0;
    const dateVal = input.get("date") as string;
    if (dateVal) txDate = new Date(dateVal);
    category = (input.get("category") as string) || "General";
    description = (input.get("description") as string) || null;
  } else {
    accountId = input.accountId || null;
    amount = typeof input.amount === "number" ? input.amount : parseFloat(input.amount as any) || 0;
    if (input.date) txDate = new Date(input.date);
    category = input.category || "General";
    description = input.description || null;
  }

  if (isNaN(amount) || amount === 0) {
    return { error: "A valid non-zero amount is required" };
  }

  try {
    const [newTx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: accountId && accountId !== "" && accountId !== "none" ? accountId : null,
        amount: amount.toString(),
        date: txDate,
        category: category.trim() || "General",
        description: description?.trim() || null,
      })
      .returning();

    revalidatePath("/finance");
    return { data: newTx };
  } catch (err: any) {
    console.error("Failed to create transaction:", err);
    return { error: err.message || "Failed to create transaction" };
  }
}

export async function updateTransaction(
  id: string,
  input: {
    accountId?: string | null;
    amount?: number;
    date?: Date | string;
    category?: string;
    description?: string | null;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const updatePayload: any = { updatedAt: new Date() };
    if (input.accountId !== undefined) {
      updatePayload.accountId = input.accountId && input.accountId !== "none" ? input.accountId : null;
    }
    if (input.amount !== undefined) {
      updatePayload.amount = input.amount.toString();
    }
    if (input.date !== undefined) {
      updatePayload.date = new Date(input.date);
    }
    if (input.category !== undefined) {
      updatePayload.category = input.category.trim();
    }
    if (input.description !== undefined) {
      updatePayload.description = input.description?.trim() || null;
    }

    const [updated] = await db
      .update(transactions)
      .set(updatePayload)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: updated };
  } catch (err: any) {
    console.error("Failed to update transaction:", err);
    return { error: err.message || "Failed to update transaction" };
  }
}

export async function deleteTransaction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [deleted] = await db
      .update(transactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: deleted };
  } catch (err: any) {
    console.error("Failed to delete transaction:", err);
    return { error: err.message || "Failed to delete transaction" };
  }
}

export async function getTransactions(options?: {
  month?: Date | string;
  startDate?: Date | string;
  endDate?: Date | string;
}) {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      accountId: transactions.accountId,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
      description: transactions.description,
      createdAt: transactions.createdAt,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.userId, user.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date));

  return query;
}

// ----------------------------------------------------------------------
// Budgets
// ----------------------------------------------------------------------

export interface CreateBudgetInput {
  category: string;
  monthlyLimit: number;
}

export async function createBudget(input: FormData | CreateBudgetInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  let category = "";
  let monthlyLimit = 0;

  if (input instanceof FormData) {
    category = (input.get("category") as string) || "";
    const limitVal = input.get("monthlyLimit") as string;
    monthlyLimit = parseFloat(limitVal) || 0;
  } else {
    category = input.category;
    monthlyLimit = typeof input.monthlyLimit === "number" ? input.monthlyLimit : parseFloat(input.monthlyLimit as any) || 0;
  }

  const cleanCategory = category.trim();
  if (!cleanCategory) return { error: "Category is required" };
  if (monthlyLimit <= 0) return { error: "Monthly limit must be greater than 0" };

  try {
    const [newBudget] = await db
      .insert(budgets)
      .values({
        userId: user.id,
        category: cleanCategory,
        monthlyLimit: monthlyLimit.toString(),
      })
      .returning();

    revalidatePath("/finance");
    return { data: newBudget };
  } catch (err: any) {
    console.error("Failed to create budget:", err);
    return { error: err.message || "Failed to create budget" };
  }
}

export async function updateBudget(
  id: string,
  input: { category?: string; monthlyLimit?: number }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const updatePayload: any = { updatedAt: new Date() };
    if (input.category !== undefined) {
      updatePayload.category = input.category.trim();
    }
    if (input.monthlyLimit !== undefined) {
      updatePayload.monthlyLimit = input.monthlyLimit.toString();
    }

    const [updated] = await db
      .update(budgets)
      .set(updatePayload)
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: updated };
  } catch (err: any) {
    console.error("Failed to update budget:", err);
    return { error: err.message || "Failed to update budget" };
  }
}

export async function deleteBudget(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [deleted] = await db
      .update(budgets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: deleted };
  } catch (err: any) {
    console.error("Failed to delete budget:", err);
    return { error: err.message || "Failed to delete budget" };
  }
}

export async function getBudgets() {
  const user = await getCurrentUser();
  if (!user) return [];

  return db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, user.id), isNull(budgets.deletedAt)))
    .orderBy(desc(budgets.createdAt));
}

// ----------------------------------------------------------------------
// Subscriptions
// ----------------------------------------------------------------------

export interface CreateSubscriptionInput {
  name: string;
  amount: number;
  renewalDate: Date | string;
  cycle?: string;
}

export async function createSubscription(
  input: FormData | CreateSubscriptionInput
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  let name = "";
  let amount = 0;
  let renewalDate = new Date();
  let cycle = "monthly";

  if (input instanceof FormData) {
    name = (input.get("name") as string) || "";
    const amountVal = input.get("amount") as string;
    amount = parseFloat(amountVal) || 0;
    const renewalVal = input.get("renewalDate") as string;
    if (renewalVal) renewalDate = new Date(renewalVal);
    cycle = (input.get("cycle") as string) || "monthly";
  } else {
    name = input.name;
    amount = typeof input.amount === "number" ? input.amount : parseFloat(input.amount as any) || 0;
    if (input.renewalDate) renewalDate = new Date(input.renewalDate);
    cycle = input.cycle || "monthly";
  }

  const cleanName = name.trim();
  if (!cleanName) return { error: "Subscription name is required" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  try {
    const [newSub] = await db
      .insert(subscriptions)
      .values({
        userId: user.id,
        name: cleanName,
        amount: amount.toString(),
        renewalDate: renewalDate,
        cycle: cycle.toLowerCase(),
      })
      .returning();

    revalidatePath("/finance");
    return { data: newSub };
  } catch (err: any) {
    console.error("Failed to create subscription:", err);
    return { error: err.message || "Failed to create subscription" };
  }
}

export async function updateSubscription(
  id: string,
  input: {
    name?: string;
    amount?: number;
    renewalDate?: Date | string;
    cycle?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const updatePayload: any = { updatedAt: new Date() };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.amount !== undefined) updatePayload.amount = input.amount.toString();
    if (input.renewalDate !== undefined) updatePayload.renewalDate = new Date(input.renewalDate);
    if (input.cycle !== undefined) updatePayload.cycle = input.cycle.toLowerCase();

    const [updated] = await db
      .update(subscriptions)
      .set(updatePayload)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: updated };
  } catch (err: any) {
    console.error("Failed to update subscription:", err);
    return { error: err.message || "Failed to update subscription" };
  }
}

export async function deleteSubscription(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [deleted] = await db
      .update(subscriptions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)))
      .returning();

    revalidatePath("/finance");
    return { data: deleted };
  } catch (err: any) {
    console.error("Failed to delete subscription:", err);
    return { error: err.message || "Failed to delete subscription" };
  }
}

export async function getSubscriptions() {
  const user = await getCurrentUser();
  if (!user) return [];

  return db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), isNull(subscriptions.deletedAt)))
    .orderBy(subscriptions.renewalDate);
}

// ----------------------------------------------------------------------
// Health & Routine: Metric Definitions & Logs
// ----------------------------------------------------------------------

export interface CreateMetricDefinitionInput {
  name: string;
  unit: string;
}

export async function createMetricDefinition(
  input: FormData | CreateMetricDefinitionInput
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  let name = "";
  let unit = "";

  if (input instanceof FormData) {
    name = (input.get("name") as string) || "";
    unit = (input.get("unit") as string) || "";
  } else {
    name = input.name;
    unit = input.unit;
  }

  const cleanName = name.trim();
  const cleanUnit = unit.trim();
  if (!cleanName) return { error: "Metric name is required" };
  if (!cleanUnit) return { error: "Metric unit is required (e.g. hours, litres, mins)" };

  try {
    const [newDef] = await db
      .insert(metricDefinitions)
      .values({
        userId: user.id,
        name: cleanName,
        unit: cleanUnit,
      })
      .returning();

    revalidatePath("/health");
    return { data: newDef };
  } catch (err: any) {
    console.error("Failed to create metric definition:", err);
    return { error: err.message || "Failed to create metric definition" };
  }
}

export async function seedDefaultMetrics() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const defaults = [
    { name: "Sleep", unit: "hours" },
    { name: "Water", unit: "litres" },
    { name: "Movement", unit: "mins" },
    { name: "Mood", unit: "1-10" },
  ];

  try {
    const existing = await db
      .select({ name: metricDefinitions.name })
      .from(metricDefinitions)
      .where(and(eq(metricDefinitions.userId, user.id), isNull(metricDefinitions.deletedAt)));

    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
    const toInsert = defaults.filter((d) => !existingNames.has(d.name.toLowerCase()));

    if (toInsert.length > 0) {
      await db.insert(metricDefinitions).values(
        toInsert.map((d) => ({
          userId: user.id,
          name: d.name,
          unit: d.unit,
        }))
      );
    }

    revalidatePath("/health");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to seed default metrics:", err);
    return { error: err.message || "Failed to seed default metrics" };
  }
}

export async function deleteMetricDefinition(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [deleted] = await db
      .update(metricDefinitions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(metricDefinitions.id, id), eq(metricDefinitions.userId, user.id)))
      .returning();

    revalidatePath("/health");
    return { data: deleted };
  } catch (err: any) {
    console.error("Failed to delete metric definition:", err);
    return { error: err.message || "Failed to delete metric definition" };
  }
}

export async function getMetricDefinitions() {
  const user = await getCurrentUser();
  if (!user) return [];

  return db
    .select()
    .from(metricDefinitions)
    .where(and(eq(metricDefinitions.userId, user.id), isNull(metricDefinitions.deletedAt)))
    .orderBy(metricDefinitions.name);
}

// ----------------------------------------------------------------------
// Metric Logs
// ----------------------------------------------------------------------

export interface CreateMetricLogInput {
  metricId: string;
  loggedOn?: string | Date;
  value: number;
}

export async function createMetricLog(input: FormData | CreateMetricLogInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  let metricId = "";
  let loggedOnStr = new Date().toISOString().split("T")[0];
  let value = 0;

  if (input instanceof FormData) {
    metricId = (input.get("metricId") as string) || "";
    const logDate = input.get("loggedOn") as string;
    if (logDate) loggedOnStr = logDate;
    const valStr = input.get("value") as string;
    value = parseFloat(valStr) || 0;
  } else {
    metricId = input.metricId;
    if (input.loggedOn) {
      loggedOnStr =
        typeof input.loggedOn === "string"
          ? input.loggedOn
          : input.loggedOn.toISOString().split("T")[0];
    }
    value = typeof input.value === "number" ? input.value : parseFloat(input.value as any) || 0;
  }

  if (!metricId) return { error: "Metric is required" };
  if (isNaN(value)) return { error: "A valid numeric value is required" };

  try {
    const [newLog] = await db
      .insert(metricLogs)
      .values({
        userId: user.id,
        metricId,
        loggedOn: loggedOnStr,
        value: value.toString(),
      })
      .returning();

    revalidatePath("/health");
    return { data: newLog };
  } catch (err: any) {
    console.error("Failed to create metric log:", err);
    return { error: err.message || "Failed to log metric" };
  }
}

export async function updateMetricLog(
  id: string,
  input: { value?: number; loggedOn?: string }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const updatePayload: any = { updatedAt: new Date() };
    if (input.value !== undefined) updatePayload.value = input.value.toString();
    if (input.loggedOn !== undefined) updatePayload.loggedOn = input.loggedOn;

    const [updated] = await db
      .update(metricLogs)
      .set(updatePayload)
      .where(and(eq(metricLogs.id, id), eq(metricLogs.userId, user.id)))
      .returning();

    revalidatePath("/health");
    return { data: updated };
  } catch (err: any) {
    console.error("Failed to update metric log:", err);
    return { error: err.message || "Failed to update metric log" };
  }
}

export async function deleteMetricLog(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [deleted] = await db
      .update(metricLogs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(metricLogs.id, id), eq(metricLogs.userId, user.id)))
      .returning();

    revalidatePath("/health");
    return { data: deleted };
  } catch (err: any) {
    console.error("Failed to delete metric log:", err);
    return { error: err.message || "Failed to delete metric log" };
  }
}

export async function getMetricLogs(days: number = 14) {
  const user = await getCurrentUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startDateStr = startDate.toISOString().split("T")[0];

  return db
    .select({
      id: metricLogs.id,
      userId: metricLogs.userId,
      metricId: metricLogs.metricId,
      loggedOn: metricLogs.loggedOn,
      value: metricLogs.value,
      createdAt: metricLogs.createdAt,
      metricName: metricDefinitions.name,
      metricUnit: metricDefinitions.unit,
    })
    .from(metricLogs)
    .innerJoin(metricDefinitions, eq(metricLogs.metricId, metricDefinitions.id))
    .where(
      and(
        eq(metricLogs.userId, user.id),
        gte(metricLogs.loggedOn, startDateStr),
        isNull(metricLogs.deletedAt),
        isNull(metricDefinitions.deletedAt)
      )
    )
    .orderBy(desc(metricLogs.loggedOn), desc(metricLogs.createdAt));
}
