"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { FUNCTION_UNIT_MAP } from "@/lib/constants/function-units";
import type { OntologyEdge, OwlClass } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OwlGraphViewerProps {
  classes: OwlClass[];
  edges: OntologyEdge[];
  selectedUri: string | null;
  highlightBpmnId: string | null;
  onSelect: (owlClass: OwlClass) => void;
}

interface ClassNodeData {
  label: string;
  linkedCount: number;
  dotClass?: string;
  [key: string]: unknown;
}

const NODE_WIDTH = 190;
const NODE_HEIGHT = 72;

function ClassNode({ data, selected }: NodeProps): React.ReactNode {
  const nodeData = data as ClassNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div
        className={cn(
          "w-[190px] rounded-lg border border-border bg-card px-3 py-2 shadow-sm",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        <div className="flex items-start gap-2">
          {nodeData.dotClass ? (
            <span
              className={cn("mt-1 size-2.5 shrink-0 rounded-full", nodeData.dotClass)}
              aria-hidden
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{nodeData.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {nodeData.linkedCount} BPMN link{nodeData.linkedCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </>
  );
}

const nodeTypes = {
  classNode: ClassNode,
};

function layoutElements(
  classNodes: OwlClass[],
  graphEdges: OntologyEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 56, ranksep: 80 });

  const flowNodes: Node[] = classNodes.map((owlClass) => {
    const unit = owlClass.functionUnit
      ? FUNCTION_UNIT_MAP[owlClass.functionUnit]
      : undefined;

    return {
      id: owlClass.uri,
      type: "classNode",
      data: {
        label: owlClass.label,
        linkedCount: owlClass.linkedBpmnElements.length,
        dotClass: unit?.dotClass,
      },
      position: { x: 0, y: 0 },
    };
  });

  const flowEdges: Edge[] = graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    animated: edge.edgeType === "precedes",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
    },
    style: {
      stroke:
        edge.edgeType === "subClassOf"
          ? "var(--muted-foreground)"
          : "var(--primary)",
      strokeWidth: edge.edgeType === "precedes" ? 2 : 1.5,
    },
    labelStyle: {
      fill: "var(--muted-foreground)",
      fontSize: 10,
    },
  }));

  for (const node of flowNodes) {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of flowEdges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  const positionedNodes = flowNodes.map((node) => {
    const layout = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: layout.x - NODE_WIDTH / 2,
        y: layout.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges: flowEdges };
}

export function OwlGraphViewer({
  classes,
  edges,
  selectedUri,
  highlightBpmnId,
  onSelect,
}: OwlGraphViewerProps): React.ReactNode {
  const highlightedUri = useMemo(() => {
    if (!highlightBpmnId) {
      return null;
    }
    return (
      classes.find((item) => item.linkedBpmnElements.includes(highlightBpmnId))
        ?.uri ?? null
    );
  }, [classes, highlightBpmnId]);

  const { nodes, edges: flowEdges } = useMemo(
    () => layoutElements(classes, edges),
    [classes, edges],
  );

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedUri || node.id === highlightedUri,
      })),
    [nodes, selectedUri, highlightedUri],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 bg-primary" />
          precedes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 bg-muted-foreground" />
          subClassOf
        </span>
      </div>
      <div className="h-[520px] overflow-hidden rounded-lg border border-border bg-muted/10">
        <ReactFlow
          nodes={nodesWithSelection}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesFocusable
          elementsSelectable
          onNodeClick={(_, node) => {
            const owlClass = classes.find((item) => item.uri === node.id);
            if (owlClass) {
              onSelect(owlClass);
            }
          }}
        >
          <Background gap={16} size={1} color="var(--border)" />
          <MiniMap
            pannable
            zoomable
            nodeColor={() => "var(--primary)"}
            maskColor="rgb(0 0 0 / 0.55)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {(selectedUri || highlightedUri) && (
        <p className="text-xs text-muted-foreground">
          Selected:{" "}
          <span className="font-medium text-foreground">
            {classes.find((item) => item.uri === (selectedUri ?? highlightedUri))?.label}
          </span>
        </p>
      )}
    </div>
  );
}
