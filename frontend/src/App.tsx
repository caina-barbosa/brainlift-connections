import { useState, useEffect } from "react";
import { Routes, Route, useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Toaster, toast } from "sonner";
import "./App.css";
import DOKFlow from "./DOKFlow";

// Types
interface DOKItem {
  index: number;
  content: string;
  children: string[];
}

interface DOKSection {
  raw: string;
  items: DOKItem[];
}

interface BrainLiftSections {
  owners: string;
  purpose: string;
  experts: string;
  dok2_knowledge_tree: DOKSection | null;
  dok3_insights: DOKSection | null;
  dok4_spov: DOKSection | null;
}

interface Connection {
  source_index: number;
  target_index: number;
  type: "supports" | "contradicts";
  score: number;
  reasoning: string;
}

interface ConnectionAnalysis {
  dok2_to_dok3: Connection[];
  dok3_to_dok4: Connection[];
}

interface BrainLiftSummary {
  id: string;
  name: string;
  created_at: string;
}

interface ExtractResponse {
  success: boolean;
  brainlift_id: string | null;
  brainlift_name: string | null;
  sections: BrainLiftSections | null;
  error: string | null;
  raw_markdown: string;
}

interface SavedBrainLift {
  id: string;
  name: string;
  url: string;
  created_at: string;
  sections: BrainLiftSections;
  connections: ConnectionAnalysis | null;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

// Sidebar component (shared across all pages)
function Sidebar({ savedList, currentId, onDelete, onRefresh }: { savedList: BrainLiftSummary[]; currentId: string | null; onDelete: (id: string) => void; onRefresh?: (id: string) => void }) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Delete this visualization?")) return;

