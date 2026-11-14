import { AppShell } from "@/components/AppShell";
import { getAccountSummary } from "@/lib/auth";
import { getCenterModulesForAccount } from "@/lib/center-settings-service";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountSummary();
  const modules = account ? await getCenterModulesForAccount() : undefined;
  return <AppShell account={account} modules={modules}>{children}</AppShell>;
}
