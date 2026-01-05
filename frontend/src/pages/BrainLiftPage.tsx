import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import DOKFlow from "../DOKFlow";
import MenuButton from "../components/MenuButton";
import Sidebar from "../components/Sidebar";
import { RefreshIcon, BackIcon } from "../Icons";
import { API_URL } from "../types";
import type {
  BrainLiftSummary,
  SavedBrainLift,
  ConnectionAnalysis,
  DOKSection,
} from "../types";

interface BrainLiftPageProps {
  savedList: BrainLiftSummary[];
  onRefresh: () => void;
}

export default function BrainLiftPage({ savedList, onRefresh }: BrainLiftPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get("view") as "list" | "flow") || "flow";

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [brainlift, setBrainlift] = useState<SavedBrainLift | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      loadBrainLift(id);
    }
  }, [id]);

  useEffect(() => {
    if (brainlift && !brainlift.connections && !analyzing && !error) {
      handleAnalyze();
    }
  }, [brainlift?.id]);

  const loadBrainLift = async (brainliftId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/brainlifts/${brainliftId}`);
      if (!res.ok) throw new Error("BrainLift not found");

      const data: SavedBrainLift = await res.json();
      setBrainlift(data);
    } catch (e) {
      setError(`Failed to load: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!id) return;

    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/brainlifts/${id}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      const data: ConnectionAnalysis = await res.json();
      setBrainlift((prev) => prev ? { ...prev, connections: data } : null);
    } catch (e) {
      setError(`Analysis error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRefresh = async () => {
    if (!id) return;

    setRefreshing(true);

    try {
      const res = await fetch(`${API_URL}/brainlifts/${id}/refresh`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Refresh failed");
      }

      const data = await res.json();

      if (data.has_changes) {
        toast.success("Changes detected! Refreshing...");
        await loadBrainLift(id);
        setTimeout(() => handleAnalyze(), 100);
      } else {
        toast("No changes detected", {
          style: { background: "var(--bg-elevated)", color: "var(--dok4-primary)" },
        });
      }
    } catch (e) {
      toast.error(`Refresh failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSidebarRefresh = async (refreshedId: string) => {
    if (refreshedId === id) {
      await loadBrainLift(refreshedId);
      setTimeout(() => handleAnalyze(), 100);
    }
  };

  const setViewMode = (mode: "list" | "flow") => {
    setSearchParams({ view: mode });
  };

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getConnectionsFor = (
    dokType: "dok2" | "dok3" | "dok4",
    index: number
  ): { type: string; targetDok: string; targetIndex: number; score: number; reasoning: string }[] => {
    if (!brainlift?.connections) return [];

    const results: { type: string; targetDok: string; targetIndex: number; score: number; reasoning: string }[] = [];
    const connections = brainlift.connections;

    if (dokType === "dok2") {
      connections.dok2_to_dok3
        .filter((c) => c.source_index === index)
        .forEach((c) => {
          results.push({
            type: c.type,
            targetDok: "DOK3",
            targetIndex: c.target_index,
            score: c.score,
            reasoning: c.reasoning,
          });
        });
    } else if (dokType === "dok3") {
      connections.dok2_to_dok3
        .filter((c) => c.target_index === index)
        .forEach((c) => {
          results.push({
            type: c.type,
            targetDok: "DOK2",
            targetIndex: c.source_index,
            score: c.score,
            reasoning: c.reasoning,
          });
        });
      connections.dok3_to_dok4
        .filter((c) => c.source_index === index)
        .forEach((c) => {
          results.push({
            type: c.type,
            targetDok: "DOK4",
            targetIndex: c.target_index,
            score: c.score,
            reasoning: c.reasoning,
          });
        });
    } else if (dokType === "dok4") {
      connections.dok3_to_dok4
        .filter((c) => c.target_index === index)
        .forEach((c) => {
          results.push({
            type: c.type,
            targetDok: "DOK3",
            targetIndex: c.source_index,
            score: c.score,
            reasoning: c.reasoning,
          });
        });
    }

    return results;
  };

  const renderDOKSection = (
    title: string,
    section: DOKSection | null,
    dokType: "dok2" | "dok3" | "dok4",
    colorVar: string
  ) => {
    if (!section || section.items.length === 0) return null;

    return (
      <div className="mb-8">
        <h2
          className="text-lg font-display font-semibold mb-4 pb-2 border-b"
          style={{ borderColor: `var(--${colorVar}-primary)`, color: `var(--${colorVar}-primary)` }}
        >
          {title}
          <span className="text-[var(--text-muted)] font-normal text-sm ml-2">
            ({section.items.length})
          </span>
        </h2>
        <ul className="space-y-2">
          {section.items.map((item, idx) => {
            const key = `${dokType}-${idx}`;
            const isExpanded = expandedItems.has(key);
            const hasChildren = item.children.length > 0;
            const itemConnections = getConnectionsFor(dokType, item.index);

            return (
              <li key={idx}>
                <div
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    hasChildren ? "hover:bg-[var(--bg-elevated)]" : ""
                  } ${isExpanded ? "bg-[var(--bg-elevated)]" : ""}`}
                  onClick={() => hasChildren && toggleExpand(key)}
                >
                  {hasChildren && (
                    <span
                      className="w-5 text-center shrink-0 select-none transition-colors"
                      style={{ color: isExpanded ? `var(--${colorVar}-primary)` : "var(--text-muted)" }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  )}
                  {!hasChildren && <span className="w-5 shrink-0" />}
                  <div className="flex-1">
                    <span className="leading-relaxed">{item.content}</span>

                    {itemConnections.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {itemConnections.map((conn, connIdx) => (
                          <span
                            key={connIdx}
                            className={`text-xs px-2 py-1 rounded-full ${
                              conn.type === "supports"
                                ? "bg-[var(--dok3-bg)] text-[var(--dok3-primary)]"
                                : "bg-red-500/10 text-red-400"
                            }`}
                            title={`${conn.score}% - ${conn.reasoning}`}
                          >
                            {conn.type === "supports" ? "↔" : "⚡"} {conn.targetDok} #{conn.targetIndex} ({conn.score}%)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {isExpanded && hasChildren && (
                  <div
                    className="ml-8 mt-1 pl-4 border-l-2 space-y-1"
                    style={{ borderColor: `var(--${colorVar}-primary)` }}
                  >
                    {item.children.map((child, childIdx) => (
                      <div
                        key={childIdx}
                        className="py-2 text-sm text-[var(--text-secondary)] leading-relaxed"
                      >
                        {child}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-muted)]">Loading visualization...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!brainlift) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Visualization not found"}</p>
          <button onClick={() => navigate("/")} className="btn-secondary">
            <BackIcon />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const sections = brainlift.sections;
  const connections = brainlift.connections;

  // Flow view - fullscreen
  if (viewMode === "flow") {
    return (
      <div className="flow-fullscreen">
        <MenuButton onClick={() => setSidebarOpen(true)} savedCount={savedList.length} />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          savedList={savedList}
          currentId={id || null}
          onDelete={onRefresh}
          onRefresh={handleSidebarRefresh}
        />

        {/* Top bar */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          <div className="glass-panel px-4 py-2.5 flex items-center h-[45px]">
            <h1 className="font-display font-semibold text-sm truncate max-w-[200px] md:max-w-none">
              {brainlift.name}
            </h1>
          </div>

          <div className="view-toggle">
            <button
              onClick={() => setViewMode("list")}
              className="view-toggle-btn"
            >
              List
            </button>
            <button
              onClick={() => setViewMode("flow")}
              className="view-toggle-btn active"
            >
              Flow
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing || analyzing}
            className="btn-icon"
            title="Refresh from WorkFlowy"
          >
            <RefreshIcon />
          </button>
        </div>

        {/* Flow canvas */}
        {analyzing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">Analyzing connections...</p>
            </div>
          </div>
        ) : connections ? (
          <DOKFlow sections={sections} connections={connections} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[var(--text-muted)]">No connections analyzed yet</p>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen">
      <MenuButton onClick={() => setSidebarOpen(true)} savedCount={savedList.length} />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        savedList={savedList}
        currentId={id || null}
        onDelete={onRefresh}
        onRefresh={handleSidebarRefresh}
      />

      <main className="max-w-3xl mx-auto px-6 py-20">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{brainlift.name}</h1>
            {connections && (
              <p className="text-[var(--text-muted)] text-sm mt-1">
                {connections.dok2_to_dok3.length + connections.dok3_to_dok4.length} connections found
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {connections && (
              <div className="view-toggle">
                <button
                  onClick={() => setViewMode("list")}
                  className="view-toggle-btn active"
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("flow")}
                  className="view-toggle-btn"
                >
                  Flow
                </button>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || analyzing}
              className="btn-icon"
              title="Refresh from WorkFlowy"
            >
              <RefreshIcon />
            </button>
            {!connections && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="btn-secondary"
              >
                {analyzing ? "Analyzing..." : "Analyze Connections"}
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="glass-panel p-4 mb-8 border-red-500/30">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {analyzing ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">Analyzing connections...</p>
            </div>
          </div>
        ) : (
          <>
            {renderDOKSection("DOK4 — Spiky POVs", sections.dok4_spov, "dok4", "dok4")}
            {renderDOKSection("DOK3 — Insights", sections.dok3_insights, "dok3", "dok3")}
            {renderDOKSection("DOK2 — Knowledge Tree", sections.dok2_knowledge_tree, "dok2", "dok2")}

            {!sections.dok4_spov && !sections.dok3_insights && !sections.dok2_knowledge_tree && (
              <p className="text-center text-[var(--text-muted)] py-8">No DOK sections found</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
