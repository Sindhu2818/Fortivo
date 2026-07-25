/**
 * AttackPathGraph: the multi-step attack path section of the dashboard.
 *
 * Responsibility: turn one attack_paths[] entry's steps and edges into
 * @xyflow/react nodes and edges laid out left to right, headed by the path
 * title, its severity and likelihood pills, and the LLM narrative. When the scan
 * has more than one path it renders tabs and defaults to the first. When it has
 * none it renders nothing at all — heading included — so the dashboard can never
 * show an empty canvas.
 *
 * Pinned imports — use exactly these:
 *   import { ReactFlow, Background, Controls } from '@xyflow/react'
 *   import '@xyflow/react/dist/style.css'
 * The package is @xyflow/react, NOT reactflow.
 *
 * The graph is read-only, so nodes and edges are passed as plain props — no
 * useNodesState / useEdgesState, which exist to own local mutations we never
 * make. Layout is computed by hand (x = index * 260, y staggered) rather than by
 * dagre: a 2–5 step chain does not need a layout engine.
 *
 * DoD: every attack path renders as a connected chain and node clicks open the
 * matching finding in the drawer.
 */

'use client'

import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Waypoints } from 'lucide-react'
import {
  AttackPathNode,
  KIND_STYLES,
  NODE_WIDTH,
  type AttackStepNode,
} from '@/components/AttackPathNode'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { AttackPath, Finding, Likelihood, StepKind } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Horizontal pitch between step origins, and the slight vertical stagger. */
const X_PITCH = 260
const Y_STAGGER = 44
const GRAPH_HEIGHT = 380

/**
 * Edge labels are full clauses, so React Flow's built-in single-line SVG label
 * would run under the neighbouring cards and get clipped. This edge draws the
 * same bezier but renders the caption as wrapping HTML sized to the corridor
 * between two cards (X_PITCH - NODE_WIDTH), so nothing ever overlaps.
 */
const LABEL_WIDTH = X_PITCH - NODE_WIDTH - 4

type AttackFlowEdge = Edge<{ hex: string }, 'attackStep'>

function AttackPathEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  label,
  data,
}: EdgeProps<AttackFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              width: LABEL_WIDTH,
              color: data?.hex,
            }}
            className="absolute rounded border border-border bg-card px-1.5 py-1 text-center font-mono text-[9px] leading-[1.3]"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

/** Both must be module-level: a fresh object each render makes React Flow warn. */
const NODE_TYPES: NodeTypes = { attackStep: AttackPathNode }
const EDGE_TYPES: EdgeTypes = { attackStep: AttackPathEdge }

const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  likely: 'Likely',
  possible: 'Possible',
  unlikely: 'Unlikely',
}

interface AttackPathGraphProps {
  attackPaths: AttackPath[]
  findingsById: Record<string, Finding>
  onSelect: (findingId: string) => void
}

export function AttackPathGraph({
  attackPaths,
  findingsById,
  onSelect,
}: AttackPathGraphProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const paths = Array.isArray(attackPaths) ? attackPaths.filter((p) => p?.steps?.length) : []

  // Hide the entire section rather than render an empty canvas.
  if (paths.length === 0) return null

  // A shorter attack_paths array on the next scan must not leave a dead index.
  const active = paths[Math.min(activeIndex, paths.length - 1)]

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Attack paths <span className="text-muted-foreground/70">({paths.length})</span>
      </h2>

      {paths.length > 1 && (
        <div
          role="tablist"
          aria-label="Attack paths"
          className="mb-3 flex flex-wrap gap-1.5 border-b border-border pb-3"
        >
          {paths.map((path, i) => {
            const style = SEVERITY_STYLES[path.severity] ?? SEVERITY_STYLES.info
            const selected = path.id === active.id
            return (
              <button
                key={path.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'inline-flex max-w-[22rem] items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                  selected
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
                <span className="truncate">{path.title || path.id}</span>
              </button>
            )
          })}
        </div>
      )}

      <SingleAttackPath
        key={active.id}
        path={active}
        findingsById={findingsById}
        onSelect={onSelect}
      />
    </section>
  )
}

/**
 * `kind` is not in the frozen contract (see lib/types.ts). When it is missing,
 * derive it from the edge topology: a step nothing points at is an entry, a step
 * that points nowhere is an impact, everything else is a pivot. With no edges at
 * all, fall back to first / last by position.
 */
