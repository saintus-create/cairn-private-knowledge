export type SourceQuality = { usable: boolean; reason?: string };

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function assessSourceQuality(value: string): SourceQuality {
  const words = normalizedWords(value);
  if (words.length < 12) return { usable: true };

  const phrases = new Map<string, number>();
  for (let index = 0; index <= words.length - 6; index += 1) {
    const phrase = words.slice(index, index + 6).join(" ");
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  if (Math.max(0, ...Array.from(phrases.values())) >= 3) {
    return { usable: false, reason: "repeated phrase boilerplate" };
  }

  const compact = words.join("");
  const fragments = new Map<string, number>();
  for (let index = 0; index <= compact.length - 30; index += 12) {
    const fragment = compact.slice(index, index + 30);
    fragments.set(fragment, (fragments.get(fragment) || 0) + 1);
  }
  if (Math.max(0, ...Array.from(fragments.values())) >= 3) {
    return { usable: false, reason: "repeated text fragments" };
  }

  const meaningful = words.filter((word) => word.length >= 4);
  if (words.length >= 90 && meaningful.length >= 30 && new Set(meaningful).size / meaningful.length < 0.18) {
    return { usable: false, reason: "very low vocabulary diversity" };
  }

  return { usable: true };
}
