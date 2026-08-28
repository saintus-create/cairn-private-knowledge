import { firstUseActions } from "@/lib/projectStart";
import React from "react";

export function FirstUseStrip({ onAsk, onProject, onSource }: { onAsk: () => void; onProject: () => void; onSource: () => void }) {
  return <div className="flex flex-nowrap items-center justify-center gap-x-4 overflow-hidden px-1 py-1 text-[11px] text-muted-foreground sm:gap-x-5 sm:text-xs"><button type="button" onClick={onAsk} className="shrink-0 text-foreground/72 transition-colors hover:text-foreground focus-visible:text-foreground">{firstUseActions[0]}</button><button type="button" onClick={onProject} className="shrink-0 text-foreground/72 transition-colors hover:text-foreground focus-visible:text-foreground">{firstUseActions[1]}</button><button type="button" onClick={onSource} className="shrink-0 text-foreground/72 transition-colors hover:text-foreground focus-visible:text-foreground">{firstUseActions[2]}</button></div>;
}