    try {
      const res = await fetch(`${API_URL}/brainlifts/${id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(id);
        if (currentId === id) {
          navigate("/");
        }
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setMenuOpen(null);
  };

  const handleRefreshClick = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(null);

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
        if (onRefresh) {
          onRefresh(id);
        }
      } else {
        toast("No changes detected", {
          style: { background: "#fef3c7", color: "#92400e" },
        });
      }
    } catch (err) {
      toast.error(`Refresh failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 p-4 shrink-0">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
        Visualizations
      </h2>

      <Link
        to="/"
        className="block w-full mb-4 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors text-center"
      >
        + New Visualization
      </Link>

      <ul className="list-none p-0 m-0 space-y-1">
        {savedList.map((bl) => (
          <li key={bl.id} className="relative group">
            <Link
              to={`/bl/${bl.id}`}
              className={`flex items-center justify-between w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                currentId === bl.id
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="truncate flex-1">{bl.name}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(menuOpen === bl.id ? null : bl.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-300 rounded transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
              </button>
            </Link>

            {menuOpen === bl.id && (
              <div className="absolute right-2 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
                <button
                  onClick={(e) => handleRefreshClick(bl.id, e)}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={(e) => handleDelete(bl.id, e)}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
        {savedList.length === 0 && (
          <li className="text-sm text-slate-400 px-3 py-2">No visualizations yet</li>
        )}
      </ul>
    </aside>
  );
}

// Validate WorkFlowy secret link
function isValidWorkflowyUrl(url: string): boolean {
  // Pattern: https://workflowy.com/s/anything/shareId
  return /^https:\/\/workflowy\.com\/s\/[^/]+\/[a-zA-Z0-9]+\/?$/.test(url.trim());
}

// Home page - new BrainLift extraction
function HomePage({ savedList, onRefresh }: { savedList: BrainLiftSummary[]; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidUrl = isValidWorkflowyUrl(url);
  const hasInput = url.trim().length > 0;

  const handleExtract = async () => {
    if (!isValidUrl) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data: ExtractResponse = await response.json();

      if (data.success && data.brainlift_id) {
        onRefresh();
        navigate(`/bl/${data.brainlift_id}`);
      } else {
        setError(data.error || "Failed to parse BrainLift");
      }
    } catch (e) {
      setError(`Connection error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar savedList={savedList} currentId={null} onDelete={onRefresh} />
      <main className="flex-1 p-8 max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Visualize BrainLift Connections</h1>
          <p className="text-slate-500 text-sm mt-1">
            Paste a WorkFlowy secret link to visualize DOK connections
          </p>
        </header>

        <div className="flex gap-3 mb-8">
          <input
            type="text"
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-slate-500 transition-colors"
            placeholder="https://workflowy.com/s/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExtract()}
          />
          <div className="relative group">
            <button
              className="px-5 py-3 font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleExtract}
              disabled={loading || (hasInput && !isValidUrl)}
            >
              {loading ? "..." : "Visualize"}
            </button>
            {hasInput && !isValidUrl && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Enter a valid WorkFlowy secret link
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 text-sm">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

// BrainLift detail page
function BrainLiftPage({ savedList, onRefresh }: { savedList: BrainLiftSummary[]; onRefresh: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get("view") as "list" | "flow") || "flow";

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brainlift, setBrainlift] = useState<SavedBrainLift | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      loadBrainLift(id);
    }
  }, [id]);

  // Auto-analyze when brainlift loads without connections
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
          style: { background: "#fef3c7", color: "#92400e" },
        });
      }
    } catch (e) {
      toast.error(`Refresh failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSidebarRefresh = async (refreshedId: string) => {
    // If the refreshed brainlift is the one we're viewing, reload and re-analyze
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

  // Get connections for a specific DOK item
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
    accentColor: string
  ) => {
    if (!section || section.items.length === 0) return null;

    return (
      <div className="mb-8">
        <h2
          className="text-lg font-semibold mb-4 pb-2 border-b-2"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          {title}
          <span className="text-slate-400 font-normal text-sm ml-2">
            ({section.items.length})
          </span>
        </h2>
        <ul className="list-none p-0 m-0">
          {section.items.map((item, idx) => {
            const key = `${dokType}-${idx}`;
            const isExpanded = expandedItems.has(key);
            const hasChildren = item.children.length > 0;
            const itemConnections = getConnectionsFor(dokType, item.index);

            return (
              <li key={idx} className="mb-3">
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    hasChildren ? "hover:bg-slate-50" : ""
                  } ${isExpanded ? "bg-slate-50" : ""}`}
                  onClick={() => hasChildren && toggleExpand(key)}
                >
                  {hasChildren && (
                    <span
                      className="text-slate-400 w-5 text-center shrink-0 select-none"
                      style={{ color: isExpanded ? accentColor : undefined }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  )}
                  {!hasChildren && <span className="w-5 shrink-0" />}
                  <div className="flex-1">
                    <span className="leading-relaxed text-slate-700">{item.content}</span>

                    {/* Connection badges */}
                    {itemConnections.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {itemConnections.map((conn, connIdx) => (
                          <span
                            key={connIdx}
                            className={`text-xs px-2 py-1 rounded-full ${
                              conn.type === "supports"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
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
                  <div className="ml-8 mt-1 pl-4 border-l-2" style={{ borderColor: accentColor }}>
                    {item.children.map((child, childIdx) => (
                      <div
                        key={childIdx}
                        className="py-2 text-sm text-slate-600 leading-relaxed"
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

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar savedList={savedList} currentId={id || null} onDelete={onRefresh} onRefresh={handleSidebarRefresh} />
        <main className="flex-1 p-8 flex items-center justify-center">
          <p className="text-slate-500">Loading...</p>
        </main>
      </div>
    );
  }

  if (!brainlift) {
    return (
      <div className="flex min-h-screen">
        <Sidebar savedList={savedList} currentId={id || null} onDelete={onRefresh} onRefresh={handleSidebarRefresh} />
        <main className="flex-1 p-8">
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error || "Visualization not found"}
          </div>
        </main>
      </div>
    );
  }

  const sections = brainlift.sections;
  const connections = brainlift.connections;

  return (
    <div className="flex min-h-screen">
      <Sidebar savedList={savedList} currentId={id || null} onDelete={onRefresh} onRefresh={handleSidebarRefresh} />
      <main className={`flex-1 p-8 ${viewMode === "flow" ? "" : "max-w-3xl"}`}>
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{brainlift.name}</h1>
            {connections && (
              <p className="text-slate-500 text-sm mt-1">
                {connections.dok2_to_dok3.length + connections.dok3_to_dok4.length} connections found
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            {connections && (
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("flow")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "flow"
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Flow
                </button>
              </div>
            )}
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || analyzing}
              className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              title="Refresh from WorkFlowy"
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>
            {/* Analyze button */}
            {!connections && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {analyzing ? "Analyzing..." : "Analyze Connections"}
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 text-sm">
            {error}
          </div>
        )}

        {analyzing ? (
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-slate-500">Analyzing connections...</p>
          </div>
        ) : viewMode === "flow" && connections ? (
          <DOKFlow sections={sections} connections={connections} />
        ) : viewMode === "flow" && !connections ? (
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-slate-500">No connections analyzed yet</p>
          </div>
        ) : (
          <>
            {renderDOKSection("DOK4 — Spiky POVs", sections.dok4_spov, "dok4", "#f59e0b")}
            {renderDOKSection("DOK3 — Insights", sections.dok3_insights, "dok3", "#10b981")}
            {renderDOKSection("DOK2 — Knowledge Tree", sections.dok2_knowledge_tree, "dok2", "#3b82f6")}

            {!sections.dok4_spov && !sections.dok3_insights && !sections.dok2_knowledge_tree && (
              <p className="text-center text-slate-400 py-8">No DOK sections found</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Main App with routes
function App() {
  const [savedList, setSavedList] = useState<BrainLiftSummary[]>([]);

  useEffect(() => {
    fetchSavedList();
  }, []);

  const fetchSavedList = async () => {
    try {
      const res = await fetch(`${API_URL}/brainlifts`);
      const data = await res.json();
      setSavedList(data);
    } catch (e) {
      console.error("Failed to load visualizations:", e);
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<HomePage savedList={savedList} onRefresh={fetchSavedList} />} />
        <Route path="/bl/:id" element={<BrainLiftPage savedList={savedList} onRefresh={fetchSavedList} />} />
      </Routes>
    </>
  );
}

export default App;
