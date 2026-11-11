import { redirect } from "next/navigation";

export default async function PurchasesPage(props: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  redirect(searchParams.month ? `/money?month=${searchParams.month}` : "/money");
}
