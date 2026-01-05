import { useMemo, useState, memo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Position,
  Handle,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";

// --- Types ---

interface DOKItem {
  index: number;
  content: string;
  children: string[];
}

interface DOKSection {
  raw: string;
  items: DOKItem[];
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

interface BrainLiftSections {
  owners: string;
  purpose: string;
  experts: string;
  dok2_knowledge_tree: DOKSection | null;
  dok3_insights: DOKSection | null;
  dok4_spov: DOKSection | null;
}

interface DOKFlowProps {
  sections: BrainLiftSections;
  connections: ConnectionAnalysis | null;
}

// --- Configuration ---

const COLUMN_WIDTH = 320;
const NODE_GAP = 24;
const COLUMN_GAP = 200;

const COLORS = {
  dok4: {
    primary: "var(--dok4-primary)",
    glow: "var(--dok4-glow)",
    bg: "var(--dok4-bg)",
  },
  dok3: {
    primary: "var(--dok3-primary)",
    glow: "var(--dok3-glow)",
    bg: "var(--dok3-bg)",
  },
  dok2: {
    primary: "var(--dok2-primary)",
    glow: "var(--dok2-glow)",
    bg: "var(--dok2-bg)",
  },
};

// --- Custom Node Component (Dark Theme) ---

const CustomDOKNode = memo(({ id, data, selected }: NodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const { setNodes } = useReactFlow();

  const dokType = data.dokType as "dok4" | "dok3" | "dok2";
  const colors = COLORS[dokType];
  const label = data.label as string;
  const fullContent = data.fullContent as string;
  const children = (data.children as string[]) || [];

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = !prev;
      setNodes((nodes) => nodes.map(n => {
        if (n.id === id) {
          return { ...n, zIndex: next ? 1000 : 0 };
        }
        return n;
      }));
      return next;
    });
  }, [id, setNodes]);

  return (
    <div
      className={`
        relative group transition-all duration-300 ease-out
        w-[320px] rounded-2xl
        ${selected ? "ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-primary)]" : ""}
        ${expanded ? "scale-[1.02]" : "hover:scale-[1.01]"}
      `}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${colors.primary}`,
        boxShadow: `0 0 ${expanded ? '30px' : '20px'} ${colors.glow}`,
      }}
    >
      {/* Handles */}
      {(dokType === "dok4" || dokType === "dok3") && (
        <Handle
          type="target"
          position={Position.Right}
          className="!w-3 !h-3 !border-2 !border-[var(--bg-primary)]"
          style={{ background: colors.primary }}
        />
      )}
      {(dokType === "dok3" || dokType === "dok2") && (
        <Handle
          type="source"
          position={Position.Left}
          className="!w-3 !h-3 !border-2 !border-[var(--bg-primary)]"
          style={{ background: colors.primary }}
        />
      )}

      {/* Header / Title Area */}
      <div
        className="p-4 cursor-pointer flex items-start gap-3"
        onClick={toggleExpand}
      >
        {/* DOK Badge */}
        <div
          className="mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold shrink-0"
          style={{
            background: colors.bg,
            color: colors.primary,
            border: `1px solid ${colors.primary}`,
          }}
        >
          {dokType === 'dok4' ? '4' : dokType === 'dok3' ? '3' : '2'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-snug text-[var(--text-primary)]">
            {expanded ? fullContent : label}
          </div>
          {!expanded && fullContent.length > label.length && (
            <p className="text-[10px] text-[var(--text-muted)] mt-1.5 uppercase tracking-wider font-semibold">
              Click to expand
            </p>
          )}
        </div>

        {/* Expand indicator */}
        <div className="text-[var(--text-muted)] shrink-0 transition-transform duration-300" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      <div
        className={`
          transition-all duration-300 ease-out px-4
          ${expanded ? "max-h-[350px] opacity-100 pb-4 overflow-y-auto custom-scrollbar" : "max-h-0 opacity-0 pb-0 overflow-hidden"}
        `}
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          className="h-px w-full opacity-30 mb-3"
          style={{ background: colors.primary }}
        />

        {children.length > 0 ? (
          <ul className="space-y-2">
            {children.map((child, idx) => (
              <li key={idx} className="text-xs text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colors.primary, opacity: 0.5 }} />
                <span>{child}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">No additional details.</p>
        )}
      </div>
    </div>
  );
});

const nodeTypes = {
  custom: CustomDOKNode,
};

// --- Helper ---

function truncateText(text: string, maxLength: number = 60): string {
  const firstLine = text.split("\n")[0];
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.substring(0, maxLength - 3) + "...";
}

// --- Download Button Component ---

function DownloadButton() {
  const { getNodes } = useReactFlow();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(() => {
    setDownloading(true);

    const nodes = getNodes();
    if (nodes.length === 0) {
      setDownloading(false);
      return;
    }

    const nodeWidth = COLUMN_WIDTH;
    const nodeHeight = 100;
    const padding = 50;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
      const x = node.position.x;
      const y = node.position.y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + nodeWidth);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + nodeHeight);
    });

    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };

    const width = bounds.width;
    const height = bounds.height;

    const flowElement = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowElement) {
      setDownloading(false);
      return;
    }

    toPng(flowElement, {
      backgroundColor: '#1e1e2e',
      width: width,
      height: height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${-bounds.x}px, ${-bounds.y}px) scale(1)`,
      },
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `brainlift-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Export failed:', err);
      })
      .finally(() => {
        setDownloading(false);
      });
  }, [getNodes]);

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="btn-secondary"
      title="Export as PNG"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {downloading ? "Exporting..." : "Export"}
    </button>
  );
}

// --- Legend Component ---

function Legend() {
  return (
    <div className="glass-panel p-4 text-xs">
      <div className="font-display font-semibold text-[var(--text-primary)] mb-3 text-sm">
        BrainLift Structure
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: 'var(--dok4-primary)', boxShadow: '0 0 8px var(--dok4-glow)' }} />
          <span className="text-[var(--text-secondary)]">DOK4 — SPOVs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: 'var(--dok3-primary)', boxShadow: '0 0 8px var(--dok3-glow)' }} />
          <span className="text-[var(--text-secondary)]">DOK3 — Insights</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: 'var(--dok2-primary)', boxShadow: '0 0 8px var(--dok2-glow)' }} />
          <span className="text-[var(--text-secondary)]">DOK2 — Knowledge</span>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] mt-3 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 rounded-full" style={{ background: 'var(--dok3-primary)' }} />
          <span className="text-[var(--text-muted)]">Supports</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 rounded-full bg-red-500" />
          <span className="text-[var(--text-muted)]">Contradicts</span>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function DOKFlow({ sections, connections }: DOKFlowProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const columnX = {
      dok4: 0,
      dok3: COLUMN_WIDTH + COLUMN_GAP,
      dok2: (COLUMN_WIDTH + COLUMN_GAP) * 2,
    };

    const dok4Items = sections.dok4_spov?.items || [];
    const dok3Items = sections.dok3_insights?.items || [];
    const dok2Items = sections.dok2_knowledge_tree?.items || [];

    const dok3ToDok4s: Map<number, number[]> = new Map();
    const dok3ToDok2s: Map<number, number[]> = new Map();

    const positionedDok4s = new Set<number>();
    const positionedDok2s = new Set<number>();

    if (connections) {
      connections.dok3_to_dok4.forEach((conn) => {
        if (!dok3ToDok4s.has(conn.source_index)) dok3ToDok4s.set(conn.source_index, []);
        dok3ToDok4s.get(conn.source_index)!.push(conn.target_index);
      });

      connections.dok2_to_dok3.forEach((conn) => {
        if (!dok3ToDok2s.has(conn.target_index)) dok3ToDok2s.set(conn.target_index, []);
        dok3ToDok2s.get(conn.target_index)!.push(conn.source_index);
      });
    }

    const dok3Positions: Map<number, number> = new Map();
    let currentY = 0;

    dok3Items.forEach((item) => {
      const connectedDok4Count = dok3ToDok4s.get(item.index)?.length || 0;
      const connectedDok2Count = dok3ToDok2s.get(item.index)?.length || 0;
      const groupSize = Math.max(1, connectedDok4Count, connectedDok2Count);

      const estimatedNodeHeight = 100;
      const zoneHeight = groupSize * (estimatedNodeHeight + NODE_GAP);

      const dok3Y = currentY + (zoneHeight / 2) - (estimatedNodeHeight / 2);
      dok3Positions.set(item.index, dok3Y);

      nodes.push({
        id: `dok3-${item.index}`,
        type: "custom",
        position: { x: columnX.dok3, y: dok3Y },
        data: {
          label: truncateText(item.content),
          fullContent: item.content,
          children: item.children,
          dokType: "dok3"
        },
      });

      const dok4s = dok3ToDok4s.get(item.index) || [];
      const dok4StartY = currentY;
      const dok4Step = zoneHeight / Math.max(1, dok4s.length);

      dok4s.forEach((dok4Idx, i) => {
        const dok4Item = dok4Items.find(d => d.index === dok4Idx);
        if (dok4Item && !positionedDok4s.has(dok4Idx)) {
           const d4y = dok4StartY + (i * dok4Step) + (dok4Step/2) - (estimatedNodeHeight/2);
           nodes.push({
             id: `dok4-${dok4Item.index}`,
             type: "custom",
             position: { x: columnX.dok4, y: d4y },
             data: {
               label: truncateText(dok4Item.content),
               fullContent: dok4Item.content,
               children: dok4Item.children,
               dokType: "dok4"
             },
           });
           positionedDok4s.add(dok4Idx);
        }
      });

      const dok2s = dok3ToDok2s.get(item.index) || [];
      const dok2StartY = currentY;
      const dok2Step = zoneHeight / Math.max(1, dok2s.length);

      dok2s.forEach((dok2Idx, i) => {
        const dok2Item = dok2Items.find(d => d.index === dok2Idx);
        if (dok2Item && !positionedDok2s.has(dok2Idx)) {
          const d2y = dok2StartY + (i * dok2Step) + (dok2Step/2) - (estimatedNodeHeight/2);
          nodes.push({
            id: `dok2-${dok2Item.index}`,
            type: "custom",
            position: { x: columnX.dok2, y: d2y },
            data: {
               label: truncateText(dok2Item.content),
               fullContent: dok2Item.content,
               children: dok2Item.children,
               dokType: "dok2"
             },
          });
          positionedDok2s.add(dok2Idx);
        }
      });

      currentY += zoneHeight + NODE_GAP * 2;
    });

    // Orphaned DOK4s
    dok4Items.forEach((item) => {
      if (!positionedDok4s.has(item.index)) {
        nodes.push({
          id: `dok4-${item.index}`,
          type: "custom",
          position: { x: columnX.dok4, y: currentY },
          data: {
             label: truncateText(item.content),
             fullContent: item.content,
             children: item.children,
             dokType: "dok4"
          },
          style: { opacity: 0.5 }
        });
        currentY += 120;
      }
    });

    // Orphaned DOK2s
    dok2Items.forEach((item) => {
      if (!positionedDok2s.has(item.index)) {
        nodes.push({
          id: `dok2-${item.index}`,
          type: "custom",
          position: { x: columnX.dok2, y: currentY },
          data: {
             label: truncateText(item.content),
             fullContent: item.content,
             children: item.children,
             dokType: "dok2"
          },
          style: { opacity: 0.5 }
        });
        currentY += 120;
      }
    });

    // Edges with improved styling
    if (connections) {
      connections.dok2_to_dok3.forEach((conn, idx) => {
        edges.push({
          id: `e-dok2-dok3-${idx}`,
          source: `dok2-${conn.source_index}`,
          target: `dok3-${conn.target_index}`,
          style: {
            stroke: conn.type === "supports" ? "var(--dok3-primary)" : "#ef4444",
            strokeWidth: 2,
          },
          animated: conn.type === "contradicts",
        });
      });

      connections.dok3_to_dok4.forEach((conn, idx) => {
        edges.push({
          id: `e-dok3-dok4-${idx}`,
          source: `dok3-${conn.source_index}`,
          target: `dok4-${conn.target_index}`,
          style: {
            stroke: conn.type === "supports" ? "var(--dok3-primary)" : "#ef4444",
            strokeWidth: 2,
          },
          animated: conn.type === "contradicts",
        });
      });
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [sections, connections]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-full relative">
      {/* Legend - outside ReactFlow is fine (no hooks) */}
      <div className="absolute bottom-6 left-6 z-10">
        <Legend />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#4a4a5e" gap={24} size={2} />
        <Controls className="!bottom-6 !right-6 !left-auto" />

        {/* Export Button - must be inside ReactFlow for useReactFlow() hook */}
        <div className="absolute top-5 right-5 z-10">
          <DownloadButton />
        </div>
      </ReactFlow>
    </div>
  );
}
