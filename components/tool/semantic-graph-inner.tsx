"use client";

import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { NodeBorderProgram } from "@sigma/node-border";
import { useEffect } from "react";
import type { EntityType, GraphLink, GraphNode } from "@/lib/pipeline/models";
import type { SemanticGraphProps } from "./semantic-graph";

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  Person: "#2563eb",
  Org: "#0f766e",
  Concept: "#7c3aed",
  Event: "#d97706",
  Claim: "#e11d48",
};
const ENTITY_TYPE_FALLBACK_COLOR = "#64748b";

const COMMUNITY_RING_COLORS = [
  "#f97316", "#06b6d4", "#84cc16", "#ec4899",
  "#14b8a6", "#f59e0b", "#8b5cf6", "#6366f1",
] as const;

const SELECTED_BORDER_COLOR = "#f8fafc";

const SIGMA_SETTINGS = {
  nodeProgramClasses: { border: NodeBorderProgram },
  defaultNodeType: "border",
  renderLabels: true,
  labelDensity: 0.07,
  labelGridCellSize: 60,
  minCameraRatio: 0.1,
  maxCameraRatio: 10,
} as const;

const FA2_SETTINGS = {
  slowDown: 10,
  gravity: 1,
  scalingRatio: 2,
  barnesHutOptimize: true,
  barnesHutTheta: 0.5,
} as const;

const FA2_STOP_TIMEOUT_MS = 6000;

function entityFillColor(node: GraphNode): string {
  if (node.entityType && node.entityType in ENTITY_TYPE_COLORS) {
    return ENTITY_TYPE_COLORS[node.entityType];
  }
  return ENTITY_TYPE_FALLBACK_COLOR;
}

function edgeSizeForLink(link: GraphLink): number {
  if (link.missing) return 2;
  if (link.relType === "causal") return 3.5;
  if (link.relType === "associative") return 1.5;
  return 1;
}

function edgeColorForLink(link: GraphLink): string {
  if (link.missing) return "#fb7185";
  if (link.relType === "causal") return "#94a3b8";
  if (link.relType === "associative") return "#64748b";
  return "rgba(100,116,139,0.35)";
}

function GraphLoader({
  nodes,
  links,
  selectedNodeId,
}: Pick<SemanticGraphProps, "nodes" | "links" | "selectedNodeId">) {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new Graph();

    for (const node of nodes) {
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 10 - 5,
        y: Math.random() * 10 - 5,
        size: node.size ?? 10,
        color: entityFillColor(node),
        type: "border",
        borderColor: selectedNodeId === node.id ? SELECTED_BORDER_COLOR : "transparent",
        communityColor: "transparent",
      });
    }

    for (const link of links) {
      if (!graph.hasNode(link.source) || !graph.hasNode(link.target)) continue;
      try {
        graph.addEdge(link.source, link.target, {
          size: edgeSizeForLink(link),
          color: edgeColorForLink(link),
        });
      } catch (err) {
        console.error("[semantic-graph] edge add failed", err);
      }
    }

    loadGraph(graph, true);
  }, [nodes, links, selectedNodeId, loadGraph]);

  return null;
}

function EventBinder({ onNodeSelect }: Pick<SemanticGraphProps, "onNodeSelect">) {
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => onNodeSelect(event.node),
      clickStage: () => onNodeSelect(""),
    });
  }, [registerEvents, onNodeSelect]);

  return null;
}

function SelectionHighlighter({ selectedNodeId }: Pick<SemanticGraphProps, "selectedNodeId">) {
  const sigma = useSigma();

  useEffect(() => {
    const graph = sigma.getGraph();
    graph.forEachNode((id, attrs) => {
      graph.setNodeAttribute(
        id,
        "borderColor",
        id === selectedNodeId ? SELECTED_BORDER_COLOR : (attrs.communityColor ?? "transparent"),
      );
    });
  }, [selectedNodeId, sigma]);

  return null;
}

function LayoutAndCommunityController() {
  const sigma = useSigma();
  const { start, stop, kill } = useWorkerLayoutForceAtlas2({ settings: FA2_SETTINGS });

  useEffect(() => {
    start();
    const timer = window.setTimeout(() => {
      stop();
      const graph = sigma.getGraph();
      try {
        const result = louvain.detailed(graph);
        if (result.count >= 3) {
          graph.forEachNode((nodeId) => {
            const community = result.communities[nodeId] ?? 0;
            const ring = COMMUNITY_RING_COLORS[community % COMMUNITY_RING_COLORS.length];
            graph.setNodeAttribute(nodeId, "communityColor", ring);
            graph.setNodeAttribute(nodeId, "borderColor", ring);
          });
        } else {
          graph.forEachNode((nodeId) => {
            graph.setNodeAttribute(nodeId, "communityColor", "transparent");
            graph.setNodeAttribute(nodeId, "borderColor", "transparent");
          });
        }
      } catch (err) {
        console.error("[semantic-graph] louvain failed", err);
      }
    }, FA2_STOP_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      stop();
      kill();
    };
  }, [start, stop, kill, sigma]);

  return null;
}

export default function SemanticGraphInner(props: SemanticGraphProps) {
  return (
    <SigmaContainer style={{ height: "72vh", width: "100%" }} settings={SIGMA_SETTINGS}>
      <GraphLoader nodes={props.nodes} links={props.links} selectedNodeId={props.selectedNodeId} />
      <EventBinder onNodeSelect={props.onNodeSelect} />
      <SelectionHighlighter selectedNodeId={props.selectedNodeId} />
      <LayoutAndCommunityController />
    </SigmaContainer>
  );
}