function deriveKinds(path: AttackPath): StepKind[] {
  const edges = Array.isArray(path.edges) ? path.edges : []
  const hasIncoming = new Set(edges.map((e) => e.to))
  const hasOutgoing = new Set(edges.map((e) => e.from))
  const last = path.steps.length - 1

  return path.steps.map((step, i) => {
    if (step.kind) return step.kind
    if (edges.length === 0) return i === 0 ? 'entry' : i === last ? 'impact' : 'pivot'
    if (!hasIncoming.has(step.finding_id)) return 'entry'
    if (!hasOutgoing.has(step.finding_id)) return 'impact'
    return 'pivot'
  })
}

function SingleAttackPath({
  path,
  findingsById,
  onSelect,
}: {
  path: AttackPath
  findingsById: Record<string, Finding>
  onSelect: (findingId: string) => void
}) {
  const { nodes, edges } = useMemo(() => {
    const kinds = deriveKinds(path)

    // Node ids are keyed to the step, not the finding, so a finding that appears
    // twice in one path cannot produce two nodes with the same id. Edges address
    // findings, so keep a lookup back to the node that first used each one.
    const nodeIdByFinding = new Map<string, string>()

    const builtNodes: AttackStepNode[] = path.steps.map((step, i) => {
      const nodeId = `${path.id}-s${step.order ?? i + 1}-${i}`
      if (step.finding_id && !nodeIdByFinding.has(step.finding_id)) {
        nodeIdByFinding.set(step.finding_id, nodeId)
      }
      const finding = step.finding_id ? findingsById[step.finding_id] : undefined

      return {
        id: nodeId,
        type: 'attackStep',
        position: { x: i * X_PITCH, y: i % 2 === 0 ? 0 : Y_STAGGER },
        // Width hint so the first fitView is correct instead of running before
        // the DOM measurement lands.
        width: NODE_WIDTH,
        draggable: false,
        data: {
          kind: kinds[i],
          label: step.label || step.finding_id || 'Unnamed step',
          technique: step.technique ?? '',
          order: step.order ?? i + 1,
          // Only clickable when the id actually resolves — the contract promises
          // it does, but a half-finished backend run is how that breaks.
          findingId: finding ? step.finding_id : null,
          severity: finding?.severity ?? null,
        },
      }
    })

    const kindByNodeId = new Map(builtNodes.map((n, i) => [n.id, kinds[i]]))

    const builtEdges: AttackFlowEdge[] = (Array.isArray(path.edges) ? path.edges : []).flatMap((e, i) => {
      const source = nodeIdByFinding.get(e.from)
      const target = nodeIdByFinding.get(e.to)
      // Drop an edge whose endpoints don't resolve rather than let React Flow
      // warn about a missing node on every render.
      if (!source || !target) return []

      // Edge takes the colour of the node it leads into, so the chain visibly
      // darkens toward impact.
      const hex = (KIND_STYLES[kindByNodeId.get(target) ?? 'pivot'] ?? KIND_STYLES.pivot).hex

      return [
        {
          id: `${path.id}-e${i}`,
          type: 'attackStep' as const,
          source,
          target,
          animated: true,
          label: e.label,
          data: { hex },
          style: { stroke: hex, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: hex, width: 16, height: 16 },
        },
      ]
    })

    return { nodes: builtNodes, edges: builtEdges }
  }, [path, findingsById])

  const severity = SEVERITY_STYLES[path.severity] ?? SEVERITY_STYLES.info

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Waypoints className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{path.title || path.id}</h3>
          <span
            className={cn(
              'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide',
              severity.bg,
              severity.border,
              severity.text
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', severity.dot)} />
            {severity.label}
          </span>
          {path.likelihood && (
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {LIKELIHOOD_LABEL[path.likelihood] ?? path.likelihood}
            </span>
          )}
        </div>
        {path.narrative && (
          <p className="text-sm leading-relaxed text-muted-foreground">{path.narrative}</p>
        )}
      </div>

      {/* @xyflow/react's stylesheet is custom-property driven, so its own dark
          colorMode plus these five overrides put the zoom controls on our tokens
          instead of the vendor greys. */}
      <div
        style={
          {
            height: GRAPH_HEIGHT,
            '--xy-controls-button-background-color': 'hsl(var(--card))',
            '--xy-controls-button-background-color-hover': 'hsl(var(--muted))',
            '--xy-controls-button-color': 'hsl(var(--muted-foreground))',
            '--xy-controls-button-color-hover': 'hsl(var(--foreground))',
            '--xy-controls-button-border-color': 'hsl(var(--border))',
          } as React.CSSProperties
        }
        className="bg-background"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            const findingId = (node.data as AttackStepNode['data']).findingId
            if (findingId) onSelect(findingId)
          }}
        >
          <Background color="hsl(var(--border))" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
