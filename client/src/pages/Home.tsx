import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/elevenlabs/conversation";
import { FirstUseStrip } from "@/components/FirstUseStrip";
import { ResearchStarterCard } from "@/components/ResearchStarterCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collectionNameFromUrl, commandIntent, firstPublicUrl } from "@/lib/codexCommand";
import { getComposerSuggestions } from "@/lib/composerSuggestions";
import { documentPreviewLabel } from "@/lib/documentPreview";
import { emptyProjectNextStep, suggestedProjectName } from "@/lib/projectStart";
import { sourceArchiveStatus, type SourceArchiveStatusInput } from "@/lib/sourceArchiveStatus";
import { trpc } from "@/lib/trpc";
import { ArrowUp, BookOpen, Check, ChevronRight, FileUp, Globe2, LibraryBig, Loader2, LogOut, Paperclip, Plus, RefreshCw, Sparkles, X } from "lucide-react";
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
  | { id: string; kind: "starter"; topic: string; projectName?: string }
  | { id: string; kind: "answer"; question: string; answer: Answer }
  | { id: string; kind: "proposal"; proposal: Proposal };

const id = () => crypto.randomUUID();
const sourcePath = (value: string) => new URL(value, "https://cairn.local").pathname || "/";

type ComposerMode = "idle" | "document" | "web";

