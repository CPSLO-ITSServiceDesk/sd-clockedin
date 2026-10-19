"use client"

import { useCallback, useEffect, useRef } from "react"

interface PaintStrokeOptions<C, M> {
  /** Apply `mode` to one cell; called for the first cell and each cell dragged over. */
  onPaint: (_cell: C, _mode: M) => void
  /** Called once on mouse up with every cell the stroke touched. */
  onFinish?: (_cells: C[], _mode: M) => void
  /** Restrict a stroke to cells like the first one (e.g. the same person's row). */
  sameStroke?: (_first: C, _next: C) => boolean
}

/** Click-and-drag painting across grid cells. */
export function usePaintStroke<C, M>({ onPaint, onFinish, sameStroke }: PaintStrokeOptions<C, M>) {
  const stroke = useRef<{ mode: M; cells: C[] } | null>(null)
  const latest = useRef({ onPaint, onFinish, sameStroke })
  latest.current = { onPaint, onFinish, sameStroke }

  useEffect(() => {
    const finish = () => {
      const current = stroke.current
      if (!current) return
      stroke.current = null
      latest.current.onFinish?.(current.cells, current.mode)
    }
    window.addEventListener("mouseup", finish)
    window.addEventListener("blur", finish)
    return () => {
      window.removeEventListener("mouseup", finish)
      window.removeEventListener("blur", finish)
    }
  }, [])

  const start = useCallback((cell: C, mode: M) => {
    stroke.current = { mode, cells: [cell] }
    latest.current.onPaint(cell, mode)
  }, [])

  const enter = useCallback((cell: C) => {
    const current = stroke.current
    if (!current) return
    if (latest.current.sameStroke && !latest.current.sameStroke(current.cells[0], cell)) return
    current.cells.push(cell)
    latest.current.onPaint(cell, current.mode)
  }, [])

  return { start, enter }
}
