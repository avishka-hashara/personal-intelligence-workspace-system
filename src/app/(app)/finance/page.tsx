import { db } from "@/server/db";
import { accounts, transactions, budgets, subscriptions } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 1. Fetch Accounts
  const userAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), isNull(accounts.deletedAt)))
    .orderBy(desc(accounts.createdAt));

  // 2. Fetch Transactions (joining accounts for accountName)
  const userTransactions = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
      description: transactions.description,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.userId, user.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date));

  // 3. Fetch Budgets
  const userBudgets = await db
    .select({
      id: budgets.id,
      category: budgets.category,
      monthlyLimit: budgets.monthlyLimit,
    })
    .from(budgets)
    .where(and(eq(budgets.userId, user.id), isNull(budgets.deletedAt)))
    .orderBy(desc(budgets.createdAt));

  // 4. Fetch Subscriptions
  const userSubscriptions = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      amount: subscriptions.amount,
      renewalDate: subscriptions.renewalDate,
      cycle: subscriptions.cycle,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), isNull(subscriptions.deletedAt)))
    .orderBy(subscriptions.renewalDate);

  return (
    <FinanceDashboard
      accounts={userAccounts}
      transactions={userTransactions}
      budgets={userBudgets}
      subscriptions={userSubscriptions}
    />
  );
}
