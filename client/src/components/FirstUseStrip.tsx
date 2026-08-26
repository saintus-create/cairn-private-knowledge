import { firstUseActions } from "@/lib/projectStart";
import React from "react";

export function FirstUseStrip({ onAsk, onProject, onSource }: { onAsk: () => void; onProject: () => void; onSource: () => void }) {
  return <div className="flex flex-nowrap items-center justify-center gap-x-1.5 overflow-hidden rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm sm:gap-x-2 sm:text-xs"><button type="button" onClick={onAsk} className="shrink-0 text-foreground/85 underline decoration-white/25 underline-offset-4 hover:text-foreground">{firstUseActions[0]}</button><span aria-hidden>·</span><button type="button" onClick={onProject} className="shrink-0 text-foreground/85 underline decoration-white/25 underline-offset-4 hover:text-foreground">{firstUseActions[1]}</button><span aria-hidden>·</span><button type="button" onClick={onSource} className="shrink-0 text-foreground/85 underline decoration-white/25 underline-offset-4 hover:text-foreground">{firstUseActions[2]}</button></div>;
}
