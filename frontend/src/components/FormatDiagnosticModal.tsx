import { useState } from "react";
import { createPortal } from "react-dom";
import type { ParsingDiagnostics, SectionDiagnostic } from "../types";

interface FormatDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: ParsingDiagnostics | null;
  workflowyUrl: string;
}

const SECTION_INFO = {
  dok4: {
    label: "DOK4 - SPOVs",
    description: "Spiky Points of View - bold, contrarian conclusions",
    color: "var(--dok4-primary)",
    bgColor: "rgba(255, 107, 107, 0.1)",
    preferredHeader: "**==DOK4 - SPOV==**",
  },
  dok3: {
    label: "DOK3 - Insights",
    description: "Cross-source patterns and synthesized insights",
    color: "var(--dok3-primary)",
    bgColor: "rgba(255, 230, 109, 0.1)",
    preferredHeader: "**==DOK3 - Insights==**",
  },
  dok2: {
    label: "DOK2 - Knowledge Tree",
    description: "Structured knowledge with sources",
    color: "var(--dok2-primary)",
    bgColor: "rgba(78, 205, 196, 0.1)",
    preferredHeader: "**==DOK2 - Knowledge Tree==**",
  },
};

function StatusIcon({ status }: { status: SectionDiagnostic["status"] }) {
  if (status === "found") {
    return <span className="text-green-400 text-lg">&#10003;</span>;
  }
  if (status === "fallback") {
    return <span className="text-yellow-400 text-lg">&#9888;</span>;
  }
  return <span className="text-red-400 text-lg">&#10007;</span>;
}

