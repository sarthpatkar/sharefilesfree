import { Home } from "@/components/Home";

export default async function ReceivePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <Home initialTab="receive" initialCode={code} />;
}
