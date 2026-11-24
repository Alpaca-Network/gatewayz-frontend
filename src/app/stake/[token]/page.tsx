import { redirect } from "next/navigation";

// Old links: the per-asset preview pages (/stake/ada, /stake/eth, ...) belonged
// to a design that was retired. They land on /stake, which says the vault is in
// development. Any other /stake/<x> is a 404.
const RETIRED_TOKEN_PAGES = ["ada", "eth", "sol", "dot", "atom", "usdc", "usdt"];

export const dynamicParams = false;

export function generateStaticParams() {
  return RETIRED_TOKEN_PAGES.map((token) => ({ token }));
}

export default function StakeTokenPage() {
  redirect("/stake");
}
