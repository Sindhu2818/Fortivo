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
 * Per frontend-refs/collisions.md rule 3: nodes use KeyRound / GitBranch /
 * Crosshair in neutral colour, and severity is applied to the node BORDER only —
 * never to the icon, the fill, or the label text.
 *
 * DoD: every attack path renders as a connected chain and node clicks open the
 * matching finding.
 */

'use client'

import { useMemo } from 'react'
import { ReactFlow, Background, Controls, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EmptyState } from '@/components/EmptyState'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { AttackPath, Finding } from '@/lib/types'
import { Crosshair, GitBranch, KeyRound, Waypoints } from 'lucide-react'

interface AttackGraphProps {
  attackPaths: AttackPath[]
  findingsById: Record<string, Finding>
  onSelect: (findingId: string) => void
}

const LIKELIHOOD_LABEL: Record<AttackPath['likelihood'], string> = {
  likely: 'Likely',
  possible: 'Possible',
  unlikely: 'Unlikely',
}

/** First step is initial access, last is the objective, everything between is a pivot. */
function stepIcon(index: number, total: number) {
  if (index === 0) return KeyRound
  if (index === total - 1) return Crosshair
  return GitBranch
}

export function AttackGraph({ attackPaths, findingsById, onSelect }: AttackGraphProps) {
  if (attackPaths.length === 0) {
    return (
      <EmptyState
        icon={Waypoints}
        title="No attack paths correlated"
        description="Not enough related findings to chain into a multi-step attack story for this scan."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {attackPaths.map((path) => (
        <SingleAttackPath key={path.id} path={path} findingsById={findingsById} onSelect={onSelect} />
      ))}
    </div>
  )
}

function SingleAttackPath({
  path,
  findingsById,
  onSelect,
}: {
  path: AttackPath
  findingsById: Record<string, Finding>
  onSelect: (id: string) => void
}) {
  const { nodes, edges } = useMemo(() => {
    const total = path.steps.length
    const built = path.steps.map((step, i) => {
      const finding = findingsById[step.finding_id]
      const sev = finding?.severity ?? 'info'
      const style = SEVERITY_STYLES[sev]
      const Icon = stepIcon(i, total)
      return {
        id: step.finding_id,
        type: 'default' as const,
        position: { x: i * 280, y: 0 },
        draggable: false,
        data: {
          label: (
            <div className="px-3 py-2.5 text-left">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                Step {step.order} · {step.technique}
              </p>
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-foreground">
                {step.label}
              </p>
            </div>
          ),
        },
        style: {
          background: 'hsl(var(--card))',
          border: `1px solid ${style.hex}55`,
          borderRadius: 10,
          width: 240,
          padding: 0,
        },
      }
    })

    const builtEdges: Edge[] = path.edges.map((e, i) => ({
      id: `${path.id}-e${i}`,
      source: e.from,
      target: e.to,
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
    }))

    return { nodes: built, edges: builtEdges }
  }, [path, findingsById])

  const band = SEVERITY_STYLES[path.severity]
  const height = 150

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{path.title}</h3>
          <span
            className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${band.bg} ${band.text} ${band.border}`}
          >
            {band.label}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {LIKELIHOOD_LABEL[path.likelihood]}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{path.narrative}</p>
      </div>

      <div style={{ height }} className="bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => onSelect(node.id)}
        >
          <Background color="hsl(var(--muted))" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
