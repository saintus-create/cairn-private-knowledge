import { firstUseActions } from "@/lib/projectStart";
import React from "react";

export function FirstUseStrip({ onAsk, onProject, onSource }: { onAsk: () => void; onProject: () => void; onSource: () => void }) {
  const pillClass = "shrink-0 rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm text-foreground/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-black/25 hover:bg-black/[0.02] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20";
  return <div className="flex max-w-md flex-wrap items-center justify-center gap-2 px-1 py-1.5 sm:gap-2.5"><button type="button" onClick={onAsk} className={pillClass}>{firstUseActions[0]}</button><button type="button" onClick={onProject} className={pillClass}>{firstUseActions[1]}</button><button type="button" onClick={onSource} className={pillClass}>{firstUseActions[2]}</button></div>;
}
