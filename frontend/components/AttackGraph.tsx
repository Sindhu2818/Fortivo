/**
 * AttackGraph: the multi-step attack path visualization.
 *
 * Responsibility: turn attack_paths[].steps and .edges into @xyflow/react nodes
 * and edges, laid out left-to-right by step order, colored by severity. Clicking
 * a node calls onSelect(findingId) to open the drawer. Shows the path title and
 * narrative alongside the graph.
 *
 * Pinned imports — use exactly these:
 *   import { ReactFlow, Background, Controls } from '@xyflow/react'
 *   import '@xyflow/react/dist/style.css'
 * The package is @xyflow/react, NOT reactflow.
 *
 * DoD: every attack path renders as a connected chain and node clicks open the
 * matching finding.
 */