function SectionCard({
  sectionKey,
  diagnostic,
}: {
  sectionKey: "dok2" | "dok3" | "dok4";
  diagnostic: SectionDiagnostic;
}) {
  const info = SECTION_INFO[sectionKey];

  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background: info.bgColor,
        borderColor:
          diagnostic.status === "found"
            ? "rgba(74, 222, 128, 0.3)"
            : diagnostic.status === "fallback"
              ? "rgba(250, 204, 21, 0.3)"
              : "rgba(248, 113, 113, 0.3)",
      }}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={diagnostic.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold" style={{ color: info.color }}>
              {info.label}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background:
                  diagnostic.status === "found"
                    ? "rgba(74, 222, 128, 0.2)"
                    : diagnostic.status === "fallback"
                      ? "rgba(250, 204, 21, 0.2)"
                      : "rgba(248, 113, 113, 0.2)",
                color:
                  diagnostic.status === "found"
                    ? "#4ade80"
                    : diagnostic.status === "fallback"
                      ? "#facc15"
                      : "#f87171",
              }}
            >
              {diagnostic.status === "found"
                ? "Found"
                : diagnostic.status === "fallback"
                  ? "Fallback"
                  : "Missing"}
            </span>
          </div>

          <p className="text-xs text-[var(--text-muted)] mb-3">{info.description}</p>

          {/* What was found */}
          {diagnostic.matched_header && (
            <div className="mb-2">
              <span className="text-xs text-[var(--text-muted)]">Found header: </span>
              <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                {diagnostic.matched_header}
              </code>
            </div>
          )}

          {/* Item count */}
          {diagnostic.item_count > 0 && (
            <div className="mb-2">
              <span className="text-xs text-[var(--text-muted)]">Items found: </span>
              <span className="text-xs text-[var(--text-secondary)]">{diagnostic.item_count}</span>
            </div>
          )}

          {/* Issue explanation and fix */}
          {diagnostic.status === "fallback" && (
            <div className="mt-3 p-2 rounded bg-[var(--bg-elevated)] border border-yellow-500/20">
              <p className="text-xs text-yellow-300 mb-2">
                <strong>Issue:</strong> Section found but not at the root level of your document.
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                <strong>Fix:</strong> Move this section to be a direct child of your BrainLift root
                node, not nested inside another section.
              </p>
            </div>
          )}

          {diagnostic.status === "missing" && (
            <div className="mt-3 p-2 rounded bg-[var(--bg-elevated)] border border-red-500/20">
              <p className="text-xs text-red-300 mb-2">
                <strong>Issue:</strong> Could not find this section in your document.
              </p>
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                <strong>Common causes:</strong>
              </p>
              <ul className="text-xs text-[var(--text-muted)] mb-3 ml-3 space-y-1 list-disc">
                <li>Section header is mislabeled (e.g., "DOK2 - Summary" instead of "DOK2 - Knowledge Tree")</li>
                <li>Section is not at the root level of your BrainLift</li>
                <li>Section exists but has no content under it</li>
              </ul>
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                <strong>Fix:</strong> Add a root-level section with one of these headers:
              </p>
              <div className="flex flex-wrap gap-1">
                {diagnostic.expected_headers.map((header) => (
                  <code
                    key={header}
                    className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                  >
                    {header}
                  </code>
                ))}
              </div>
            </div>
          )}

          {diagnostic.status === "found" && diagnostic.item_count === 0 && (
            <div className="mt-3 p-2 rounded bg-[var(--bg-elevated)] border border-yellow-500/20">
              <p className="text-xs text-yellow-300">
                <strong>Warning:</strong> Section found but contains no items. Add some content!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FormatDiagnosticModal({
  isOpen,
  onClose,
  diagnostics,
  workflowyUrl,
}: FormatDiagnosticModalProps) {
  const [showGuide, setShowGuide] = useState(false);

  if (!isOpen) return null;

  // Calculate overall status
  const hasIssues =
    diagnostics &&
    (diagnostics.dok2.status !== "found" ||
      diagnostics.dok3.status !== "found" ||
      diagnostics.dok4.status !== "found");

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative glass-panel max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Format Diagnostic
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {hasIssues
                  ? "Some sections have parsing issues"
                  : "All sections parsed correctly"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {diagnostics ? (
            <div className="space-y-4">
              {/* Section cards in DOK order (4 -> 3 -> 2) */}
              <SectionCard sectionKey="dok4" diagnostic={diagnostics.dok4} />
              <SectionCard sectionKey="dok3" diagnostic={diagnostics.dok3} />
              <SectionCard sectionKey="dok2" diagnostic={diagnostics.dok2} />

              {/* Expandable guide reference */}
              <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span
                    className="transition-transform"
                    style={{ transform: showGuide ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    &#9654;
                  </span>
                  Expected Document Structure
                </button>

                {showGuide && (
                  <div className="mt-4 p-4 rounded-lg bg-[var(--bg-elevated)] text-xs overflow-x-auto">
                    <p className="text-[var(--text-secondary)] mb-3">
                      Each DOK section must be a <strong>direct child</strong> of your BrainLift root node and contain content underneath:
                    </p>
                    <pre className="text-[var(--text-secondary)] font-mono">
{`Your BrainLift Title
├── **==Owner==**
├── **==Purpose==**
├── **==DOK4 - SPOV==**
│   ├── SPOV #1: Bold claim with explanation...
│   └── SPOV #2: Another contrarian insight...
├── **==DOK3 - Insights==**
│   ├── Insight about cross-source patterns...
│   └── Another synthesized insight...
├── **==DOK2 - Knowledge Tree==**
│   └── Category Name
│       └── Source - Author (Year)
│           ├── DOK2 Summary
│           └── DOK1 Facts
└── **==Experts==**`}
                    </pre>
                    <p className="text-[var(--text-muted)] mt-3 text-xs">
                      <strong>Important:</strong> Sections must have content (children) to be detected. Empty sections or mislabeled headers (like "DOK2 - Summary" inside a source) won't be recognized as the main section.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              No diagnostic information available. Try refreshing the BrainLift.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex justify-between items-center">
          <a
            href={workflowyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--dok2-primary)] hover:underline inline-flex items-center gap-1"
          >
            Edit in WorkFlowy <span>&#8594;</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
