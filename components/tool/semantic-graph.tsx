"use client";

import dynamic from "next/dynamic";
import type { GraphLink, GraphNode } from "@/lib/pipeline/models";

type SemanticGraphLink = Omit<GraphLink, "sourceIds"> & { sourceIds?: string[] };

export interface SemanticGraphProps {
  nodes: GraphNode[];
  links: SemanticGraphLink[];
  selectedNodeId: string | null;
  showGapsOnly: boolean;
  onNodeSelect: (nodeId: string) => void;
}

const SemanticGraphInner = dynamic(() => import("./semantic-graph-inner"), {
  ssr: false,
  loading: () => (
    <div className="h-[72vh] w-full animate-pulse rounded-xl bg-surface-inset" />
  ),
});

export function SemanticGraph(props: SemanticGraphProps) {
  return <SemanticGraphInner {...props} />;
}
