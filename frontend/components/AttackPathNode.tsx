/**
 * AttackPathNode: the custom @xyflow/react node type for one attack-path step.
 *
 * Responsibility: render a single step as a card — kind icon, step number and
 * technique, the step label, and the linked finding's severity pill — with a
 * target Handle on the left and a source Handle on the right so the graph can
 * chain them left to right. Presentation only: it owns no state and no click
 * handler, because AttackPathGraph routes clicks through ReactFlow's
 * onNodeClick.
 *
 * Pinned imports — use exactly these:
 *   import { Handle, Position } from '@xyflow/react'
 * The package is @xyflow/react, NOT reactflow.
 *
 * Colour: border and icon are keyed to the step's `kind` (entry / pivot /
 * impact), which is a deliberate, documented departure from
 * docs/frontend-refs/collisions.md rules 1 and 3 — those reserve amber and red
 * for the severity ramp and put severity on the node border. Severity still
 * appears on every node, but as the labelled pill, so hue is never the only
 * thing carrying it. The pivot blue is the Primary token rather than a new blue,
 * and the impact red is the ramp's own critical red rather than a sixth red.
 * See the note in STATUS.md.
 *
 * DoD: a node renders for every step, shows severity when the step links to a
 * finding, and connects cleanly to its neighbours.
 */

'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Crosshair, GitBranch, KeyRound } from 'lucide-react'
import { SEVERITY_STYLES } from '@/lib/severity'
import type { Severity, StepKind } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Width of a node card. Deliberately well below AttackPathGraph's 260px x-pitch:
 * the 92px corridor it leaves is where the edge labels live, so narrowing the
 * card is what keeps a label from being drawn behind its neighbours.
 */
export const NODE_WIDTH = 168

interface KindStyle {
  label: string
  /** Border, icon and outgoing-edge colour. */
  hex: string
  Icon: typeof KeyRound
}

export const KIND_STYLES: Record<StepKind, KindStyle> = {
  entry: { label: 'Entry', hex: '#F5A524', Icon: KeyRound },
  pivot: { label: 'Pivot', hex: '#24B6E4', Icon: GitBranch },
  impact: { label: 'Impact', hex: '#E5484D', Icon: Crosshair },
}

/**
 * Declared as a `type`, not an `interface` — @xyflow/react v12 constrains node
 * data to `Record<string, unknown>`, which an interface does not satisfy.
 */
export type AttackStepNodeData = {
  kind: StepKind
  label: string
  technique: string
  order: number
  /** `null` when the step's finding_id doesn't resolve in this document. */
  findingId: string | null
  /** `null` when there is no linked finding to take a severity from. */
  severity: Severity | null
}

export type AttackStepNode = Node<AttackStepNodeData, 'attackStep'>

/** Small, on-palette handles instead of React Flow's default dark dots. */
const HANDLE_STYLE = {
  width: 7,
  height: 7,
  border: 'none',
  background: 'hsl(var(--muted-foreground))',
} as const

export function AttackPathNode({ data }: NodeProps<AttackStepNode>) {
  // An unexpected kind string must not crash on a missing style entry.
  const kind = KIND_STYLES[data.kind] ?? KIND_STYLES.pivot
  const { Icon } = kind
  const severity = data.severity ? SEVERITY_STYLES[data.severity] ?? SEVERITY_STYLES.info : null
  const clickable = data.findingId != null

  return (
    <>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} isConnectable={false} />

      {/* Keyboard focus is React Flow's: it puts the tabindex on .react-flow__node,
          which wraps this card exactly, so globals.css's generic [tabindex] outline
          already lands in the right place. Only hover is ours. */}
      <div
        style={{ width: NODE_WIDTH, borderColor: kind.hex }}
        className={cn(
          'rounded-lg border bg-card px-3 py-3 text-left transition-all',
          clickable ? 'cursor-pointer hover:bg-muted hover:shadow-lg hover:shadow-black/30' : 'cursor-default'
        )}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: kind.hex }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: kind.hex }}
          >
            {kind.label}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
            {data.order}
          </span>
        </div>

        <p className="mt-1.5 line-clamp-3 text-xs font-medium leading-snug text-foreground">
          {data.label}
        </p>

        {data.technique && (
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {data.technique}
          </p>
        )}

        {severity && (
          <span
            className={cn(
              'mt-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide',
              severity.bg,
              severity.border,
              severity.text
            )}
          >
            <span className={cn('h-1 w-1 rounded-full', severity.dot)} />
            {severity.label}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} isConnectable={false} />
    </>
  )
}
