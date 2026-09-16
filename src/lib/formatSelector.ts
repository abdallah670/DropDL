/**
 * Translates yt-dlp format selectors into plain-English sentences so end users
 * never have to read raw selector syntax like `bv*[height<=480]+ba/b`.
 */

export interface FormatExplanation {
  /** Short summary shown in queue/history tiles, e.g. "480p + Best Audio" */
  summary: string;
  /** Full plain-English explanation of what will be downloaded */
  explanation: string;
}

function describeVideoPart(part: string): string | null {
  const m = part.match(/^bv\*(?:\[height<=(\d+)\])?$/);
  if (m) {
    return m[1] ? `best video at ${m[1]}p or lower` : "best available video";
  }
  return null;
}

function describeAudioPart(part: string): string | null {
  if (part === "ba" || part === "bestaudio") return "best available audio";
  return null;
}

/**
 * Explains any format selector the app generates (simple-mode selectors and
 * manual `format_id+format_id` selections).
 */
export function explainFormat(selector: string): FormatExplanation {
  const s = selector.trim();

  // Simple-mode selectors: bv*+ba/b | bv*[height<=H]+ba/b | bv* | bv*[height<=H] | ba/b
  if (s.includes("+")) {
    const [videoPart, ...rest] = s.split("+");
    const audioPart = rest.join("+").replace(/\/.*$/, ""); // strip fallback
    const fallback = s.includes("/");
    const v = describeVideoPart(videoPart) ?? `stream "${videoPart}"`;
    const a = describeAudioPart(audioPart) ?? `stream "${audioPart}"`;
    return {
      summary: videoPart.includes("height<=")
        ? `${videoPart.match(/\d+/)?.[0] ?? ""}p + Best Audio`
        : "Best Video + Audio",
      explanation:
        `Downloads the ${v} and merges it with the ${a} into a single file.` +
        (fallback ? " If merging isn't possible, the best single combined file is downloaded instead." : ""),
    };
  }

  if (s.startsWith("ba/") || s === "ba" || s === "bestaudio") {
    return {
      summary: "Best Audio",
      explanation: "Downloads the best available audio-only stream.",
    };
  }

  if (s.startsWith("bv")) {
    const v = describeVideoPart(s.replace(/\/.*$/, "")) ?? "best available video";
    const noAudio = !s.includes("/");
    return {
      summary: noAudio ? "Best Video (No Audio)" : "Best Video",
      explanation:
        `Downloads the ${v} without audio.` +
        (noAudio ? "" : " Falls back to the best single combined file if unavailable."),
    };
  }

  // Manual selection: "137+140" or single format ids
  if (/^\d+(\+\d+)?$/.test(s)) {
    if (s.includes("+")) {
      const [v, a] = s.split("+");
      return {
        summary: "Manual Format Selection",
        explanation: `Downloads video stream #${v} and merges it with audio stream #${a}.`,
      };
    }
    return {
      summary: "Manual Format Selection",
      explanation: `Downloads exactly stream #${s} as-is (no merging).`,
    };
  }

  return {
    summary: "Best Available",
    explanation: "Downloads the best quality available for this media.",
  };
}
