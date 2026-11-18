import { redirect } from "next/navigation";
import { TOKENS } from "@/lib/staking/tokens";

// The per-asset preview pages showed indicative rates for a design that is
// switched off. They now land on /stake, which says the vault is in development.
export const dynamicParams = false;

export function generateStaticParams() {
  return TOKENS.map((t) => ({ token: t.symbol.toLowerCase() }));
}

export default function StakeTokenPage() {
  redirect("/stake");
}
