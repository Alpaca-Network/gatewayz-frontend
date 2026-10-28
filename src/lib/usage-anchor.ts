/**
 * Browser-side checks for Gatewayz daily usage anchoring.
 *
 * The API publishes one RFC 6962 (SHA-256) Merkle root per UTC day and writes
 * it to the UsageAnchor contract. Nothing here trusts the API's word for a
 * root: every root is read back from the chain over a public RPC, and an
 * inclusion proof is recomputed locally. Mirrors gatewayz-backend
 * src/services/chain/merkle.py and scripts/verify_usage_anchor.py. Same code as
 * gatewayz-beta-landing src/lib/usageAnchor.ts (the public /transparency page);
 * keep the two in step.
 */

export type AnchorView = {
  day: string;
  day_index: number;
  root: string;
  status: string;
  tx_hash: string | null;
  block_number: number | null;
  explorer_url: string | null;
};

export type AnchorsDoc = {
  configured: boolean;
  enabled: boolean;
  chain_id: number;
  network: string;
  contract_address: string | null;
  contract_explorer_url: string | null;
  anchorer: string | null;
  anchorer_explorer_url: string | null;
  proof_endpoint: string;
  anchors: AnchorView[];
};

export type Proof = {
  leaf: string;
  leaf_index: number;
  tree_size: number;
  proof: string[];
  day: string;
  day_index: number;
  chain_id: number;
  contract_address: string;
  tx_hash?: string | null;
};

/** Public RPCs for the chains the contract can live on. */
export const RPC_URLS: Record<number, string> = {
  43114: "https://api.avax.network/ext/bc/C/rpc",
  43113: "https://api.avax-test.network/ext/bc/C/rpc",
};

export const CHAIN_NAMES: Record<number, string> = {
  43114: "Avalanche C-Chain",
  43113: "Avalanche Fuji testnet",
};

const ROOT_OF_SELECTOR = "9d7384d9"; // rootOf(uint64)
const ZERO_ROOT = "0x" + "0".repeat(64);

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error(`not hex: ${hex}`);
  return Uint8Array.from(h.match(/../g) ?? [], (b) => parseInt(b, 16));
}

export const bytesToHex = (b: Uint8Array) => "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

export const leafHash = (leaf: string) => sha256(Uint8Array.of(0), new TextEncoder().encode(leaf));
const nodeHash = (l: Uint8Array, r: Uint8Array) => sha256(Uint8Array.of(1), l, r);

/** Root from a leaf hash and its audit path (RFC 9162 2.1.3.2); throws if the path doesn't fit the tree. */
export async function rootFromProof(index: number, treeSize: number, leaf: Uint8Array, path: Uint8Array[]) {
  if (!(index >= 0 && index < treeSize)) throw new Error(`leaf index ${index} out of range for tree size ${treeSize}`);
  let fn = index;
  let sn = treeSize - 1;
  let r = leaf;
  for (const p of path) {
    if (sn === 0) throw new Error("proof is longer than the tree allows");
    if (fn & 1 || fn === sn) {
      r = await nodeHash(p, r);
      while (!(fn & 1) && fn !== 0) {
        fn >>= 1;
        sn >>= 1;
      }
    } else {
      r = await nodeHash(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  if (sn !== 0) throw new Error("proof is shorter than the tree requires");
  return r;
}

/** rootOf(day) on the contract, as 0x-hex; the zero root means "not anchored". */
export async function readRootOnChain(chainId: number, contract: string, dayIndex: number): Promise<string> {
  const rpc = RPC_URLS[chainId];
  if (!rpc) throw new Error(`no public RPC known for chain ${chainId}`);
  const data = "0x" + ROOT_OF_SELECTOR + dayIndex.toString(16).padStart(64, "0");
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const body = await r.json();
  if (body.error) throw new Error(body.error.message ?? "RPC error");
  return String(body.result).toLowerCase();
}

export const isAnchoredRoot = (root: string) => root.toLowerCase() !== ZERO_ROOT;

export type ProofResult =
  | { ok: true; computedRoot: string; onchainRoot: string; leaf: Record<string, unknown> }
  | { ok: false; reason: string; computedRoot?: string; onchainRoot?: string };

/**
 * Verify a proof from the API against the chain. The contract and chain must
 * be the ones the API publishes; the root in the proof itself is ignored.
 */
export async function verifyProof(
  proof: Proof,
  published: { chain_id: number; contract_address: string | null },
  readRoot: typeof readRootOnChain = readRootOnChain,
): Promise<ProofResult> {
  if (!published.contract_address) return { ok: false, reason: "No contract is published yet." };
  if (proof.chain_id !== published.chain_id || proof.contract_address?.toLowerCase() !== published.contract_address.toLowerCase())
    return { ok: false, reason: "This proof points at a different chain or contract than the one Gatewayz publishes." };
  let leaf: Record<string, unknown>;
  try {
    leaf = JSON.parse(proof.leaf);
  } catch {
    return { ok: false, reason: "The proof's leaf is not valid JSON." };
  }
  if (typeof leaf.ts === "string" && !leaf.ts.startsWith(proof.day))
    return { ok: false, reason: `The record's timestamp is not on ${proof.day}.` };
  if (proof.day_index !== Math.floor(Date.parse(`${proof.day}T00:00:00Z`) / 86_400_000))
    return { ok: false, reason: "day and day_index disagree." };

  let computedRoot: string;
  try {
    const root = await rootFromProof(proof.leaf_index, proof.tree_size, await leafHash(proof.leaf), proof.proof.map(hexToBytes));
    computedRoot = bytesToHex(root);
  } catch (e) {
    return { ok: false, reason: `Malformed proof: ${(e as Error).message}` };
  }
  const onchainRoot = await readRoot(published.chain_id, published.contract_address, proof.day_index);
  if (!isAnchoredRoot(onchainRoot)) return { ok: false, reason: `${proof.day} is not anchored on-chain yet.`, computedRoot, onchainRoot };
  if (onchainRoot !== computedRoot)
    return { ok: false, reason: "The record does not match the root on-chain.", computedRoot, onchainRoot };
  return { ok: true, computedRoot, onchainRoot, leaf };
}