function CommandBar({ value, onChange, onSubmit, busy, compact = false, expanded: _expanded = false, inputRef, onFocus, onBlur, onUpload, onWebSource, onSources, onProjects, projectLabel, mode = "idle", onModeChange }: { value: string; onChange: (value: string) => void; onSubmit: () => void; busy: boolean; compact?: boolean; expanded?: boolean; inputRef?: React.RefObject<HTMLInputElement | null>; onFocus?: () => void; onBlur?: () => void; onUpload?: () => void; onWebSource?: () => void; onSources?: () => void; onProjects?: () => void; projectLabel?: string; mode?: ComposerMode; onModeChange?: (mode: ComposerMode) => void }) {
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const selectMode = (next: Exclude<ComposerMode, "idle">) => onModeChange?.(mode === next ? "idle" : next);
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className={`flex w-full flex-col overflow-hidden rounded-[26px] bg-[var(--composer-surface)] text-[var(--composer-foreground)] shadow-[0_22px_60px_oklch(0.05_0.02_255_/_0.42)] transition-shadow duration-200 ease-out focus-within:shadow-[0_22px_64px_oklch(0.05_0.02_255_/_0.56)] ${compact ? "" : ""}`}>
    <div className={`flex w-full items-center gap-3 ${compact ? "px-4 py-2.5" : "px-5 py-3.5"}`}>
      <BookOpen className={`shrink-0 text-[var(--composer-muted)] ${compact ? "h-4 w-4" : "h-5 w-5"}`} aria-hidden />
      <input ref={inputRef} value={value} onFocus={onFocus} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} placeholder="Ask Cairn · https://…" className={`min-w-0 flex-1 bg-transparent text-[var(--composer-foreground)] outline-none placeholder:text-[var(--composer-muted)] ${compact ? "text-sm" : "text-base"}`} />
      <button type="submit" disabled={!value.trim() || busy} className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-signal)] text-[var(--accent-signal-foreground)] transition-transform active:scale-95 disabled:opacity-35 ${compact ? "h-7 w-7" : "h-9 w-9"}`} aria-label="Send command">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
    </div>
    <div className={`flex items-center gap-1 ${compact ? "px-3 pb-2" : "px-4 pb-3"}`} aria-label="Choose a source action">
      {onUpload && <button type="button" title="Add a private document" onClick={() => selectMode("document")} className={`flex items-center justify-center rounded-full transition-colors ${mode === "document" ? "bg-[var(--accent-signal)] text-[var(--accent-signal-foreground)]" : "text-[var(--composer-muted)] hover:bg-white/10 hover:text-[var(--composer-foreground)]"} ${compact ? "h-7 w-7" : "h-8 gap-1.5 px-2.5 text-xs"}`} aria-label="Add a private document"><Paperclip className={iconSize} />{!compact && <span>Document</span>}</button>}
      {onWebSource && <button type="button" title="Add a web source" onClick={() => selectMode("web")} className={`flex items-center justify-center rounded-full transition-colors ${mode === "web" ? "bg-[var(--accent-signal)] text-[var(--accent-signal-foreground)]" : "text-[var(--composer-muted)] hover:bg-white/10 hover:text-[var(--composer-foreground)]"} ${compact ? "h-7 w-7" : "h-8 gap-1.5 px-2.5 text-xs"}`} aria-label="Add a web source"><Globe2 className={iconSize} />{!compact && <span>Website</span>}</button>}
      {onSources && <button type="button" title="Open sources" onClick={onSources} className={`flex items-center justify-center rounded-full text-[var(--composer-muted)] transition-colors hover:bg-white/10 hover:text-[var(--composer-foreground)] ${compact ? "h-7 w-7" : "h-8 gap-1.5 px-2.5 text-xs"}`} aria-label="Open sources"><LibraryBig className={iconSize} />{!compact && <span>Sources</span>}</button>}
      {onProjects && <button type="button" title="Open projects" onClick={onProjects} className={`flex min-w-0 items-center justify-center rounded-full text-[var(--composer-muted)] transition-colors hover:bg-white/10 hover:text-[var(--composer-foreground)] ${compact ? "h-7 w-7" : "h-8 max-w-36 gap-1.5 px-2.5 text-xs"}`} aria-label="Open projects"><BookOpen className={`${iconSize} shrink-0`} />{!compact && <span className="truncate">{projectLabel ?? "Projects"}</span>}</button>}
    </div>
    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${mode === "idle" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}><div className="overflow-hidden"><div className={`mx-3 mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.06] ${compact ? "px-3 py-2" : "px-4 py-3"}`}>{mode === "document" ? <><FileUp className={iconSize} /><span className="min-w-0 flex-1 text-sm text-[var(--composer-muted)]">Private PDF, text, or Markdown</span><button type="button" onClick={onUpload} className="rounded-full bg-[var(--accent-signal)] px-3 py-1.5 text-xs font-medium text-[var(--accent-signal-foreground)]">Choose file</button></> : <><Globe2 className={iconSize} /><span className="min-w-0 flex-1 text-sm text-[var(--composer-muted)]">Prepare a bounded web source</span><button type="button" onClick={onWebSource} className="rounded-full bg-[var(--accent-signal)] px-3 py-1.5 text-xs font-medium text-[var(--accent-signal-foreground)]">Use URL</button></>}<button type="button" onClick={() => onModeChange?.("idle")} className="rounded-full p-1 text-[var(--composer-muted)] hover:bg-white/10 hover:text-[var(--composer-foreground)]" aria-label="Close source action"><X className={iconSize} /></button></div></div></div>
  </form>;
}

function CitationList({ citations }: { citations: Answer["citations"] }) {
  return <section className="mt-10"><p className="text-xs text-muted-foreground">Primary sources</p><div className="mt-3">{citations.map((citation, index) => <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer" className="group flex gap-3 border-l border-white/15 py-4 pl-4 transition-colors hover:border-[var(--accent-signal)]"><span className="pt-0.5 font-mono text-xs text-muted-foreground">[{index + 1}]</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{citation.title}</span><span className="mt-1 block text-xs text-muted-foreground">{citation.headingPath}</span><span className="mt-2 block text-sm leading-6 text-muted-foreground">{citation.excerpt}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></a>)}</div></section>;
}

function RelatedIndex({ entries, onChoose }: { entries: Answer["relatedEntries"]; onChoose: (entry: string) => void }) {
  if (!entries.length) return null;
  return <section className="mt-10"><p className="text-xs text-muted-foreground">Explore this collection</p><div className="mt-3">{entries.map((entry) => <button key={`${entry.title}-${entry.headingPath}`} onClick={() => onChoose(entry.title)} className="group flex w-full items-start gap-4 border-l border-white/15 py-4 pl-4 text-left transition-colors hover:border-[var(--accent-signal)]"><span className="min-w-0 flex-1"><span className="block text-base text-foreground">{entry.title}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{entry.headingPath}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></button>)}</div></section>;
}

function PrimaryLawArchiveStatus({ archive }: { archive: SourceArchiveStatusInput | null | undefined }) {
  const status = sourceArchiveStatus(archive);
  return <aside className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl border border-[var(--accent-signal)]/35 bg-[var(--composer-surface)]/95 px-4 py-3 text-[var(--composer-foreground)] shadow-xl backdrop-blur-sm sm:left-auto sm:right-6 sm:bottom-6" aria-label="Official source status">
    <p className="text-xs font-medium text-[var(--accent-signal)]">{status.label}</p>
    {archive ? <><a href={archive.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm font-medium underline decoration-white/20 underline-offset-4 hover:text-white">{archive.fileName}</a><p className="mt-1 text-xs leading-5 text-[var(--composer-muted)]">{status.detail} · acquired {status.acquiredDate} · SHA-256 {status.shortSha256}</p></> : <p className="mt-1 text-xs leading-5 text-[var(--composer-muted)]">{status.detail}</p>}
  </aside>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout, requestMagicLink, usesSupabase } = useAuth();
  const [command, setCommand] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadOpen, setUploadOpenState] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<"Preparing file" | "Reading pages" | "Indexing evidence" | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("idle");
  const [profileOpen, setProfileOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInSending, setSignInSending] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ name: "", scope: "", audience: "", tone: "", answerMode: "extractive", aiSynthesisEnabled: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeInput = useMemo(() => ({ collectionId: activeCollectionId ?? 0 }), [activeCollectionId]);
  const projectInput = useMemo(() => activeProjectId ? { projectId: activeProjectId } : undefined, [activeProjectId]);
  const projects = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const collections = trpc.collections.list.useQuery(projectInput, { enabled: isAuthenticated });
  const detail = trpc.collections.get.useQuery(activeInput, { enabled: isAuthenticated && activeCollectionId !== null });
  const preview = trpc.collections.preview.useMutation();
  const create = trpc.collections.create.useMutation();
  const startImport = trpc.collections.startImport.useMutation();
  const continueImport = trpc.collections.continueImport.useMutation();
  const answer = trpc.projects.answer.useMutation();
  const createProject = trpc.projects.create.useMutation();
  const bootstrapCaliforniaFamilyCode = trpc.projects.bootstrapCaliforniaFamilyCode.useMutation();
  const bootstrapCongressGov = trpc.projects.bootstrapCongressGov.useMutation();
  const refresh = trpc.collections.refresh.useMutation();
  const updateProfile = trpc.collections.updateProfile.useMutation();
  const uploadDocument = trpc.collections.uploadDocument.useMutation();
  const utils = trpc.useUtils();
  const busy = preview.isPending || create.isPending || createProject.isPending || bootstrapCaliforniaFamilyCode.isPending || bootstrapCongressGov.isPending || startImport.isPending || continueImport.isPending || refresh.isPending || updateProfile.isPending || answer.isPending || uploadDocument.isPending;
  const awake = turns.length > 0;
  const activeProject = useMemo(() => projects.data?.find((project) => project.id === activeProjectId) ?? projects.data?.[0], [activeProjectId, projects.data]);
  const projectNeedsEvidence = Boolean(isAuthenticated && collections.isFetched && !collections.data?.length);
  const composerExpanded = !awake && command.trim().length > 0;
  const composerSuggestions = useMemo(() => getComposerSuggestions({ query: command, expanded: composerExpanded, collection: detail.data?.collection, pages: detail.data?.pages ?? [] }), [command, composerExpanded, detail.data?.collection, detail.data?.pages]);

  useEffect(() => {
    if (!activeProjectId && projects.data?.[0]) setActiveProjectId(projects.data[0].id);
  }, [activeProjectId, projects.data]);

  useEffect(() => {
    setActiveCollectionId(null);
  }, [activeProjectId]);

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

  function beginSignIn() {
    if (usesSupabase) {
      setSignInOpen(true);
      return;
    }
    startLogin();
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    const email = signInEmail.trim();
    if (!email) return;
    setSignInSending(true);
    try {
      await requestMagicLink(email);
      toast.success("Check your email for Cairn’s private sign-in link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cairn could not send the sign-in link.");
    } finally {
      setSignInSending(false);
    }
  }

  function fileAsBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Cairn could not read that file."));
      reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
      reader.readAsDataURL(file);
    });
  }

  function choosePrivateDocument() {
    if (!isAuthenticated) { beginSignIn(); return; }
    document.getElementById("private-document-input")?.click();
  }

  function previewPrivateDocument(file: File) {
    if (file.size > 20 * 1024 * 1024) { toast.error("Choose a document smaller than 20 MB."); return; }
    setUploadFile(file);
    setUploadOpenState(true);
    setComposerMode("idle");
  }

  function setUploadOpen(open: boolean) {
    if (open && !uploadFile) { choosePrivateDocument(); return; }
    setUploadOpenState(open);
  }

  async function createNewProject(event: FormEvent) {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    try {
      const result = await createProject.mutateAsync({ name, description: newProjectDescription.trim() });
      await utils.projects.list.invalidate();
      setActiveProjectId(result.projectId);
      setActiveCollectionId(null);
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectOpen(false);
      setProjectsOpen(false);
      append({ id: id(), kind: "note", text: `${name} is ready. Add a document or website when you want Cairn to begin building this project’s evidence.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cairn could not create that project.");
    }
  }

  async function startCaliforniaFamilyCodeExpert() {
    try {
      const setup = await bootstrapCaliforniaFamilyCode.mutateAsync();
      await utils.projects.list.invalidate();
      setActiveProjectId(setup.projectId);
      setActiveCollectionId(setup.collectionId);
      setProjectsOpen(false);
      if (setup.alreadyExists || !setup.collectionId) {
        append({ id: id(), kind: "note", text: setup.archive ? `California Family Code expert is active from the official ${setup.archive.fileName} snapshot acquired ${new Date(setup.archive.acquiredAt).toLocaleDateString()}. ${setup.archive.recordCount.toLocaleString()} active official records are available; answers remain limited to this saved corpus.` : "California Family Code expert is prepared, but it has no active official archive yet. Cairn will not make statutory claims until a verified official snapshot is imported." });
        return;
      }
      await utils.collections.list.invalidate({ projectId: setup.projectId });
      await utils.collections.get.invalidate({ collectionId: setup.collectionId });
      append({ id: id(), kind: "note", text: `California Family Code expert is prepared with ${setup.sourceCount} official route references from your Family Code source map. Cairn will not crawl the public portal because its robots policy disallows it. The next import will use an approved official database extraction, preserve its archive version, and answer only after the resulting statutory text is saved.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cairn could not prepare the California Family Code expert.";
      toast.error(message);
      append({ id: id(), kind: "note", text: message });
    }
  }

  async function startCongressGovExpert() {
    try {
      const setup = await bootstrapCongressGov.mutateAsync();
      await utils.projects.list.invalidate();
      await utils.collections.list.invalidate({ projectId: setup.projectId });
      setActiveProjectId(setup.projectId);
      setActiveCollectionId(null);
      setProjectsOpen(false);
      append({ id: id(), kind: "note", text: setup.alreadyExists ? `Congress.gov federal law expert is already prepared with ${setup.sourceCount} separate official source boundaries. It will not answer until an approved source is saved.` : "Congress.gov federal law expert is prepared with separate bill-text, public-law, and U.S. Code boundaries. No federal text is evidence yet; Cairn will not combine or answer from these sources until a specific official snapshot is approved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cairn could not prepare the Congress.gov expert.";
      toast.error(message);
      append({ id: id(), kind: "note", text: message });
    }
  }

  function chooseProject(projectId: number) {
    setActiveProjectId(projectId);
    setActiveCollectionId(null);
    setProfileOpen(false);
    setProjectsOpen(false);
  }

  async function importPrivateDocument(file: File) {
    if (!isAuthenticated) { beginSignIn(); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Choose a document smaller than 20 MB."); return; }
    setUploadStage("Preparing file");
    try {
      const base64 = await fileAsBase64(file);
      setUploadStage("Reading pages");
      const result = await uploadDocument.mutateAsync({ projectId: activeProjectId ?? undefined, fileName: file.name, mimeType: file.type || "application/octet-stream", base64 });
      setUploadStage("Indexing evidence");
      await utils.collections.list.invalidate(projectInput);
      await utils.collections.get.invalidate({ collectionId: result.collectionId });
      setActiveCollectionId(result.collectionId);
      setUploadOpen(false);
      setUploadFile(null);
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
    if (!isAuthenticated) { beginSignIn(); return; }
    setComposerMode("idle");
    setCommand("");
    append({ id: id(), kind: "user", text });
    const intent = commandIntent(text);
    const website = firstPublicUrl(text);
    if (intent === "project") {
      setProjectsOpen(true);
      append({ id: id(), kind: "note", text: "Cairn opened Projects. Choose one to focus your sources, or create a new project for a separate topic." });
      return;
    }
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
    if (projectNeedsEvidence) {
      append({ id: id(), kind: "starter", topic: text, projectName: emptyProjectNextStep(activeProject?.name) === "create-project" ? undefined : activeProject?.name });
      return;
    }
    const targetProject = activeProjectId ?? projects.data?.[0]?.id;
    if (!targetProject) {
      append({ id: id(), kind: "note", text: "Cairn needs a project first. Start one, then add a private document or public web source when you are ready." });
      return;
    }
    try {
      const result = await answer.mutateAsync({ projectId: targetProject, question: text });
      append({ id: id(), kind: "answer", question: text, answer: result });
    } catch (error) {
      append({ id: id(), kind: "note", text: error instanceof Error ? error.message : "Cairn could not complete that lookup." });
    }
  }

  async function approveProposal(proposal: Proposal) {
    try {
      const created = await create.mutateAsync({ projectId: activeProjectId ?? undefined, name: proposal.name, rootUrl: proposal.rootUrl, scope: `A bounded reference collection from ${proposal.host}.`, audience: "A careful general reader", tone: "Clear, direct, and evidence-led", answerMode: "extractive", includePaths: "/", excludePaths: "/login, /account, /privacy, /terms", pageLimit: Math.min(12, proposal.urls.length || 1) });
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

  return <div className={`cairn-viewport ${awake ? "min-h-dvh" : "h-[100svh] overflow-hidden"} text-foreground`}>
    <input id="private-document-input" ref={fileInputRef} type="file" className="sr-only" accept="application/pdf,text/plain,text/markdown,.pdf,.txt,.md,.markdown" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) previewPrivateDocument(file); }} />
    {awake && <header className="flex h-14 items-center justify-between border-b border-border px-5 sm:px-7">
      <button className="font-serif text-xl tracking-tight" onClick={() => { setTurns([]); setCommand(""); inputRef.current?.focus(); }}>Cairn</button>
      <nav className="flex items-center gap-1.5" aria-label="Cairn actions">
        {isAuthenticated && <><button title="Switch project" aria-label="Switch project" onClick={() => setProjectsOpen(true)} className="inline-flex h-8 max-w-40 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><BookOpen className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{activeProject?.name ?? "Projects"}</span></button><button title="Upload document" aria-label="Upload document" onClick={choosePrivateDocument} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><FileUp className="h-3.5 w-3.5" /></button><button title="Sources" aria-label="Sources" onClick={() => setSourcesOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><LibraryBig className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sources{collections.data?.length ? ` · ${collections.data.length}` : ""}</span></button></>}
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : isAuthenticated ? <button title="Sign out" aria-label="Sign out" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={logout}><LogOut className="h-3.5 w-3.5" /></button> : <button className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" onClick={beginSignIn}>Sign in</button>}
      </nav>
    </header>}

    {!awake ? <><main className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-6 text-center"><h1 className="enter-up font-serif text-5xl tracking-tight sm:text-6xl">Cairn</h1></main><div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:px-7 sm:pb-0"><div className="mx-auto w-full max-w-2xl"><div className="mb-3 flex justify-center"><FirstUseStrip onAsk={() => inputRef.current?.focus()} onProject={() => isAuthenticated ? setProjectsOpen(true) : beginSignIn()} onSource={() => isAuthenticated ? choosePrivateDocument() : beginSignIn()} /></div><div className={`mb-2 space-y-1.5 transition-[max-height,opacity,transform] duration-200 ease-out ${composerSuggestions.length ? "max-h-56 translate-y-0 opacity-100" : "max-h-0 translate-y-2 overflow-hidden opacity-0"}`}>{composerSuggestions.map((suggestion) => <button key={`${suggestion.label}-${suggestion.detail}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCommand(suggestion.command); inputRef.current?.focus(); }} className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-background/95 px-3 py-2 text-left shadow-sm backdrop-blur-sm hover:bg-muted"><span className="min-w-0"><span className="block truncate text-sm font-medium">{suggestion.label}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{suggestion.detail}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div><CommandBar inputRef={inputRef} expanded={composerExpanded} value={command} onChange={setCommand} onSubmit={interpretCommand} busy={busy} mode={composerMode} onModeChange={setComposerMode} onUpload={choosePrivateDocument} onWebSource={() => { setCommand("https://"); setComposerMode("idle"); inputRef.current?.focus(); }} onSources={() => isAuthenticated ? setSourcesOpen(true) : beginSignIn()} onProjects={() => isAuthenticated ? setProjectsOpen(true) : beginSignIn()} projectLabel={activeProject?.name} /></div></div></> : <main className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-3xl flex-col px-5 sm:px-7">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl space-y-7 py-8 sm:py-12">
          {turns.map((turn) => <div key={turn.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {turn.kind === "user" && <div className="max-w-2xl border-l border-white/15 py-1 pl-4"><p className="text-xs text-muted-foreground">Question</p><p className="mt-1 text-base leading-7 text-foreground">{turn.text}</p></div>}
            {turn.kind === "note" && <div className="max-w-xl border-l border-white/15 py-1 pl-4 text-sm leading-6 text-muted-foreground">{turn.text}</div>}
            {turn.kind === "starter" && <ResearchStarterCard topic={turn.topic} projectName={turn.projectName} onStartProject={() => { setNewProjectName(suggestedProjectName(turn.topic)); setNewProjectDescription(""); setProjectsOpen(true); setNewProjectOpen(true); }} onWebsite={() => { setCommand("https://"); setComposerMode("web"); }} onDocument={choosePrivateDocument} />}
            {turn.kind === "proposal" && <section className="max-w-2xl border-y border-white/10 py-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Source proposal</p><h2 className="mt-2 font-serif text-2xl tracking-tight">{turn.proposal.name}</h2><p className="mt-1 text-sm text-muted-foreground">{turn.proposal.host}</p></div><Sparkles className="mt-1 h-4 w-4 text-muted-foreground" /></div><p className="mt-5 max-w-xl text-[17px] leading-8">Cairn found {turn.proposal.estimatedPageCount} pages and prepared {Math.min(12, turn.proposal.urls.length)} bounded starting pages. The import stays within this site and preserves snapshots for later inspection.</p><div className="mt-6 flex flex-wrap gap-2"><button disabled={busy} onClick={() => approveProposal(turn.proposal)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-signal)] px-4 py-2 text-sm text-[var(--accent-signal-foreground)] disabled:opacity-40"><Check className="h-3.5 w-3.5" /> Approve import</button><button onClick={() => setReviewOpen(true)} className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Review pages</button></div></section>}
            {turn.kind === "answer" && <article className="max-w-2xl"><p className="text-xs text-muted-foreground">{turn.answer.status === "evidence" ? `Evidence from ${turn.answer.collection}` : "Evidence boundary"}</p><h2 className="mt-2 max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{turn.question}</h2>{turn.answer.synthesized ? <div className="mt-6 max-w-xl"><p className="mb-3 text-xs text-muted-foreground">Source-backed answer</p><p className="text-[18px] leading-9 text-foreground">{turn.answer.answer}</p></div> : <div className="mt-6 max-w-xl"><p className="mb-3 text-xs text-muted-foreground">Supporting passages</p><div className="space-y-5 text-[18px] leading-9 text-foreground">{turn.answer.status === "evidence" ? turn.answer.citations.map((citation, index) => <p key={citation.id}>{citation.excerpt} <a href={citation.url} target="_blank" rel="noreferrer" className="ml-1 font-mono text-xs text-muted-foreground underline decoration-white/30 underline-offset-4 hover:text-foreground">[{index + 1}]</a></p>) : <p>{turn.answer.answer}</p>}</div></div>}{turn.answer.citations.length > 0 && <CitationList citations={turn.answer.citations} />}{turn.answer.relatedEntries.length > 0 && <RelatedIndex entries={turn.answer.relatedEntries} onChoose={setCommand} />}</article>}
          </div>)}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border py-4"><CommandBar compact value={command} onChange={setCommand} onSubmit={interpretCommand} busy={busy} mode={composerMode} onModeChange={setComposerMode} onUpload={choosePrivateDocument} onWebSource={() => { setCommand("https://"); setComposerMode("idle"); inputRef.current?.focus(); }} onSources={() => isAuthenticated ? setSourcesOpen(true) : beginSignIn()} onProjects={() => isAuthenticated ? setProjectsOpen(true) : beginSignIn()} projectLabel={activeProject?.name} /></div>
    </main>}

    {projectsOpen && <aside className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-[var(--composer-surface)]/95 p-3 text-[var(--composer-foreground)] shadow-xl backdrop-blur-sm sm:left-auto sm:right-6 sm:bottom-6" aria-label="Additional official expert">
      <button type="button" disabled={busy} onClick={() => void startCongressGovExpert()} className="w-full text-left disabled:opacity-50"><span className="flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4 text-[var(--accent-signal)]" /> Prepare Congress.gov federal law expert</span><span className="mt-1 block text-xs leading-5 text-[var(--composer-muted)]">Separate bill text, public laws, and U.S. Code sources. Nothing is imported yet.</span></button>
    </aside>}

    {sourcesOpen && ["official_primary", "official_procedural"].includes(detail.data?.collection.sourceAuthority ?? "") && <PrimaryLawArchiveStatus archive={detail.data?.sourceArchive} />}

    <Dialog open={signInOpen} onOpenChange={setSignInOpen}><DialogContent className="max-w-sm rounded-2xl p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Private Cairn</DialogTitle><DialogDescription>Use your email once. Cairn will remember this device after you open the private sign-in link.</DialogDescription></DialogHeader><form onSubmit={sendMagicLink} className="space-y-4 p-5"><label className="block text-xs text-muted-foreground">Email<input autoFocus required type="email" value={signInEmail} onChange={(event) => setSignInEmail(event.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--accent-signal)]" /></label><button disabled={signInSending} className="w-full rounded-full bg-[var(--accent-signal)] px-4 py-2.5 text-sm font-medium text-[var(--accent-signal-foreground)] disabled:opacity-40">{signInSending ? "Sending…" : "Send private sign-in link"}</button></form></DialogContent></Dialog>

    {uploadOpen && <aside role="dialog" aria-modal="true" aria-label="Private document upload" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--composer-surface)] shadow-[0_-24px_70px_oklch(0.04_0.02_255_/_0.5)] sm:inset-y-0 sm:left-auto sm:w-[390px] sm:border-t-0 sm:border-l"><div className="mx-auto flex max-h-[80svh] w-full max-w-lg flex-col sm:h-full sm:max-h-none"><div className="flex items-start justify-between px-5 pb-4 pt-5"><div><p className="text-xs text-[var(--composer-muted)]">Private source</p><h2 className="mt-1 font-serif text-2xl font-normal text-[var(--composer-foreground)]">Add a document</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--composer-muted)]">Cairn keeps the original file private, then creates cited evidence passages from it.</p></div><button type="button" disabled={Boolean(uploadStage)} onClick={() => { setUploadOpen(false); setUploadFile(null); }} className="rounded-full p-2 text-[var(--composer-muted)] hover:bg-white/10 hover:text-[var(--composer-foreground)] disabled:opacity-35" aria-label="Close upload sidecar"><X className="h-4 w-4" /></button></div><div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{uploadStage ? <div className="flex min-h-52 flex-col items-center justify-center text-center" role="status" aria-live="polite"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><Loader2 className="h-5 w-5 animate-spin text-[var(--composer-foreground)]" /></div><p className="shimmer-text mt-4 text-sm font-medium">{uploadStage}</p><p className="mt-2 max-w-xs text-xs leading-5 text-[var(--composer-muted)]">Cairn is preserving the original file while it prepares inspectable evidence passages.</p></div> : <><input ref={fileInputRef} type="file" className="sr-only" accept="application/pdf,text/plain,text/markdown,.pdf,.txt,.md,.markdown" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) setUploadFile(file); }} />{uploadFile ? <div className="rounded-2xl bg-white/[0.06] p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-signal)] text-[var(--accent-signal-foreground)]"><FileUp className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--composer-foreground)]">{uploadFile.name}</p><p className="mt-1 text-xs text-[var(--composer-muted)]">{documentPreviewLabel({ fileName: uploadFile.name, mimeType: uploadFile.type, bytes: uploadFile.size })}</p></div></div><p className="mt-4 text-xs leading-5 text-[var(--composer-muted)]">Cairn will create a separate private collection and retain this file as the source of record.</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => void importPrivateDocument(uploadFile)} className="rounded-full bg-[var(--accent-signal)] px-4 py-2 text-sm font-medium text-[var(--accent-signal-foreground)]">Import document</button><button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full px-3 py-2 text-sm text-[var(--composer-muted)] hover:bg-white/10 hover:text-[var(--composer-foreground)]">Replace</button></div></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.035] px-5 py-12 text-center transition-colors hover:bg-white/[0.07]"><FileUp className="h-5 w-5 text-[var(--composer-muted)]" /><span className="mt-3 text-sm font-medium text-[var(--composer-foreground)]">Choose a private document</span><span className="mt-1 text-xs text-[var(--composer-muted)]">PDF, plain text, or Markdown · up to 20 MB</span></button>}</>}</div></div></aside>}
    <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}><DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Sources</DialogTitle><DialogDescription>Collections stay out of the way until you need to inspect or maintain them.</DialogDescription></DialogHeader><div className="grid gap-0 sm:grid-cols-[185px_1fr]"><aside className="border-b border-border p-3 sm:border-r sm:border-b-0">{collections.data?.map((collection) => <button key={collection.id} onClick={() => { setActiveCollectionId(collection.id); setProfileOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeCollectionId === collection.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}>{collection.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{collection.pageCount} pages</span></button>)}<button onClick={() => { setSourcesOpen(false); setUploadOpen(true); }} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><FileUp className="h-4 w-4" /> Add document</button><button onClick={() => { setSourcesOpen(false); setTurns([]); setCommand(""); setTimeout(() => inputRef.current?.focus(), 100); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /> Add web source</button></aside><section className="p-5">{detail.data?.collection ? <><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{detail.data.collection.name}</p><a className="mt-1 block truncate text-xs text-muted-foreground underline underline-offset-4" href={detail.data.collection.rootUrl} target="_blank" rel="noreferrer">{detail.data.collection.rootUrl}</a></div><div className="flex gap-2"><button onClick={() => setProfileOpen((open) => !open)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">{profileOpen ? "Close profile" : "Profile"}</button><button onClick={refreshActiveSource} disabled={refresh.isPending || continueImport.isPending} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"><RefreshCw className={`h-3 w-3 ${refresh.isPending || continueImport.isPending ? "animate-spin" : ""}`} /> Refresh</button></div></div>{profileOpen && <form onSubmit={saveProfile} className="mt-5 space-y-4 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Expert framing affects voice and emphasis, never what the source can establish.</p><label className="block text-xs">Name<input required value={profileDraft.name} onChange={(event) => setProfileDraft((draft) => ({ ...draft, name: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label><label className="block text-xs">Scope<textarea required value={profileDraft.scope} onChange={(event) => setProfileDraft((draft) => ({ ...draft, scope: event.target.value }))} className="mt-1 min-h-18 w-full border border-border bg-background px-3 py-2 text-sm" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs">Audience<input required value={profileDraft.audience} onChange={(event) => setProfileDraft((draft) => ({ ...draft, audience: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label><label className="block text-xs">Tone<input required value={profileDraft.tone} onChange={(event) => setProfileDraft((draft) => ({ ...draft, tone: event.target.value }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm" /></label></div><label className="block text-xs">Answer mode<select value={profileDraft.answerMode} onChange={(event) => setProfileDraft((draft) => ({ ...draft, answerMode: event.target.value as ProfileDraft["answerMode"] }))} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"><option value="extractive">Extractive</option><option value="source-backed">Source-backed</option><option value="labeled-synthesis">Labeled synthesis</option></select></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profileDraft.aiSynthesisEnabled} onChange={(event) => setProfileDraft((draft) => ({ ...draft, aiSynthesisEnabled: event.target.checked }))} /> Optional synthesis may use credits</label><button disabled={updateProfile.isPending} className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40">Save framing</button></form>}<p className="mt-5 text-xs leading-5 text-muted-foreground">{detail.data.collection.scope}</p><div className="mt-6 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Saved pages</p><div className="mt-3 space-y-3">{detail.data.pages.map((page) => <div key={page.id} className="flex items-start gap-2 text-sm"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground" /><div className="min-w-0"><p className="truncate">{page.pageTitle}</p><a className="block truncate text-xs text-muted-foreground" href={page.canonicalUrl} target="_blank" rel="noreferrer">{sourcePath(page.canonicalUrl)}</a></div></div>)}</div></div></> : <p className="text-sm text-muted-foreground">Add a private document or a public web source to begin.</p>}</section></div></DialogContent></Dialog>

    <Dialog open={projectsOpen} onOpenChange={(open) => { setProjectsOpen(open); if (!open) setNewProjectOpen(false); }}><DialogContent className="max-h-[82vh] max-w-lg overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Projects</DialogTitle><DialogDescription>Each project is its own evidence boundary. Sources and answers stay inside the project you choose.</DialogDescription></DialogHeader><div className="p-3"><button type="button" disabled={busy} onClick={() => void startCaliforniaFamilyCodeExpert()} className="mb-3 w-full rounded-xl border border-[var(--accent-signal)]/40 bg-[var(--accent-signal)]/10 p-3 text-left transition-colors hover:bg-[var(--accent-signal)]/15 disabled:opacity-50"><span className="flex items-center gap-2 text-sm font-medium text-foreground"><BookOpen className="h-4 w-4 text-[var(--accent-signal)]" /> Prepare California Family Code expert</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Register official statutory sources and their boundaries. Commentary stays out by default.</span></button>{projects.data?.map((project) => <button key={project.id} type="button" onClick={() => chooseProject(project.id)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${activeProject?.id === project.id ? "bg-muted" : "hover:bg-muted/60"}`}><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{project.name}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{project.description || `${project.collectionCount} source${project.collectionCount === 1 ? "" : "s"}`}</span></span>{activeProject?.id === project.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-signal)]" />}</button>)}<button type="button" onClick={() => setNewProjectOpen((open) => !open)} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /> New project</button>{newProjectOpen && <form onSubmit={createNewProject} className="mt-2 space-y-3 rounded-xl bg-muted/60 p-3"><label className="block text-xs text-muted-foreground">Project name<input autoFocus required value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="California law" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--accent-signal)]" /></label><label className="block text-xs text-muted-foreground">A short note <span className="opacity-70">optional</span><input value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} placeholder="Official sources and working material" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--accent-signal)]" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setNewProjectOpen(false)} className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-background">Cancel</button><button disabled={createProject.isPending} className="rounded-full bg-[var(--accent-signal)] px-3 py-1.5 text-xs font-medium text-[var(--accent-signal-foreground)] disabled:opacity-40">{createProject.isPending ? "Creating…" : "Create project"}</button></div></form>}</div></DialogContent></Dialog>
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-none p-0"><DialogHeader className="border-b border-border p-5 text-left"><DialogTitle className="font-serif text-2xl font-normal">Source review</DialogTitle><DialogDescription>Cairn does the selection; you retain the final approval.</DialogDescription></DialogHeader><div className="divide-y divide-border">{turns.filter((turn): turn is Extract<ChatTurn, { kind: "proposal" }> => turn.kind === "proposal").flatMap((turn) => turn.proposal.urls).map((source) => <div key={source.url} className="flex items-start gap-3 p-4"><Check className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0"><p className="text-sm">{source.path || "/"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{source.url}</p></div></div>)}</div></DialogContent></Dialog>
  </div>;
}
