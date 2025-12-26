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
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-800",
    handle: "!bg-amber-500",
    shadow: "shadow-amber-100",
  },
  dok3: {
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800",
    handle: "!bg-emerald-500",
    shadow: "shadow-emerald-100",
  },
  dok2: {
    bg: "bg-blue-50",
    border: "border-blue-400",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-800",
    handle: "!bg-blue-500",
    shadow: "shadow-blue-100",
  },
};

// --- Custom Node Component ---

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
      // Update z-index in React Flow state to ensure it renders on top
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
        relative group transition-all duration-300 ease-in-out
        w-[320px] rounded-xl border-2 
        ${colors.bg} ${colors.border} ${colors.text}
        ${selected ? "ring-2 ring-offset-2 ring-indigo-500 shadow-xl" : "shadow-md hover:shadow-lg"}
        ${expanded ? "scale-105" : ""}
      `}
    >
      {/* Handles */}
      {(dokType === "dok4" || dokType === "dok3") && (
        <Handle
          type="target"
          position={Position.Right}
          className={`w-3 h-3 border-2 border-white ${colors.handle}`}
        />
      )}
      {(dokType === "dok3" || dokType === "dok2") && (
        <Handle
          type="source"
          position={Position.Left}
          className={`w-3 h-3 border-2 border-white ${colors.handle}`}
        />
      )}

      {/* Header / Title Area */}
      <div 
        className="p-4 cursor-pointer flex items-start gap-3"
        onClick={toggleExpand}
      >
        <div className={`mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${colors.badge} text-xs font-bold shrink-0`}>
           {dokType === 'dok4' ? '4' : dokType === 'dok3' ? '3' : '2'}
        </div>
        
        <div className="flex-1">
          <div className="font-semibold text-sm leading-snug">
            {expanded ? fullContent : label}
          </div>
          {!expanded && fullContent.length > label.length && (
             <p className="text-[10px] opacity-60 mt-1 uppercase tracking-wider font-bold">Click to expand</p>
          )}
        </div>

        <div className="text-slate-400 shrink-0">
           {expanded ? (
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
               <path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
             </svg>
           ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
               <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
             </svg>
           )}
        </div>
      </div>

      {/* Expanded Content */}
      <div 
        className={`
          transition-all duration-300 ease-in-out px-4
          ${expanded ? "max-h-[350px] opacity-100 pb-4 overflow-y-auto custom-scrollbar" : "max-h-0 opacity-0 pb-0 overflow-hidden"}
        `}
        // Prevent scroll propagation to canvas
        onWheel={(e) => e.stopPropagation()}
      >
         <div className={`h-px w-full ${colors.border} opacity-20 mb-3`} />
         
         {children.length > 0 ? (
           <ul className="list-disc list-inside space-y-1">
             {children.map((child, idx) => (
               <li key={idx} className="text-xs opacity-90 leading-relaxed pl-1">
                 {child}
               </li>
             ))}
           </ul>
         ) : (
           <p className="text-xs opacity-60 italic">No additional details.</p>
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

// --- Main Component ---

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

    // Calculate tight bounds from node positions
    const nodeWidth = COLUMN_WIDTH;
    const nodeHeight = 100; // Approximate collapsed node height
    const padding = 25;

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
      backgroundColor: '#f8fafc',
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
      className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm text-sm font-medium text-slate-700 transition-colors disabled:opacity-50"
      title="Export as PNG"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
      </svg>
      {downloading ? "Exporting..." : "Export PNG"}
    </button>
  );
}

export default function DOKFlow({ sections, connections }: DOKFlowProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Column X positions (DOK4 left, DOK3 middle, DOK2 right)
    // Note: We are using a visually RTL flow for logic: DOK2 -> DOK3 -> DOK4
    // But rendering Left-to-Right on screen: DOK4 (left) < DOK3 < DOK2 (right)
    // Wait, let's verify visual order.
    // DOK4 (x=0) | DOK3 (x=300+) | DOK2 (x=600+)
    // DOK2 connects to DOK3. DOK3 connects to DOK4.
    // Visual arrows: DOK2 (Right) -> DOK3 (Middle) -> DOK4 (Left).
    // Correct.
    
    const columnX = {
      dok4: 0,
      dok3: COLUMN_WIDTH + COLUMN_GAP,
      dok2: (COLUMN_WIDTH + COLUMN_GAP) * 2,
    };

    const dok4Items = sections.dok4_spov?.items || [];
    const dok3Items = sections.dok3_insights?.items || [];
    const dok2Items = sections.dok2_knowledge_tree?.items || [];

    // Build connection maps for smart positioning
    const dok3ToDok4s: Map<number, number[]> = new Map();
    const dok3ToDok2s: Map<number, number[]> = new Map();
    
    // We track which items are placed to handle orphans later
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

    // 1. Position DOK3 nodes (Middle Column - Anchors)
    const dok3Positions: Map<number, number> = new Map();
    let currentY = 0;

    dok3Items.forEach((item) => {
      // Calculate group height based on connected neighbors
      const connectedDok4Count = dok3ToDok4s.get(item.index)?.length || 0;
      const connectedDok2Count = dok3ToDok2s.get(item.index)?.length || 0;
      // Ensure at least enough space for the node itself
      const groupSize = Math.max(1, connectedDok4Count, connectedDok2Count);
      
      // Center the DOK3 node in its "zone"
      // The zone height is roughly groupSize * (NODE_HEIGHT approx 100 + GAP)
      // Actually, let's just stack them with sufficient padding for the sub-trees
      
      const estimatedNodeHeight = 100; // rough estimate for collapsed state
      const zoneHeight = groupSize * (estimatedNodeHeight + NODE_GAP);
      
      // Place DOK3 in the middle of this zone
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

      // 2. Position Connected DOK4s (Left Column)
      const dok4s = dok3ToDok4s.get(item.index) || [];
      const dok4StartY = currentY; // Start at top of zone
      const dok4Step = zoneHeight / Math.max(1, dok4s.length);

      dok4s.forEach((dok4Idx, i) => {
        const dok4Item = dok4Items.find(d => d.index === dok4Idx);
        if (dok4Item && !positionedDok4s.has(dok4Idx)) {
           // Center in its slice
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

      // 3. Position Connected DOK2s (Right Column)
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

    // 4. Position Orphaned DOK4s
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
          style: { opacity: 0.6 }
        });
        currentY += 120;
      }
    });

    // 5. Position Orphaned DOK2s
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
          style: { opacity: 0.6 }
        });
        currentY += 120;
      }
    });

    // Edges
    if (connections) {
      connections.dok2_to_dok3.forEach((conn, idx) => {
        edges.push({
          id: `e-dok2-dok3-${idx}`,
          source: `dok2-${conn.source_index}`,
          target: `dok3-${conn.target_index}`,
          style: {
            stroke: conn.type === "supports" ? "#10b981" : "#ef4444",
            strokeWidth: 2,
            opacity: 0.6,
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
            stroke: conn.type === "supports" ? "#10b981" : "#ef4444",
            strokeWidth: 2,
            opacity: 0.6,
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
    <div className="w-full h-[calc(100vh-200px)] min-h-[600px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 relative shadow-inner">
      {/* Legend */}
      <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm rounded-xl p-4 text-xs shadow-lg border border-slate-100">
        <div className="font-bold text-slate-800 mb-3 text-sm">BrainLift Structure</div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
            <span className="text-slate-600 font-medium">DOK4 - SPOVs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
            <span className="text-slate-600 font-medium">DOK3 - Insights</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400 shadow-sm" />
            <span className="text-slate-600 font-medium">DOK2 - Knowledge</span>
          </div>
        </div>

        <div className="border-t border-slate-100 mt-3 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-green-500 rounded-full" />
            <span className="text-slate-500">Supports</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-red-500 rounded-full" />
            <span className="text-slate-500">Contradicts</span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls className="bg-white/90 backdrop-blur border border-slate-200 shadow-lg rounded-lg overflow-hidden" />

        {/* Export Button */}
        <div className="absolute top-6 right-6 z-10">
          <DownloadButton />
        </div>
      </ReactFlow>
    </div>
  );
}
