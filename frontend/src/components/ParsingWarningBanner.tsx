import { useState } from "react";
import type { SavedBrainLift } from "../types";
import FormatDiagnosticModal from "./FormatDiagnosticModal";

interface ParsingWarningBannerProps {
  brainlift: SavedBrainLift;
}

export default function ParsingWarningBanner({ brainlift }: ParsingWarningBannerProps) {
  const [showModal, setShowModal] = useState(false);

  if (brainlift.parsing_status !== "fallback") return null;

  // Build summary of issues
  const issues: string[] = [];
  if (brainlift.parsing_diagnostics) {
    if (brainlift.parsing_diagnostics.dok4.status === "missing") issues.push("DOK4 missing");
    else if (brainlift.parsing_diagnostics.dok4.status === "fallback") issues.push("DOK4 misplaced");
    if (brainlift.parsing_diagnostics.dok3.status === "missing") issues.push("DOK3 missing");
    else if (brainlift.parsing_diagnostics.dok3.status === "fallback") issues.push("DOK3 misplaced");
    if (brainlift.parsing_diagnostics.dok2.status === "missing") issues.push("DOK2 missing");
    else if (brainlift.parsing_diagnostics.dok2.status === "fallback") issues.push("DOK2 misplaced");
  }

  const issueText = issues.length > 0
    ? issues.join(", ")
    : brainlift.fallback_sections.join(", ").toUpperCase();

  return (
    <>
      <div
        className="glass-panel p-4 border-l-4 slide-up"
        style={{ borderLeftColor: "var(--dok4-primary)" }}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">&#9888;</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--dok4-primary)] mb-1">
              Degraded Parsing Results
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              This BrainLift doesn't follow the expected format ({issueText}).
              Connection analysis may be incomplete or inaccurate.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <button
                onClick={() => setShowModal(true)}
                className="text-[var(--dok3-primary)] hover:underline inline-flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
              >
                View diagnostic details <span>&#8594;</span>
              </button>
              <a
                href={brainlift.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--dok2-primary)] hover:underline inline-flex items-center gap-1"
              >
                Edit in WorkFlowy <span>&#8594;</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <FormatDiagnosticModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        diagnostics={brainlift.parsing_diagnostics}
        workflowyUrl={brainlift.url}
      />
    </>
  );
}
