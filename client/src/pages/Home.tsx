import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/elevenlabs/conversation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collectionNameFromUrl, commandIntent, firstPublicUrl } from "@/lib/codexCommand";
import { trpc } from "@/lib/trpc";
import { ArrowUp, BookOpen, Check, ChevronRight, ExternalLink, Globe2, Loader2, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Answer = {
  status: "evidence" | "insufficient-evidence";
  collection: string;
  answerMode: string;
  answer: string;
  citations: Array<{ id: number; title: string; url: string; headingPath: string; excerpt: string; score: number }>;
  relatedEntries: Array<{ title: string; headingPath: string }>;
  synthesized: boolean;
};

type Proposal = {
  rootUrl: string;
  host: string;
  name: string;
  urls: Array<{ url: string; path: string }>;
  estimatedPageCount: number;
  robotsNotice: string;
};

type ProfileDraft = {
  name: string;
  scope: string;
  audience: string;
  tone: string;
  answerMode: "extractive" | "source-backed" | "labeled-synthesis";
  aiSynthesisEnabled: boolean;
};

type ChatTurn =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "note"; text: string }
  | { id: string; kind: "answer"; question: string; answer: Answer }
  | { id: string; kind: "proposal"; proposal: Proposal };

const id = () => crypto.randomUUID();

