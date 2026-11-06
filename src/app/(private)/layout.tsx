import { AppShell } from "@/components/AppShell";
import { getAccountSummary } from "@/lib/auth";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSummary();
  return <AppShell account={account}>{children}</AppShell>;
}
