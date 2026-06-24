/** Clears Radix modal scroll/pointer locks left on document.body. */
export function releaseRadixOverlayLock() {
  if (typeof document === "undefined") return

  document.body.style.removeProperty("pointer-events")
  document.body.style.removeProperty("overflow")
  document.body.style.removeProperty("padding-right")
  document.body.removeAttribute("data-scroll-locked")

  const staleOverlaySelectors = [
    '[data-slot="alert-dialog-overlay"][data-state="closed"]',
    '[data-slot="dialog-overlay"][data-state="closed"]',
    '[data-slot="sheet-overlay"][data-state="closed"]',
  ]

  for (const selector of staleOverlaySelectors) {
    document.querySelectorAll(selector).forEach((element) => {
      element.remove()
    })
  }
}