function CommandBar({ value, onChange, onSubmit, busy, compact = false, inputRef }: { value: string; onChange: (value: string) => void; onSubmit: () => void; busy: boolean; compact?: boolean; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className={`flex w-full items-center gap-3 rounded-full bg-foreground text-background shadow-[0_18px_50px_rgba(0,0,0,.18)] transition-shadow focus-within:shadow-[0_20px_58px_rgba(0,0,0,.28)] ${compact ? "px-4 py-2" : "px-5 py-3"}`}>
    <BookOpen className={`shrink-0 opacity-65 ${compact ? "h-4 w-4" : "h-5 w-5"}`} aria-hidden />
    <input ref={inputRef} autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ask Codex or add a website" className={`min-w-0 flex-1 bg-transparent text-background outline-none placeholder:text-background/45 ${compact ? "text-sm" : "text-base"}`} />
    <button type="submit" disabled={!value.trim() || busy} className={`flex shrink-0 items-center justify-center rounded-full bg-background text-foreground transition-transform active:scale-95 disabled:opacity-35 ${compact ? "h-7 w-7" : "h-9 w-9"}`} aria-label="Send command">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
  </form>;
}

function CitationList({ citations }: { citations: Answer["citations"] }) {
  return <div className="mt-7 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Sources</p><div className="mt-3 space-y-3">{citations.map((citation, index) => <div className="flex gap-3 text-sm" key={citation.id}><span className="font-mono text-xs text-muted-foreground">{index + 1}.</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{citation.title}</p><a className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" href={citation.url} target="_blank" rel="noreferrer">Open <ExternalLink className="h-3 w-3" /></a></div><p className="mt-1 text-xs text-muted-foreground">{citation.headingPath}</p><p className="mt-2 leading-6 text-muted-foreground">{citation.excerpt}</p></div></div>)}</div></div>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [command, setCommand] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ name: "", scope: "", audience: "", tone: "", answerMode: "extractive", aiSynthesisEnabled: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const activeInput = useMemo(() => ({ collectionId: activeCollectionId ?? 0 }), [activeCollectionId]);
  const collections = trpc.collections.list.useQuery(undefined, { enabled: isAuthenticated });
  const detail = trpc.collections.get.useQuery(activeInput, { enabled: isAuthenticated && activeCollectionId !== null });
  const preview = trpc.collections.preview.useMutation();
  const create = trpc.collections.create.useMutation();
  const startImport = trpc.collections.startImport.useMutation();
  const continueImport = trpc.collections.continueImport.useMutation();
  const answer = trpc.collections.answer.useMutation();
  const refresh = trpc.collections.refresh.useMutation();
  const updateProfile = trpc.collections.updateProfile.useMutation();
  const utils = trpc.useUtils();
  const busy = preview.isPending || create.isPending || startImport.isPending || continueImport.isPending || refresh.isPending || updateProfile.isPending || answer.isPending;
  const awake = turns.length > 0;

  useEffect(() => {
    if (!activeCollectionId && collections.data?.[0]) setActiveCollectionId(collections.data[0].id);
  }, [activeCollectionId, collections.data]);

  useEffect(() => {
    const collection = detail.data?.collection;
    if (!collection) return;
    setProfileDraft({ name: collection.name, scope: collection.scope, audience: collection.audience, tone: collection.tone, answerMode: collection.answerMode, aiSynthesisEnabled: collection.aiSynthesisEnabled });
  }, [detail.data?.collection]);

  function append(turn: ChatTurn) { setTurns((current) => [...current, turn]); }

  async function interpretCommand() {
    const text = command.trim();
    if (!text || busy) return;
    if (!isAuthenticated) { startLogin(); return; }
    setCommand("");
    append({ id: id(), kind: "user", text });
    const intent = commandIntent(text);
    const website = firstPublicUrl(text);
    if (intent === "collection") {
      setSourcesOpen(true);
      append({ id: id(), kind: "note", text: "Codex opened your sources. You can inspect a collection or ask it to refresh when you are ready." });
      return;
    }
    if (intent === "source" && website) {
      try {
        const scope = await preview.mutateAsync({ rootUrl: website, includePaths: "/", excludePaths: "/login, /account, /privacy, /terms", pageLimit: 12 });
        append({ id: id(), kind: "proposal", proposal: { rootUrl: website, host: scope.host, name: collectionNameFromUrl(website), urls: scope.discoveredUrls.map((item) => ({ url: item.url, path: item.path })), estimatedPageCount: scope.estimatedPageCount, robotsNotice: scope.robotsNotice } });
      } catch (error) {
        append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Codex could not inspect that website." });
      }
      return;
    }
    const targetCollection = activeCollectionId ?? collections.data?.[0]?.id;
    if (!targetCollection) {
      append({ id: id(), kind: "note", text: "Codex needs a source collection first. Paste a public website URL and it will prepare the import for you." });
      return;
    }
    try {
      const result = await answer.mutateAsync({ collectionId: targetCollection, question: text, useOptionalSynthesis: detail.data?.collection.aiSynthesisEnabled ?? false });
      append({ id: id(), kind: "answer", question: text, answer: result });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Codex could not complete that lookup." });
    }
  }

  async function approveProposal(proposal: Proposal) {
    try {
      const created = await create.mutateAsync({ name: proposal.name, rootUrl: proposal.rootUrl, scope: `A bounded reference collection from ${proposal.host}.`, audience: "A careful general reader", tone: "Clear, direct, and evidence-led", answerMode: "extractive", includePaths: "/", excludePaths: "/login, /account, /privacy, /terms", pageLimit: Math.min(12, proposal.urls.length || 1) });
      setActiveCollectionId(created.collectionId);
      let batch = await startImport.mutateAsync({ collectionId: created.collectionId, urls: proposal.urls.slice(0, 12).map((item) => item.url) });
      let processed = batch.processed;
      let unchanged = batch.unchanged;
      let failed = batch.failed;
      while (!batch.complete) {
        batch = await continueImport.mutateAsync({ batchId: batch.batchId });
        processed += batch.processed;
        unchanged += batch.unchanged;
        failed += batch.failed;
      }
      await utils.collections.list.invalidate();
      await utils.collections.get.invalidate({ collectionId: created.collectionId });
      append({ id: id(), kind: "note", text: `${proposal.name} is ready. Codex imported ${processed} page${processed === 1 ? "" : "s"}${unchanged ? ` and kept ${unchanged} unchanged page${unchanged === 1 ? "" : "s"}` : ""}${failed ? `; ${failed} page${failed === 1 ? " needs" : "s need"} attention` : ""}. It saved source snapshots and will now keep answers inside this collection.` });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Codex could not import that collection." });
    }
  }

  async function refreshActiveSource() {
    if (!activeCollectionId || !detail.data?.collection) return;
    const collectionName = detail.data.collection.name;
    setSourcesOpen(false);
    append({ id: id(), kind: "note", text: `Codex is checking ${collectionName} for changes.` });
    try {
      let batch = await refresh.mutateAsync({ collectionId: activeCollectionId });
      let processed = batch.processed;
      let unchanged = batch.unchanged;
      let failed = batch.failed;
      while (!batch.complete) {
        batch = await continueImport.mutateAsync({ batchId: batch.batchId });
        processed += batch.processed;
        unchanged += batch.unchanged;
        failed += batch.failed;
      }
      await utils.collections.get.invalidate(activeInput);
      await utils.collections.list.invalidate();
      append({ id: id(), kind: "note", text: `${collectionName} is current. ${processed ? `${processed} page${processed === 1 ? " was" : "s were"} updated` : "No pages changed"}${unchanged ? `; ${unchanged} unchanged` : ""}${failed ? `; ${failed} needs attention` : ""}.` });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : `Codex could not refresh ${collectionName}.` });
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!activeCollectionId) return;
    try {
      await updateProfile.mutateAsync({ collectionId: activeCollectionId, profile: profileDraft });
      await utils.collections.get.invalidate(activeInput);
      await utils.collections.list.invalidate();
      setProfileOpen(false);
      append({ id: id(), kind: "note", text: `${profileDraft.name} now uses its updated expert framing. Source evidence remains the boundary for every answer.` });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Codex could not update that expert profile." });
    }
  }

  return <div className="min-h-dvh bg-background text-foreground">
    {awake && <header className="flex h-14 items-center justify-between border-b border-border px-5 sm:px-7">
      <button className="font-serif text-xl tracking-tight" onClick={() => { setTurns([]); setCommand(""); inputRef.current?.focus(); }}>Codex</button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {isAuthenticated && <button onClick={() => setSourcesOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"><Globe2 className="h-3.5 w-3.5" /> Sources{collections.data?.length ? ` · ${collections.data.length}` : ""}</button>}
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAuthenticated ? <button className="hover:text-foreground" onClick={logout}>Sign out</button> : <button className="hover:text-foreground" onClick={() => startLogin()}>Sign in</button>}
      </div>
    </header>}

    {!awake ? <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-6 pb-28 text-center">
      <div className="mb-8 enter-up"><h1 className="font-serif text-5xl tracking-tight sm:text-6xl">Codex</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">A personal encyclopedia that works from the sources you choose.</p></div>
      <div className="w-full enter-up"><CommandBar inputRef={inputRef} value={command} onChange={setCommand} onSubmit={interpretCommand} busy={busy} /></div>
      <p className="mt-4 text-xs text-muted-foreground">Press Enter to ask a question or add a public website.</p>
    </main> : <main className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-3xl flex-col px-5 sm:px-7">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl space-y-7 py-8 sm:py-12">
          {turns.map((turn) => <div key={turn.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {turn.kind === "user" && <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-foreground px-4 py-3 text-sm leading-6 text-background">{turn.text}</div>}
            {turn.kind === "note" && <div className="max-w-[88%] rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm leading-6">{turn.text}</div>}
            {turn.kind === "proposal" && <div className="max-w-[92%] border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">Codex prepared a source proposal</p><p className="mt-1 text-sm text-muted-foreground">{turn.proposal.name} · {turn.proposal.host}</p></div><Sparkles className="h-4 w-4 text-muted-foreground" /></div><p className="mt-5 text-sm leading-6">It found {turn.proposal.estimatedPageCount} pages and selected {Math.min(12, turn.proposal.urls.length)} useful starting pages. The import stays within this site and skips account, legal, and privacy paths.</p><div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => approveProposal(turn.proposal)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40"><Check className="h-3.5 w-3.5" /> Approve and import</button><button onClick={() => setReviewOpen(true)} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">Review source</button></div></div>}
            {turn.kind === "answer" && <article className="max-w-2xl"><p className="text-xs text-muted-foreground">{turn.answer.status === "evidence" ? `From ${turn.answer.collection}` : "Evidence boundary"}</p><h2 className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{turn.question}</h2>{turn.answer.synthesized ? <p className="mt-5 text-[17px] leading-8">{turn.answer.answer}</p> : <div className="mt-5 space-y-4 text-[17px] leading-8">{turn.answer.status === "evidence" ? turn.answer.citations.map((citation, index) => <p key={citation.id}>{citation.excerpt} <a href={citation.url} target="_blank" rel="noreferrer" className="font-mono text-xs underline underline-offset-4">[{index + 1}]</a></p>) : <p>{turn.answer.answer}</p>}</div>}{turn.answer.citations.length > 0 && <CitationList citations={turn.answer.citations} />}{turn.answer.relatedEntries.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{turn.answer.relatedEntries.map((entry) => <button key={`${entry.title}-${entry.headingPath}`} onClick={() => setCommand(entry.title)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{entry.title}</button>)}</div>}</article>}
          </div>)}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border py-4"><CommandBar compact value={command} onChange={setCommand} onSubmit={interpretCommand} busy={busy} /></div>
    </main>}

    <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}><DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Sources</DialogTitle><DialogDescription>Collections stay out of the way until you need to inspect or maintain them.</DialogDescription></DialogHeader><div className="grid gap-0 sm:grid-cols-[185px_1fr]"><aside className="border-b border-border p-3 sm:border-r sm:border-b-0">{collections.data?.map((collection) => <button key={collection.id} onClick={() => { setActiveCollectionId(collection.id); setProfileOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeCollectionId === collection.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}>{collection.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{collection.pageCount} pages</span></button>)}<button onClick={() => { setSourcesOpen(false); setTurns([]); setCommand(""); setTimeout(() => inputRef.current?.focus(), 100); }} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /> Add a website</button></aside><section className="p-5">{detail.data?.collection ? <><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{detail.data.collection.name}</p><a className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-4" href={detail.data.collection.rootUrl} target="_blank" rel="noreferrer">{detail.data.collection.rootUrl}</a></div><div className="flex gap-2"><button onClick={() => setProfileOpen((open) => !open)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">{profileOpen ? "Close profile" : "Profile"}</button><button onClick={refreshActiveSource} disabled={refresh.isPending || continueImport.isPending} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"><RefreshCw className={`h-3 w-3 ${refresh.isPending || continueImport.isPending ? "animate-spin" : ""}`} /> Refresh</button></div></div>{profileOpen && <form onSubmit={saveProfile} className="mt-5 space-y-4 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Expert framing changes how Codex presents material, never what its sources establish.</p><label className="block text-xs">Name<input required value={profileDraft.name} onChange={(event) => setProfileDraft((draft) => ({ ...draft, name: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label><label className="block text-xs">Scope<textarea required value={profileDraft.scope} onChange={(event) => setProfileDraft((draft) => ({ ...draft, scope: event.target.value }))} className="mt-1 min-h-18 w-full border border-border bg-background px-3 py-2 text-sm" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs">Audience<input required value={profileDraft.audience} onChange={(event) => setProfileDraft((draft) => ({ ...draft, audience: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label><label className="block text-xs">Tone<input required value={profileDraft.tone} onChange={(event) => setProfileDraft((draft) => ({ ...draft, tone: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label></div><label className="block text-xs">Answer mode<select value={profileDraft.answerMode} onChange={(event) => setProfileDraft((draft) => ({ ...draft, answerMode: event.target.value as ProfileDraft["answerMode"] }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"><option value="extractive">Extractive</option><option value="source-backed">Source-backed</option><option value="labeled-synthesis">Labeled synthesis</option></select></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profileDraft.aiSynthesisEnabled} onChange={(event) => setProfileDraft((draft) => ({ ...draft, aiSynthesisEnabled: event.target.checked }))} /> Optional synthesis may use credits</label><button disabled={updateProfile.isPending} className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">Save framing</button></form>}<p className="mt-5 text-xs leading-5 text-muted-foreground">{detail.data.collection.scope}</p><div className="mt-6 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Saved pages</p><div className="mt-3 space-y-3">{detail.data.pages.map((page) => <div key={page.id} className="flex items-start gap-2 text-sm"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground" /><div className="min-w-0"><p className="truncate">{page.pageTitle}</p><a className="block truncate text-xs text-muted-foreground" href={page.canonicalUrl} target="_blank" rel="noreferrer">{new URL(page.canonicalUrl).pathname || "/"}</a></div></div>)}</div></div></> : <p className="text-sm text-muted-foreground">Paste a public website into Codex to create your first source collection.</p>}</section></div></DialogContent></Dialog>

    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Source review</DialogTitle><DialogDescription>Codex does the selection; you retain the final approval.</DialogDescription></DialogHeader><div className="divide-y divide-border">{turns.filter((turn): turn is Extract<ChatTurn, { kind: "proposal" }> => turn.kind === "proposal").flatMap((turn) => turn.proposal.urls).map((source) => <div key={source.url} className="flex items-start gap-3 p-4"><Check className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0"><p className="text-sm">{source.path || "/"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{source.url}</p></div></div>)}</div></DialogContent></Dialog>
  </div>;
}
