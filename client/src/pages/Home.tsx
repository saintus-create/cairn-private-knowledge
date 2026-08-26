import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/elevenlabs/conversation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collectionNameFromUrl, commandIntent, firstPublicUrl } from "@/lib/codexCommand";
import { getComposerSuggestions } from "@/lib/composerSuggestions";
import { trpc } from "@/lib/trpc";
import { ArrowUp, BookOpen, Check, ChevronRight, ExternalLink, FileUp, Globe2, LibraryBig, Loader2, LogOut, Paperclip, Plus, RefreshCw, Sparkles, X } from "lucide-react";
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
const sourcePath = (value: string) => new URL(value, "https://cairn.local").pathname || "/";

type ComposerMode = "idle" | "document" | "web";

function CommandBar({ value, onChange, onSubmit, busy, compact = false, expanded: _expanded = false, inputRef, onFocus, onBlur, onUpload, onWebSource, onSources, mode = "idle", onModeChange }: { value: string; onChange: (value: string) => void; onSubmit: () => void; busy: boolean; compact?: boolean; expanded?: boolean; inputRef?: React.RefObject<HTMLInputElement | null>; onFocus?: () => void; onBlur?: () => void; onUpload?: () => void; onWebSource?: () => void; onSources?: () => void; mode?: ComposerMode; onModeChange?: (mode: ComposerMode) => void }) {
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const selectMode = (next: Exclude<ComposerMode, "idle">) => onModeChange?.(mode === next ? "idle" : next);
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className={`flex w-full flex-col overflow-hidden rounded-[26px] bg-foreground text-background shadow-[0_18px_50px_rgba(0,0,0,.18)] transition-shadow duration-200 ease-out focus-within:shadow-[0_20px_58px_rgba(0,0,0,.28)] ${compact ? "" : ""}`}>
    <div className={`flex w-full items-center gap-3 ${compact ? "px-4 py-2.5" : "px-5 py-3.5"}`}>
      <BookOpen className={`shrink-0 opacity-65 ${compact ? "h-4 w-4" : "h-5 w-5"}`} aria-hidden />
      <input ref={inputRef} value={value} onFocus={onFocus} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} placeholder="Ask Cairn · https://…" className={`min-w-0 flex-1 bg-transparent text-background outline-none placeholder:text-background/45 ${compact ? "text-sm" : "text-base"}`} />
      <button type="submit" disabled={!value.trim() || busy} className={`flex shrink-0 items-center justify-center rounded-full bg-background text-foreground transition-transform active:scale-95 disabled:opacity-35 ${compact ? "h-7 w-7" : "h-9 w-9"}`} aria-label="Send command">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
    </div>
    <div className={`flex items-center gap-1 border-t border-background/10 ${compact ? "px-3 py-1.5" : "px-4 py-2"}`} aria-label="Source actions">
      {onUpload && <button type="button" title="Add a private document" onClick={() => selectMode("document")} className={`flex items-center justify-center rounded-full transition-colors ${mode === "document" ? "bg-background text-foreground" : "text-background/70 hover:bg-background/10 hover:text-background"} ${compact ? "h-7 w-7" : "h-8 w-8"}`} aria-label="Add a private document"><Paperclip className={iconSize} /></button>}
      {onWebSource && <button type="button" title="Add a web source" onClick={() => selectMode("web")} className={`flex items-center justify-center rounded-full transition-colors ${mode === "web" ? "bg-background text-foreground" : "text-background/70 hover:bg-background/10 hover:text-background"} ${compact ? "h-7 w-7" : "h-8 w-8"}`} aria-label="Add a web source"><Globe2 className={iconSize} /></button>}
      {onSources && <button type="button" title="Open sources" onClick={onSources} className={`flex items-center justify-center rounded-full text-background/70 transition-colors hover:bg-background/10 hover:text-background ${compact ? "h-7 w-7" : "h-8 w-8"}`} aria-label="Open sources"><LibraryBig className={iconSize} /></button>}
    </div>
    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${mode === "idle" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}><div className="overflow-hidden"><div className={`flex items-center gap-3 border-t border-background/10 ${compact ? "px-4 py-2" : "px-5 py-3"}`}>{mode === "document" ? <><FileUp className={iconSize} /><span className="min-w-0 flex-1 text-sm text-background/80">Private PDF, text, or Markdown</span><button type="button" onClick={onUpload} className="rounded-full bg-background px-3 py-1.5 text-xs font-medium text-foreground">Choose file</button></> : <><Globe2 className={iconSize} /><span className="min-w-0 flex-1 text-sm text-background/80">Prepare a bounded web source</span><button type="button" onClick={onWebSource} className="rounded-full bg-background px-3 py-1.5 text-xs font-medium text-foreground">Use URL</button></>}<button type="button" onClick={() => onModeChange?.("idle")} className="rounded-full p-1 text-background/65 hover:bg-background/10 hover:text-background" aria-label="Close source action"><X className={iconSize} /></button></div></div></div>
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStage, setUploadStage] = useState<"Preparing file" | "Reading pages" | "Indexing evidence" | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("idle");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ name: "", scope: "", audience: "", tone: "", answerMode: "extractive", aiSynthesisEnabled: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const uploadDocument = trpc.collections.uploadDocument.useMutation();
  const utils = trpc.useUtils();
  const busy = preview.isPending || create.isPending || startImport.isPending || continueImport.isPending || refresh.isPending || updateProfile.isPending || answer.isPending || uploadDocument.isPending;
  const awake = turns.length > 0;
  const composerExpanded = !awake && command.trim().length > 0;
  const composerSuggestions = useMemo(() => getComposerSuggestions({ query: command, expanded: composerExpanded, collection: detail.data?.collection, pages: detail.data?.pages ?? [] }), [command, composerExpanded, detail.data?.collection, detail.data?.pages]);

  useEffect(() => {
    if (!activeCollectionId && collections.data?.[0]) setActiveCollectionId(collections.data[0].id);
  }, [activeCollectionId, collections.data]);

  useEffect(() => {
    const collection = detail.data?.collection;
    if (!collection) return;
    setProfileDraft({ name: collection.name, scope: collection.scope, audience: collection.audience, tone: collection.tone, answerMode: collection.answerMode, aiSynthesisEnabled: collection.aiSynthesisEnabled });
  }, [detail.data?.collection]);

  useEffect(() => {
    if (uploadStage !== "Reading pages") return;
    const timer = window.setTimeout(() => setUploadStage("Indexing evidence"), 900);
    return () => window.clearTimeout(timer);
  }, [uploadStage]);

  function append(turn: ChatTurn) { setTurns((current) => [...current, turn]); }

  function fileAsBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Cairn could not read that file."));
      reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
      reader.readAsDataURL(file);
    });
  }

  async function importPrivateDocument(file: File) {
    if (!isAuthenticated) { startLogin(); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Choose a document smaller than 20 MB."); return; }
    setUploadOpen(true);
    setUploadStage("Preparing file");
    try {
      const base64 = await fileAsBase64(file);
      setUploadStage("Reading pages");
      const result = await uploadDocument.mutateAsync({ fileName: file.name, mimeType: file.type || "application/octet-stream", base64 });
      setUploadStage("Indexing evidence");
      await utils.collections.list.invalidate();
      await utils.collections.get.invalidate({ collectionId: result.collectionId });
      setActiveCollectionId(result.collectionId);
      setUploadOpen(false);
      append({ id: id(), kind: "note", text: `${result.fileName} is ready. Cairn indexed ${result.passageCount} evidence passage${result.passageCount === 1 ? "" : "s"} and will keep answers inside this document.` });
      setTurns((current) => current.length ? current : [{ id: id(), kind: "note", text: `${result.fileName} is ready. Ask it anything the document supports.` }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cairn could not import that document.";
      toast.error(message);
      append({ id: id(), kind: "note", text: message });
    } finally {
      setUploadStage(null);
    }
  }

  async function interpretCommand() {
    const text = command.trim();
    if (!text || busy) return;
    if (!isAuthenticated) { startLogin(); return; }
    setComposerMode("idle");
    setCommand("");
    append({ id: id(), kind: "user", text });
    const intent = commandIntent(text);
    const website = firstPublicUrl(text);
    if (intent === "collection") {
      setSourcesOpen(true);
      append({ id: id(), kind: "note", text: "Cairn opened your sources. You can inspect a collection or ask it to refresh when you are ready." });
      return;
    }
    if (intent === "source" && website) {
      try {
        const scope = await preview.mutateAsync({ rootUrl: website, includePaths: "/", excludePaths: "/login, /account, /privacy, /terms", pageLimit: 12 });
        append({ id: id(), kind: "proposal", proposal: { rootUrl: website, host: scope.host, name: collectionNameFromUrl(website), urls: scope.discoveredUrls.map((item) => ({ url: item.url, path: item.path })), estimatedPageCount: scope.estimatedPageCount, robotsNotice: scope.robotsNotice } });
      } catch (error) {
        append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Cairn could not inspect that web source." });
      }
      return;
    }
    const targetCollection = activeCollectionId ?? collections.data?.[0]?.id;
    if (!targetCollection) {
      append({ id: id(), kind: "note", text: "Cairn needs a source first. Add a private document or a public web source and it will prepare the evidence for you." });
      return;
    }
    try {
      const result = await answer.mutateAsync({ collectionId: targetCollection, question: text, useOptionalSynthesis: detail.data?.collection.aiSynthesisEnabled ?? false });
      append({ id: id(), kind: "answer", question: text, answer: result });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Cairn could not complete that lookup." });
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
      append({ id: id(), kind: "note", text: `${proposal.name} is ready. Cairn imported ${processed} page${processed === 1 ? "" : "s"}${unchanged ? ` and kept ${unchanged} unchanged page${unchanged === 1 ? "" : "s"}` : ""}${failed ? `; ${failed} page${failed === 1 ? " needs" : "s need"} attention` : ""}. It saved source snapshots and will now keep answers inside this collection.` });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Cairn could not import that collection." });
    }
  }

  async function refreshActiveSource() {
    if (!activeCollectionId || !detail.data?.collection) return;
    const collectionName = detail.data.collection.name;
    setSourcesOpen(false);
    append({ id: id(), kind: "note", text: `Cairn is checking ${collectionName} for changes.` });
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
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : `Cairn could not refresh ${collectionName}.` });
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
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Cairn could not update that expert profile." });
    }
  }

  return <div className={`${awake ? "min-h-dvh" : "h-[100svh] overflow-hidden"} bg-background text-foreground`}>
    {awake && <header className="flex h-14 items-center justify-between border-b border-border px-5 sm:px-7">
      <button className="font-serif text-xl tracking-tight" onClick={() => { setTurns([]); setCommand(""); inputRef.current?.focus(); }}>Cairn</button>
      <nav className="flex items-center gap-1.5" aria-label="Cairn actions">
        {isAuthenticated && <><button title="Upload document" aria-label="Upload document" onClick={() => setUploadOpen(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><FileUp className="h-3.5 w-3.5" /></button><button title="Sources" aria-label="Sources" onClick={() => setSourcesOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><LibraryBig className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sources{collections.data?.length ? ` · ${collections.data.length}` : ""}</span></button></>}
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : isAuthenticated ? <button title="Sign out" aria-label="Sign out" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={logout}><LogOut className="h-3.5 w-3.5" /></button> : <button className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => startLogin()}>Sign in</button>}
      </nav>
    </header>}

    {!awake ? <><main className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-6 text-center"><h1 className="enter-up font-serif text-5xl tracking-tight sm:text-6xl">Cairn</h1></main><div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:px-7 sm:pb-0"><div className="mx-auto w-full max-w-2xl"><div className={`mb-2 space-y-1.5 transition-[max-height,opacity,transform] duration-200 ease-out ${composerSuggestions.length ? "max-h-56 translate-y-0 opacity-100" : "max-h-0 translate-y-2 overflow-hidden opacity-0"}`}>{composerSuggestions.map((suggestion) => <button key={`${suggestion.label}-${suggestion.detail}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCommand(suggestion.command); inputRef.current?.focus(); }} className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-background/95 px-3 py-2 text-left shadow-sm backdrop-blur-sm hover:bg-muted"><span className="min-w-0"><span className="block truncate text-sm font-medium">{suggestion.label}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{suggestion.detail}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div><CommandBar inputRef={inputRef} expanded={composerExpanded} value={command} onChange={setCommand} onSubmit={interpretCommand} busy={busy} mode={composerMode} onModeChange={setComposerMode} onUpload={() => setUploadOpen(true)} onWebSource={() => { setCommand("https://"); setComposerMode("idle"); inputRef.current?.focus(); }} onSources={() => isAuthenticated ? setSourcesOpen(true) : startLogin()} /></div></div></> : <main className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-3xl flex-col px-5 sm:px-7">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl space-y-7 py-8 sm:py-12">
          {turns.map((turn) => <div key={turn.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {turn.kind === "user" && <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-foreground px-4 py-3 text-sm leading-6 text-background">{turn.text}</div>}
            {turn.kind === "note" && <div className="max-w-[88%] rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm leading-6">{turn.text}</div>}
            {turn.kind === "proposal" && <div className="max-w-[92%] border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">Cairn prepared a source proposal</p><p className="mt-1 text-sm text-muted-foreground">{turn.proposal.name} · {turn.proposal.host}</p></div><Sparkles className="h-4 w-4 text-muted-foreground" /></div><p className="mt-5 text-sm leading-6">It found {turn.proposal.estimatedPageCount} pages and selected {Math.min(12, turn.proposal.urls.length)} useful starting pages. The import stays within this site and skips account, legal, and privacy paths.</p><div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => approveProposal(turn.proposal)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40"><Check className="h-3.5 w-3.5" /> Approve and import</button><button onClick={() => setReviewOpen(true)} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">Review source</button></div></div>}
            {turn.kind === "answer" && <article className="max-w-2xl"><p className="text-xs text-muted-foreground">{turn.answer.status === "evidence" ? `From ${turn.answer.collection}` : "Evidence boundary"}</p><h2 className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{turn.question}</h2>{turn.answer.synthesized ? <p className="mt-5 text-[17px] leading-8">{turn.answer.answer}</p> : <div className="mt-5 space-y-4 text-[17px] leading-8">{turn.answer.status === "evidence" ? turn.answer.citations.map((citation, index) => <p key={citation.id}>{citation.excerpt} <a href={citation.url} target="_blank" rel="noreferrer" className="font-mono text-xs underline underline-offset-4">[{index + 1}]</a></p>) : <p>{turn.answer.answer}</p>}</div>}{turn.answer.citations.length > 0 && <CitationList citations={turn.answer.citations} />}{turn.answer.relatedEntries.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{turn.answer.relatedEntries.map((entry) => <button key={`${entry.title}-${entry.headingPath}`} onClick={() => setCommand(entry.title)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{entry.title}</button>)}</div>}</article>}
          </div>)}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border py-4"><CommandBar compact value={command} onChange={setCommand} onSubmit={interpretCommand} busy={busy} mode={composerMode} onModeChange={setComposerMode} onUpload={() => setUploadOpen(true)} onWebSource={() => { setCommand("https://"); setComposerMode("idle"); inputRef.current?.focus(); }} onSources={() => isAuthenticated ? setSourcesOpen(true) : startLogin()} /></div>
    </main>}

    <Dialog open={uploadOpen} onOpenChange={(open) => { if (!uploadStage) setUploadOpen(open); }}><DialogContent className="max-w-md rounded-2xl border-border bg-card p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Private document</DialogTitle><DialogDescription>Keep an uploaded PDF, text, or Markdown file as its own inspectable source collection.</DialogDescription></DialogHeader><div className="p-5">{uploadStage ? <div className="flex min-h-36 flex-col items-center justify-center text-center" role="status" aria-live="polite"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><Loader2 className="h-5 w-5 animate-spin text-foreground" /></div><p className="shimmer-text mt-4 text-sm font-medium">{uploadStage}</p><p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Cairn is keeping the original file private while it prepares cited evidence passages.</p></div> : <><input ref={fileInputRef} type="file" className="sr-only" accept="application/pdf,text/plain,text/markdown,.pdf,.txt,.md,.markdown" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void importPrivateDocument(file); }} /><button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-5 py-9 text-center transition-colors hover:bg-muted"><FileUp className="h-5 w-5" /><span className="mt-3 text-sm font-medium">Choose a private document</span><span className="mt-1 text-xs text-muted-foreground">PDF, plain text, or Markdown · up to 20 MB</span></button></>}</div></DialogContent></Dialog>
    <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}><DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Sources</DialogTitle><DialogDescription>Collections stay out of the way until you need to inspect or maintain them.</DialogDescription></DialogHeader><div className="grid gap-0 sm:grid-cols-[185px_1fr]"><aside className="border-b border-border p-3 sm:border-r sm:border-b-0">{collections.data?.map((collection) => <button key={collection.id} onClick={() => { setActiveCollectionId(collection.id); setProfileOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeCollectionId === collection.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}>{collection.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{collection.pageCount} pages</span></button>)}<button onClick={() => { setSourcesOpen(false); setUploadOpen(true); }} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><FileUp className="h-4 w-4" /> Add document</button><button onClick={() => { setSourcesOpen(false); setTurns([]); setCommand(""); setTimeout(() => inputRef.current?.focus(), 100); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /> Add web source</button></aside><section className="p-5">{detail.data?.collection ? <><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{detail.data.collection.name}</p><a className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-4" href={detail.data.collection.rootUrl} target="_blank" rel="noreferrer">{detail.data.collection.rootUrl}</a></div><div className="flex gap-2"><button onClick={() => setProfileOpen((open) => !open)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">{profileOpen ? "Close profile" : "Profile"}</button><button onClick={refreshActiveSource} disabled={refresh.isPending || continueImport.isPending} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"><RefreshCw className={`h-3 w-3 ${refresh.isPending || continueImport.isPending ? "animate-spin" : ""}`} /> Refresh</button></div></div>{profileOpen && <form onSubmit={saveProfile} className="mt-5 space-y-4 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Expert framing affects voice and emphasis, never what the source can establish.</p><label className="block text-xs">Name<input required value={profileDraft.name} onChange={(event) => setProfileDraft((draft) => ({ ...draft, name: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label><label className="block text-xs">Scope<textarea required value={profileDraft.scope} onChange={(event) => setProfileDraft((draft) => ({ ...draft, scope: event.target.value }))} className="mt-1 min-h-18 w-full border border-border bg-background px-3 py-2 text-sm" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs">Audience<input required value={profileDraft.audience} onChange={(event) => setProfileDraft((draft) => ({ ...draft, audience: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label><label className="block text-xs">Tone<input required value={profileDraft.tone} onChange={(event) => setProfileDraft((draft) => ({ ...draft, tone: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label></div><label className="block text-xs">Answer mode<select value={profileDraft.answerMode} onChange={(event) => setProfileDraft((draft) => ({ ...draft, answerMode: event.target.value as ProfileDraft["answerMode"] }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"><option value="extractive">Extractive</option><option value="source-backed">Source-backed</option><option value="labeled-synthesis">Labeled synthesis</option></select></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profileDraft.aiSynthesisEnabled} onChange={(event) => setProfileDraft((draft) => ({ ...draft, aiSynthesisEnabled: event.target.checked }))} /> Optional synthesis may use credits</label><button disabled={updateProfile.isPending} className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">Save framing</button></form>}<p className="mt-5 text-xs leading-5 text-muted-foreground">{detail.data.collection.scope}</p><div className="mt-6 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Saved pages</p><div className="mt-3 space-y-3">{detail.data.pages.map((page) => <div key={page.id} className="flex items-start gap-2 text-sm"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground" /><div className="min-w-0"><p className="truncate">{page.pageTitle}</p><a className="block truncate text-xs text-muted-foreground" href={page.canonicalUrl} target="_blank" rel="noreferrer">{sourcePath(page.canonicalUrl)}</a></div></div>)}</div></div></> : <p className="text-sm text-muted-foreground">Add a private document or a public web source to begin.</p>}</section></div></DialogContent></Dialog>

    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Source review</DialogTitle><DialogDescription>Cairn does the selection; you retain the final approval.</DialogDescription></DialogHeader><div className="divide-y divide-border">{turns.filter((turn): turn is Extract<ChatTurn, { kind: "proposal" }> => turn.kind === "proposal").flatMap((turn) => turn.proposal.urls).map((source) => <div key={source.url} className="flex items-start gap-3 p-4"><Check className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0"><p className="text-sm">{source.path || "/"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{source.url}</p></div></div>)}</div></DialogContent></Dialog>
  </div>;
}
