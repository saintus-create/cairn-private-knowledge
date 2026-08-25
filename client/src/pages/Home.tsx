import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { answerModeDisclosure, sourceStatusLabel } from "@/lib/collectionUi";
import { Check, ChevronRight, ExternalLink, FolderPlus, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CollectionForm = {
  name: string;
  rootUrl: string;
  scope: string;
  audience: string;
  tone: string;
  answerMode: "extractive" | "source-backed" | "labeled-synthesis";
  includePaths: string;
  excludePaths: string;
  pageLimit: number;
};

const initialForm: CollectionForm = {
  name: "",
  rootUrl: "",
  scope: "A bounded public reference collection.",
  audience: "A careful general reader",
  tone: "Clear, direct, and evidence-led",
  answerMode: "extractive",
  includePaths: "/",
  excludePaths: "",
  pageLimit: 12,
};

function StatusDot({ status }: { status: string }) {
  const color = status === "ready" || status === "complete" ? "bg-emerald-600" : status === "failed" ? "bg-red-600" : status === "unchanged" ? "bg-slate-400" : "bg-amber-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block border-t editorial-rule pt-3">
    <span className="caps-label block text-foreground">{label}</span>
    {hint && <span className="mt-1 block text-xs leading-4 text-muted-foreground">{hint}</span>}
    <div className="mt-2">{children}</div>
  </label>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [form, setForm] = useState<CollectionForm>(initialForm);
  const [preview, setPreview] = useState<{ seedUrl: string; host: string; discoveredUrls: Array<{ url: string; path: string; selected: boolean }>; estimatedPageCount: number; robotsNotice: string } | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ status: "evidence" | "insufficient-evidence"; collection: string; answerMode: string; answer: string; citations: Array<{ id: number; title: string; url: string; headingPath: string; excerpt: string; score: number }>; relatedEntries: Array<{ title: string; headingPath: string }>; synthesized: boolean } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const activeCollectionInput = useMemo(() => ({ collectionId: activeId ?? 0 }), [activeId]);
  const collectionsQuery = trpc.collections.list.useQuery(undefined, { enabled: isAuthenticated });
  const detailQuery = trpc.collections.get.useQuery(activeCollectionInput, { enabled: isAuthenticated && activeId !== null });
  const previewMutation = trpc.collections.preview.useMutation();
  const createMutation = trpc.collections.create.useMutation();
  const importMutation = trpc.collections.startImport.useMutation();
  const continueMutation = trpc.collections.continueImport.useMutation();
  const refreshMutation = trpc.collections.refresh.useMutation();
  const answerMutation = trpc.collections.answer.useMutation();
  const profileMutation = trpc.collections.updateProfile.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!activeId && collectionsQuery.data?.[0]) setActiveId(collectionsQuery.data[0].id);
  }, [activeId, collectionsQuery.data]);

  useEffect(() => {
    const collection = detailQuery.data?.collection;
    if (!collection) return;
    setForm({
      name: collection.name,
      rootUrl: collection.rootUrl,
      scope: collection.scope,
      audience: collection.audience,
      tone: collection.tone,
      answerMode: collection.answerMode,
      includePaths: collection.includePaths,
      excludePaths: collection.excludePaths,
      pageLimit: collection.pageLimit,
    });
  }, [detailQuery.data?.collection]);

  function updateForm<K extends keyof CollectionForm>(key: K, value: CollectionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function previewScope(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await previewMutation.mutateAsync({ rootUrl: form.rootUrl, includePaths: form.includePaths, excludePaths: form.excludePaths, pageLimit: form.pageLimit });
      setPreview(result);
      setSelectedUrls(result.discoveredUrls.map((item) => item.url));
      toast.success("Scope preview prepared.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to preview this website.");
    }
  }

  async function createAndImport() {
    if (!preview || !selectedUrls.length) return;
    try {
      const created = await createMutation.mutateAsync(form);
      setActiveId(created.collectionId);
      await importMutation.mutateAsync({ collectionId: created.collectionId, urls: selectedUrls });
      await utils.collections.list.invalidate();
      await utils.collections.get.invalidate({ collectionId: created.collectionId });
      setPreview(null);
      setSelectedUrls([]);
      toast.success("Collection created and first import batch completed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The collection could not be created.");
    }
  }

  async function askCollection(event: FormEvent) {
    event.preventDefault();
    if (!activeId) return;
    try {
      const result = await answerMutation.mutateAsync({ collectionId: activeId, question, useOptionalSynthesis: activeCollection?.aiSynthesisEnabled ?? false });
      setAnswer(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The collection could not answer that question.");
    }
  }

  async function saveProfile() {
    if (!activeId) return;
    try {
      const { rootUrl: _rootUrl, ...profile } = form;
      await profileMutation.mutateAsync({ collectionId: activeId, profile: { ...profile, aiSynthesisEnabled: activeCollection?.aiSynthesisEnabled ?? false } });
      await utils.collections.get.invalidate({ collectionId: activeId });
      await utils.collections.list.invalidate();
      setProfileOpen(false);
      toast.success("Expert profile updated. Evidence rules remain unchanged.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The expert profile could not be updated.");
    }
  }

  const activeCollection = detailQuery.data?.collection;
  const pages = detailQuery.data?.pages ?? [];
  const latestBatch = detailQuery.data?.batch;
  const busy = previewMutation.isPending || createMutation.isPending || importMutation.isPending;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b editorial-rule bg-background">
      <div className="mx-auto grid max-w-[1520px] grid-cols-12 px-4 sm:px-6">
        <div className="col-span-12 flex h-16 items-center justify-between border-x editorial-rule px-4 sm:px-5">
          <button className="text-[22px] font-medium tracking-[-0.07em]" onClick={() => { setActiveId(null); setAnswer(null); }}>Codex</button>
          <div className="hidden items-center gap-7 text-xs sm:flex">
            <span className="text-muted-foreground">Private source intelligence</span>
            <span className="font-medium">{collectionsQuery.data?.length ?? 0} collection{collectionsQuery.data?.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isAuthenticated ? <>
              <span className="hidden text-muted-foreground sm:inline">{user?.name || "Private workspace"}</span>
              <button className="quiet-link border-l editorial-rule pl-3" onClick={logout}>Sign out</button>
            </> : <button className="quiet-link border-l editorial-rule pl-3" onClick={() => startLogin()}>Sign in</button>}
          </div>
        </div>
      </div>
    </header>

    <main className="grid grid-cols-12 grid-surface mx-auto min-h-[calc(100vh-65px)] max-w-[1520px] px-4 sm:px-6">
      <aside className="col-span-12 border-x editorial-rule bg-background/92 p-5 lg:col-span-3 lg:min-h-[calc(100vh-65px)]">
        <div className="flex items-center justify-between border-b editorial-rule pb-3">
          <span className="caps-label">Collections</span>
          <button className="quiet-link text-xs" onClick={() => { setActiveId(null); setPreview(null); setAnswer(null); setForm(initialForm); }}>New site</button>
        </div>
        <div className="mt-3 space-y-1">
          {!isAuthenticated && <p className="py-5 text-sm leading-6 text-muted-foreground">Sign in to keep private collections and source snapshots separate from the public web.</p>}
          {isAuthenticated && collectionsQuery.isLoading && <p className="py-5 text-sm text-muted-foreground">Loading your library.</p>}
          {isAuthenticated && !collectionsQuery.isLoading && !collectionsQuery.data?.length && <p className="py-5 text-sm leading-6 text-muted-foreground">Your first collection begins with one public website and a clear evidence boundary.</p>}
          {collectionsQuery.data?.map((collection) => <button key={collection.id} onClick={() => { setActiveId(collection.id); setAnswer(null); setPreview(null); }} className={`group w-full border-b border-border py-3 text-left transition-colors ${activeId === collection.id ? "bg-foreground px-3 text-background" : "hover:bg-muted"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{collection.name}</span>
              <StatusDot status={collection.importStatus === "ready" ? "ready" : collection.importStatus} />
            </div>
            <div className={`mt-1 flex items-center justify-between text-[11px] ${activeId === collection.id ? "text-background/60" : "text-muted-foreground"}`}>
              <span className="truncate">{new URL(collection.rootUrl).hostname}</span><span>{collection.pageCount} pages</span>
            </div>
          </button>)}
        </div>
        <div className="mt-12 border-t editorial-rule pt-3 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mb-2 h-4 w-4 text-foreground" />
          Each query is bounded to its selected collection. When source evidence is absent, Codex says so.
        </div>
      </aside>

      <section className="col-span-12 border-r editorial-rule bg-background/80 lg:col-span-9">
        {!isAuthenticated ? <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-9">
          <div className="flex flex-col justify-between border-b editorial-rule p-6 sm:p-10 lg:col-span-6 lg:border-b-0 lg:border-r">
            <div className="enter-up">
              <p className="caps-label">A private reference system</p>
              <h1 className="mt-8 max-w-3xl text-[clamp(3.1rem,7vw,7.5rem)] font-medium leading-[.83] tracking-[-.08em]">Your sources. <br />No substitution.</h1>
              <p className="mt-9 max-w-xl text-base leading-7 text-muted-foreground">Codex turns an approved public website into a bounded expert collection. It preserves page provenance, retrieves exact passages, and gives you a direct answer only when the collection supports it.</p>
            </div>
            <button onClick={() => startLogin()} className="mt-12 flex w-fit items-center gap-3 bg-foreground px-5 py-4 text-sm font-medium text-background transition-transform active:scale-[.97]">Enter private workspace <ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-3">
            <div><p className="caps-label">Protocol</p><p className="mt-5 text-sm leading-6 text-muted-foreground">Preview the scope. Approve pages. Import clean snapshots. Read every answer against its passages.</p></div>
            <p className="font-serif text-2xl leading-8">“The source is the boundary.”</p>
          </div>
        </div> : activeCollection ? <div className="min-h-[calc(100vh-65px)]">
          <div className="grid grid-cols-1 border-b editorial-rule lg:grid-cols-9">
            <div className="p-6 sm:p-8 lg:col-span-6 lg:border-r editorial-rule">
              <p className="caps-label">{activeCollection.audience}</p>
              <div className="mt-5 flex items-start justify-between gap-5"><div><h1 className="text-4xl font-medium tracking-[-.06em] sm:text-6xl">{activeCollection.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{activeCollection.scope}</p></div><button onClick={() => setProfileOpen(!profileOpen)} className="shrink-0 border editorial-rule px-3 py-2 text-xs quiet-link">Profile</button></div>
            </div>
            <div className="grid grid-cols-2 p-6 text-xs sm:p-8 lg:col-span-3">
              <div><p className="caps-label">Evidence mode</p><p className="mt-3 leading-5">{activeCollection.answerMode.replace(/-/g, " ")}</p></div>
              <div><p className="caps-label">Current source set</p><p className="mt-3 leading-5">{pages.filter((page) => page.sourceStatus === "ready" || page.sourceStatus === "unchanged").length} of {pages.length} pages ready</p></div>
            </div>
          </div>

          {profileOpen && <div className="grid grid-cols-1 border-b editorial-rule bg-muted/55 lg:grid-cols-9">
            <div className="p-6 lg:col-span-6 lg:border-r editorial-rule"><p className="caps-label">Expert profile</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Collection name"><input value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="focus-field w-full border editorial-rule bg-background px-3 py-2 text-sm" /></Field><Field label="Audience"><input value={form.audience} onChange={(event) => updateForm("audience", event.target.value)} className="focus-field w-full border editorial-rule bg-background px-3 py-2 text-sm" /></Field><Field label="Scope"><textarea value={form.scope} onChange={(event) => updateForm("scope", event.target.value)} className="focus-field min-h-24 w-full border editorial-rule bg-background px-3 py-2 text-sm" /></Field><Field label="Tone"><textarea value={form.tone} onChange={(event) => updateForm("tone", event.target.value)} className="focus-field min-h-24 w-full border editorial-rule bg-background px-3 py-2 text-sm" /></Field><Field label="Answer mode" hint="Controls expression, never source scope."><select value={form.answerMode} onChange={(event) => updateForm("answerMode", event.target.value as CollectionForm["answerMode"])} className="focus-field w-full border editorial-rule bg-background px-3 py-2 text-sm"><option value="extractive">Extractive</option><option value="source-backed">Source-backed</option><option value="labeled-synthesis">Labeled synthesis</option></select></Field><Field label="Optional synthesis" hint="Off by default. When enabled, only retrieved public excerpts are sent to a low-cost model."><button type="button" onClick={() => { if (!activeId || !activeCollection) return; profileMutation.mutate({ collectionId: activeId, profile: { aiSynthesisEnabled: !activeCollection.aiSynthesisEnabled } }, { onSuccess: () => { utils.collections.get.invalidate(activeCollectionInput); toast.success(activeCollection.aiSynthesisEnabled ? "Optional synthesis disabled." : "Optional synthesis enabled for this collection."); } }); }} className={`w-full border editorial-rule px-3 py-2 text-left text-sm ${activeCollection?.aiSynthesisEnabled ? "bg-foreground text-background" : "bg-background"}`}>{activeCollection?.aiSynthesisEnabled ? "Enabled — may use credits" : "Disabled — no model calls"}</button></Field></div></div>
            <div className="flex flex-col justify-between p-6 lg:col-span-3"><p className="text-xs leading-5 text-muted-foreground">This profile guides framing and reader fit. It never creates facts, changes passages, or widens the collection boundary.</p><button onClick={saveProfile} disabled={profileMutation.isPending} className="mt-8 bg-foreground px-4 py-3 text-xs font-medium text-background disabled:opacity-50">Save profile</button></div>
          </div>}

          <div className="grid grid-cols-1 lg:grid-cols-9">
            <div className="p-6 sm:p-8 lg:col-span-6 lg:border-r editorial-rule">
              <p className="caps-label">Ask this collection</p>
              <form onSubmit={askCollection} className="mt-5 flex border editorial-rule bg-background">
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`Ask ${activeCollection.name} a question`} className="focus-field min-w-0 flex-1 bg-transparent px-4 py-4 text-base outline-none" />
                <button disabled={answerMutation.isPending || !question.trim()} className="flex w-14 items-center justify-center border-l editorial-rule bg-foreground text-background disabled:opacity-30" aria-label="Search collection">{answerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
              </form>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Searches only page passages imported into this collection. {answerModeDisclosure(activeCollection.aiSynthesisEnabled)}</p>

              {answer && <article className="enter-up mt-12 border-t editorial-rule pt-5">
                <div className="flex items-center justify-between gap-4"><p className="caps-label">{answer.status === "evidence" ? "Source-backed entry" : "Evidence boundary"}</p><span className="text-xs text-muted-foreground">{answer.collection}</span></div>
                <h2 className="mt-5 max-w-3xl font-serif text-3xl leading-[1.12] tracking-[-.03em] sm:text-4xl">{question}</h2>
                {answer.synthesized ? <p className="mt-6 max-w-3xl text-[17px] leading-8">{answer.answer}</p> : <div className="mt-6 max-w-3xl space-y-4 text-[17px] leading-8">{answer.status === "evidence" ? answer.citations.map((citation, index) => <p key={citation.id}>{citation.excerpt} <a href={citation.url} target="_blank" rel="noreferrer" className="font-mono text-xs underline underline-offset-4">[{index + 1}]</a></p>) : <p>{answer.answer}</p>}</div>}
                {answer.citations.length > 0 && <section className="mt-10 border-t editorial-rule pt-4"><p className="caps-label">Source passages</p><div className="mt-4 divide-y editorial-rule">{answer.citations.map((citation, index) => <div key={citation.id} className="grid grid-cols-[28px_1fr] gap-3 py-5"><span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><div><div className="flex flex-wrap items-baseline justify-between gap-3"><p className="text-sm font-medium">{citation.title}</p><a href={citation.url} target="_blank" rel="noreferrer" className="quiet-link flex items-center gap-1 text-xs underline underline-offset-4">Open source <ExternalLink className="h-3 w-3" /></a></div><p className="mt-1 text-xs text-muted-foreground">{citation.headingPath}</p><blockquote className="mt-3 border-l-2 editorial-rule pl-3 text-sm leading-6 text-muted-foreground">{citation.excerpt}</blockquote></div></div>)}</div></section>}
                {answer.relatedEntries.length > 0 && <section className="mt-8 border-t editorial-rule pt-4"><p className="caps-label">Related entries</p><div className="mt-4 flex flex-wrap gap-2">{answer.relatedEntries.map((entry) => <button key={`${entry.title}-${entry.headingPath}`} onClick={() => setQuestion(entry.title)} className="border editorial-rule px-3 py-2 text-left text-xs quiet-link"><span className="block font-medium">{entry.title}</span><span className="mt-1 block text-muted-foreground">{entry.headingPath}</span></button>)}</div></section>}
              </article>}

              {!answer && <div className="mt-14 border-t editorial-rule pt-5"><p className="caps-label">Working principle</p><p className="mt-4 max-w-2xl font-serif text-2xl leading-8">Each answer is bounded by the saved source passages. When the collection is silent, Codex remains silent too.</p></div>}
            </div>
            <aside className="p-6 sm:p-8 lg:col-span-3">
              <div className="flex items-center justify-between border-b editorial-rule pb-3"><span className="caps-label">Sources</span><button onClick={async () => { if (!activeId) return; try { await refreshMutation.mutateAsync({ collectionId: activeId }); await utils.collections.get.invalidate(activeCollectionInput); await utils.collections.list.invalidate(); toast.success("Refresh batch completed."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to refresh this collection."); } }} disabled={refreshMutation.isPending || !pages.length} className="quiet-link flex items-center gap-1 text-xs disabled:opacity-35"><RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} /> Refresh</button></div>
              <div className="divide-y editorial-rule">{detailQuery.isLoading && <p className="py-5 text-sm text-muted-foreground">Reading source library.</p>}{pages.map((page) => <div className="py-4" key={page.id}><div className="flex items-start gap-2"><StatusDot status={page.sourceStatus} /><p className="min-w-0 flex-1 truncate text-xs font-medium">{page.pageTitle}</p></div><a href={page.canonicalUrl} target="_blank" rel="noreferrer" className="quiet-link mt-1 block truncate text-[11px] text-muted-foreground">{new URL(page.canonicalUrl).pathname || "/"}</a><p className="mt-2 text-[11px] text-muted-foreground">{sourceStatusLabel(page.sourceStatus, page.snapshotCount)}</p>{page.importError && <p className="mt-2 text-[11px] leading-4 text-red-700">{page.importError}</p>}</div>)}</div>
              {latestBatch && <div className="mt-6 border-t editorial-rule pt-4"><div className="flex items-center justify-between"><span className="caps-label">Latest import</span><span className="text-xs">{latestBatch.status}</span></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{latestBatch.processedCount} imported · {latestBatch.unchangedCount} unchanged · {latestBatch.failedCount} needs attention</p>{latestBatch.status === "paused" && <button onClick={async () => { try { await continueMutation.mutateAsync({ batchId: latestBatch.id }); await utils.collections.get.invalidate(activeCollectionInput); await utils.collections.list.invalidate(); toast.success("The next import batch has completed."); } catch (error) { toast.error(error instanceof Error ? error.message : "The import could not continue."); } }} disabled={continueMutation.isPending} className="mt-4 w-full border editorial-rule px-3 py-2 text-xs font-medium quiet-link disabled:opacity-45">{continueMutation.isPending ? "Continuing batch" : "Continue import"}</button>}</div>}
              {!pages.length && <p className="py-6 text-sm leading-6 text-muted-foreground">This collection has no imported pages yet. Preview the site again to select and import sources.</p>}
            </aside>
          </div>
        </div> : <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-9">
          <div className="p-6 sm:p-8 lg:col-span-6 lg:border-r editorial-rule">
            <div className="max-w-2xl"><p className="caps-label">New expert collection</p><h1 className="mt-7 text-5xl font-medium leading-[.88] tracking-[-.075em] sm:text-7xl">Build from a public source, not a model’s memory.</h1><p className="mt-7 text-sm leading-6 text-muted-foreground">Define a website’s bounds before importing it. Codex preserves the page, heading, passage, and time of every source it later cites.</p></div>
            <form onSubmit={previewScope} className="mt-10 grid gap-5 sm:grid-cols-2">
              <Field label="Expert collection name"><input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="e.g. City planning reference" className="focus-field w-full border editorial-rule bg-background px-3 py-3 text-sm" /></Field>
              <Field label="Public website URL"><input required type="url" value={form.rootUrl} onChange={(event) => updateForm("rootUrl", event.target.value)} placeholder="https://example.org" className="focus-field w-full border editorial-rule bg-background px-3 py-3 text-sm" /></Field>
              <Field label="Include paths" hint="One prefix per line or comma. Use / for the full site."><input value={form.includePaths} onChange={(event) => updateForm("includePaths", event.target.value)} className="focus-field w-full border editorial-rule bg-background px-3 py-3 text-sm" /></Field>
              <Field label="Exclude paths" hint="Keep sections such as /login or /archive outside the collection."><input value={form.excludePaths} onChange={(event) => updateForm("excludePaths", event.target.value)} placeholder="/login, /archive" className="focus-field w-full border editorial-rule bg-background px-3 py-3 text-sm" /></Field>
              <Field label="Initial page limit" hint="A small first import keeps the collection inspectable."><select value={form.pageLimit} onChange={(event) => updateForm("pageLimit", Number(event.target.value))} className="focus-field w-full border editorial-rule bg-background px-3 py-3 text-sm">{[5, 12, 20, 35, 50].map((count) => <option key={count} value={count}>{count} pages</option>)}</select></Field>
              <Field label="Answer mode" hint="This controls expression, never the evidence boundary."><select value={form.answerMode} onChange={(event) => updateForm("answerMode", event.target.value as CollectionForm["answerMode"])} className="focus-field w-full border editorial-rule bg-background px-3 py-3 text-sm"><option value="extractive">Extractive: exact source passages</option><option value="source-backed">Source-backed: concise synthesis</option><option value="labeled-synthesis">Labeled synthesis: interpretation marked</option></select></Field>
              <Field label="Scope"><textarea required value={form.scope} onChange={(event) => updateForm("scope", event.target.value)} className="focus-field min-h-24 w-full border editorial-rule bg-background px-3 py-3 text-sm" /></Field>
              <Field label="Audience and tone"><textarea required value={`${form.audience}\n${form.tone}`} onChange={(event) => { const [audience = "", ...tone] = event.target.value.split("\n"); updateForm("audience", audience); updateForm("tone", tone.join(" ")); }} className="focus-field min-h-24 w-full border editorial-rule bg-background px-3 py-3 text-sm" /></Field>
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 border-t editorial-rule pt-5"><p className="max-w-sm text-xs leading-5 text-muted-foreground">Codex checks that the URL is public, stays on the same host, limits redirects and page size, and respects robots directives before it previews anything.</p><button disabled={busy} className="flex items-center gap-2 bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-50">{previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Preview scope</button></div>
            </form>
          </div>
          <aside className="p-6 sm:p-8 lg:col-span-3">
            <p className="caps-label">Import protocol</p><ol className="mt-5 space-y-5 border-l editorial-rule pl-4 text-sm leading-6"><li><span className="font-medium">01 / Preview</span><br /><span className="text-muted-foreground">Inspect discovered same-host URLs and apply path rules.</span></li><li><span className="font-medium">02 / Approve</span><br /><span className="text-muted-foreground">Select the pages that make up this specific expert collection.</span></li><li><span className="font-medium">03 / Ground</span><br /><span className="text-muted-foreground">Read every answer against saved passages and opening source links.</span></li></ol>
          </aside>
        </div>}
      </section>
    </main>

    {preview && <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/25 p-4 sm:p-8"><div className="mx-auto max-w-5xl border editorial-rule bg-background shadow-2xl"><div className="flex items-start justify-between border-b editorial-rule p-5 sm:p-7"><div><p className="caps-label">Scope preview</p><h2 className="mt-3 text-3xl font-medium tracking-[-.055em]">{preview.host}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{preview.estimatedPageCount} same-host URLs detected. You are selecting the first {Math.min(selectedUrls.length, form.pageLimit)} pages for this controlled first import.</p></div><button onClick={() => setPreview(null)} className="quiet-link p-1" aria-label="Close preview"><X className="h-5 w-5" /></button></div><div className="grid grid-cols-1 lg:grid-cols-3"><div className="p-5 lg:col-span-2 lg:border-r editorial-rule"><div className="max-h-[52vh] divide-y editorial-rule overflow-y-auto border-y editorial-rule">{preview.discoveredUrls.map((item) => { const checked = selectedUrls.includes(item.url); return <label key={item.url} className="flex cursor-pointer items-start gap-3 px-2 py-3 hover:bg-muted"><input type="checkbox" checked={checked} onChange={() => setSelectedUrls((current) => checked ? current.filter((url) => url !== item.url) : [...current, item.url].slice(0, form.pageLimit))} className="mt-1 h-4 w-4 accent-black" /><div className="min-w-0"><p className="text-sm">{item.path || "/"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.url}</p></div><span className="ml-auto text-xs text-muted-foreground">{checked && <Check className="h-4 w-4" />}</span></label>; })}</div></div><div className="flex flex-col justify-between p-5"><div><p className="caps-label">Import boundary</p><p className="mt-4 text-sm leading-6 text-muted-foreground">{preview.robotsNotice}</p><p className="mt-5 font-serif text-2xl">{selectedUrls.length} approved page{selectedUrls.length === 1 ? "" : "s"}</p></div><button onClick={createAndImport} disabled={busy || !selectedUrls.length} className="mt-8 flex items-center justify-center gap-2 bg-foreground px-4 py-4 text-sm font-medium text-background disabled:opacity-40">{createMutation.isPending || importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />} Create and import</button></div></div></div></div>}
  </div>;
}
