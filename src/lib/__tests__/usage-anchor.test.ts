/**
 * @jest-environment node
 */
import { bytesToHex, hexToBytes, leafHash, rootFromProof, verifyProof, type Proof } from "../usage-anchor";

// Generated with gatewayz-backend src/services/chain/merkle.py (merkle_root,
// inclusion_proof) so the browser verifier is held to the backend's answers.
const leaf = (i: number) =>
  `{"cost":"0.001","id":${1000 + i},"model":"m","salt":"${"ab".repeat(32)}","tokens_in":${i},"tokens_out":${2 * i},"ts":"2026-10-27T1${i}:00:00Z","v":1}`;
const ROOT = "0x455b59e81032d7376d01b62868df201b884937eb27299aecf09e258245ed9e09";
const PROOFS = [
  ["0xed98d2fba3d266a3b59568149bdfa8883d971fc695a42b89c55ff7f23ee4c5a3", "0x708e525acd478a0ff40effd79da1739a906c7afc1223d84fb388c409115f3235", "0xab95b53f3c1cbc1ffc4e6834faad659fe2c5103e0be1aae4e0ece5b741d297cd"],
  ["0x09f9fa8b05e84eaa9863348dd54c5072ad1bdd29ba13b176416fdcbb3f9cf10f", "0x708e525acd478a0ff40effd79da1739a906c7afc1223d84fb388c409115f3235", "0xab95b53f3c1cbc1ffc4e6834faad659fe2c5103e0be1aae4e0ece5b741d297cd"],
  ["0xd43fb0fad7ea50ac8b672813200a9b13a3b83b0938bb86d557f0e201ed046a71", "0x0a745d3a3e0e4f40c1f9dbf779e8351e4916245108c3d9dedb9fe33eec2a6a52", "0xab95b53f3c1cbc1ffc4e6834faad659fe2c5103e0be1aae4e0ece5b741d297cd"],
  ["0x8865052d81ed5542bb9c01aee34c113e29d28e79a21eef22a1e6ea92ec3f1ebf", "0x0a745d3a3e0e4f40c1f9dbf779e8351e4916245108c3d9dedb9fe33eec2a6a52", "0xab95b53f3c1cbc1ffc4e6834faad659fe2c5103e0be1aae4e0ece5b741d297cd"],
  ["0xbd657f1884b35c13c9d7560e092883d45caeb6b6e138b853a4678311c9f67cc1"],
];
const CONTRACT = "0x00000000000000000000000000000000000000aa";
const DAY_INDEX = 20753; // 2026-10-27

const proofFor = (i: number): Proof => ({
  leaf: leaf(i),
  leaf_index: i,
  tree_size: 5,
  proof: PROOFS[i],
  day: "2026-10-27",
  day_index: DAY_INDEX,
  chain_id: 43114,
  contract_address: CONTRACT,
});
const published = { chain_id: 43114, contract_address: CONTRACT };

describe("rootFromProof", () => {
  it.each([0, 1, 2, 3, 4])("leaf %i recomputes the backend's root", async (i) => {
    const root = await rootFromProof(i, 5, await leafHash(leaf(i)), PROOFS[i].map(hexToBytes));
    expect(bytesToHex(root)).toBe(ROOT);
  });

  it("rejects a path of the wrong length", async () => {
    await expect(rootFromProof(4, 5, await leafHash(leaf(4)), [...PROOFS[4], ...PROOFS[4]].map(hexToBytes))).rejects.toThrow(/longer/);
    await expect(rootFromProof(0, 5, await leafHash(leaf(0)), PROOFS[0].slice(1).map(hexToBytes))).rejects.toThrow(/shorter/);
  });
});

describe("verifyProof", () => {
  it("accepts a record whose root is on-chain", async () => {
    const read = jest.fn(async () => ROOT);
    const r = await verifyProof(proofFor(3), published, read);
    expect(r.ok).toBe(true);
    expect(read).toHaveBeenCalledWith(43114, CONTRACT, DAY_INDEX);
  });

  it("reads the root from the chain, never from the proof", async () => {
    const r = await verifyProof({ ...proofFor(3), root: ROOT } as Proof, published, async () => "0x" + "11".repeat(32));
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/does not match/) });
  });

  it("fails a tampered record", async () => {
    const bad = { ...proofFor(3), leaf: leaf(3).replace('"tokens_in":3', '"tokens_in":4') };
    expect((await verifyProof(bad, published, async () => ROOT)).ok).toBe(false);
  });

  it("refuses a proof for another contract or chain", async () => {
    const read = jest.fn(async () => ROOT);
    expect((await verifyProof({ ...proofFor(0), contract_address: "0x" + "bb".repeat(20) }, published, read)).ok).toBe(false);
    expect((await verifyProof({ ...proofFor(0), chain_id: 43113 }, published, read)).ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it("says when the day is not anchored yet", async () => {
    const r = await verifyProof(proofFor(0), published, async () => "0x" + "0".repeat(64));
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/not anchored/) });
  });

  it("refuses a record from another day", async () => {
    const r = await verifyProof({ ...proofFor(0), day: "2026-10-26", day_index: DAY_INDEX - 1 }, published, async () => ROOT);
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/not on 2026-10-26/) });
  });
});
