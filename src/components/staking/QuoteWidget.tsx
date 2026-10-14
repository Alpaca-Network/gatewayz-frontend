"use client";

import { useState } from "react";

type Quote = {
  pool: string; stakeAda: number; epochs: number[]; sharesAda: number[];
  avgShareAda: number; minShareAda: number; maxShareAda: number;
  zeroRewardEpochs: number; epochsUnavailable: number;
  usdPerMonth: number; usdPerYear: number; adaPrice: number; error?: string;
};

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuoteWidget() {
  const [addr, setAddr] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [attested, setAttested] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<{ reply: string; model: string; callsLeft: number } | null>(null);
  const [aErr, setAErr] = useState("");
  const [asking, setAsking] = useState(false);

  async function quote() {
    setLoading(true); setQErr(""); setQ(null); setReply(null);
    try {
      const r = await fetch("/api/staking/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeAddress: addr.trim() }),
      });
      const d = (await r.json()) as Quote;
      if (d.error) setQErr(d.error); else setQ(d);
    } catch (e) { setQErr(String(e)); }
    setLoading(false);
  }

  async function ask() {
    setAsking(true); setAErr(""); setReply(null);
    try {
      const r = await fetch("/api/staking/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, attested }),
      });
      const d = await r.json();
      if (d.error) setAErr(d.error + (d.detail ? ` — ${d.detail}` : "")); else setReply(d);
    } catch (e) { setAErr(String(e)); }
    setAsking(false);
  }

  const max = q ? Math.max(...q.sharesAda, 0.000001) : 1;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="stakeaddr" className="block text-sm text-muted-foreground mb-1.5">
          Your Cardano stake address
        </label>
        <input
          id="stakeaddr" value={addr} onChange={(e) => setAddr(e.target.value)}
          placeholder="stake1u..." spellCheck={false} autoComplete="off"
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
        />
        <button
          onClick={quote} disabled={loading || !addr.trim()}
          className="mt-2.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Reading the chain…" : "See what it funds"}
        </button>
        {qErr && <p className="mt-2 text-sm text-destructive">{qErr}</p>}
      </div>

      {q && (
        <div className="rounded-md border p-4 space-y-2 text-sm">
          <Row l="Your stake" r={`${q.stakeAda.toLocaleString(undefined, { maximumFractionDigits: 0 })} ADA`} />
          <Row l={`Average over the last ${q.epochs.length} settled epochs`}
               r={`${q.avgShareAda.toFixed(4)} ADA / epoch`} />
          <Row l="Range across those epochs"
               r={`${q.minShareAda.toFixed(3)} – ${q.maxShareAda.toFixed(3)} ADA`} />
          <Row l="Funds roughly" r={<span className="text-lg font-bold text-emerald-500">{usd(q.usdPerMonth)} / mo</span>} />
          <div className="flex items-end gap-1 h-8 pt-1">
            {q.sharesAda.map((s, i) => (
              <i key={i} title={`${s.toFixed(3)} ADA`}
                 className="flex-1 rounded-sm bg-primary/60"
                 style={{ height: `${Math.max(3, (s / max) * 32)}px` }} />
            ))}
          </div>
          <p className="pt-1 font-mono text-[11px] text-muted-foreground">
            epochs {q.epochs.join(", ")} · ADA ${q.adaPrice}
            {q.zeroRewardEpochs > 0 &&
              ` · ${q.zeroRewardEpochs} epoch(s) the pool minted nothing, kept in the average`}
            {q.epochsUnavailable > 0 && ` · ${q.epochsUnavailable} unavailable from the indexer`}
          </p>
          <p className="text-xs text-muted-foreground border-l-2 border-amber-500/60 pl-3">
            Shown as an <b>average</b> on purpose. A pool&apos;s rewards swing with how
            many blocks it happens to mint — we have measured the same delegation
            differ by <b>3.4×</b> between two epochs. One epoch&apos;s number would
            mislead you.
          </p>
        </div>
      )}

      <div className="rounded-md border border-amber-500/40 p-3">
        <label className="flex items-start gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)}
                 className="mt-1" />
          <span>
            I confirm I am <b>not a US person and not a Canadian person</b>, I have read the{" "}
            <a href="/staking/terms" className="text-primary underline">terms</a>, and I understand
            this is a preview with <b>no guaranteed return</b>.
          </span>
        </label>
      </div>

      <div>
        <label htmlFor="pr" className="block text-sm text-muted-foreground mb-1.5">Ask something</label>
        <textarea id="pr" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What is non-custodial delegation?"
                  className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm" />
        <button onClick={ask} disabled={asking || !attested || !prompt.trim() || !q}
                className="mt-2.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {asking ? "Asking…" : "Ask — paid from your rewards"}
        </button>
        {aErr && <p className="mt-2 text-sm text-destructive">{aErr}</p>}
        {reply && (
          <div className="mt-3 rounded-md border bg-muted/40 p-3.5">
            <p className="whitespace-pre-wrap text-sm">{reply.reply}</p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {reply.model} · {reply.callsLeft} preview calls remaining
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ l, r }: { l: string; r: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{l}</span>
      <span className="font-mono tabular-nums">{r}</span>
    </div>
  );
}
