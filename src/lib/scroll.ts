// Read a sticky header at its natural position without switching off stickiness.
function naturalCenter(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const header = target.closest<HTMLElement>(".product-header");
  if (!header) return rect.top + rect.height / 2;
  const section = header.parentElement!;
  return section.getBoundingClientRect().top + section.clientTop +
    rect.top - header.getBoundingClientRect().top + rect.height / 2;
}

function alignTo(pane: HTMLElement, target: HTMLElement, y: number) {
  // Respect the real content bounds; alignment must never manufacture whitespace.
  const available = Math.max(0, pane.scrollHeight - pane.clientHeight);
  const top = Math.max(0, Math.min(available, pane.scrollTop + naturalCenter(target) - y));
  pane.scrollTo({ top, behavior: "instant" });
}

// Explicit navigation reveals an issue; it does not use an off-screen anchor.
export function centerInPane(pane: HTMLElement, target: HTMLElement) {
  alignTo(pane, target, pane.getBoundingClientRect().top + pane.clientHeight / 2);
}

// Issue-list navigation centers both partners on one shared viewport baseline.
// Their panes have different header heights, so independent centers don't align.
export function centerPair(first: HTMLElement, second: HTMLElement) {
  const panes = [first, second].map(target =>
    target.closest<HTMLElement>(".fields-scroll, .conversation-scroll"));
  if (!panes[0] || !panes[1]) return;
  const bounds = panes.map(pane => pane!.getBoundingClientRect());
  const center = (Math.max(bounds[0].top, bounds[1].top) +
    Math.min(bounds[0].bottom, bounds[1].bottom)) / 2;
  const ranges = [first, second].map((target, index) => {
    const pane = panes[index]!;
    const highest = naturalCenter(target) + pane.scrollTop;
    return { min: highest - Math.max(0, pane.scrollHeight - pane.clientHeight), max: highest };
  });
  const min = Math.max(ranges[0].min, ranges[1].min);
  const max = Math.min(ranges[0].max, ranges[1].max);
  // Center when possible; otherwise use the nearest jointly reachable baseline.
  const y = min <= max ? Math.max(min, Math.min(max, center)) : center;
  alignTo(panes[0], first, y);
  alignTo(panes[1], second, y);
}

// Keep the clicked pane stationary unless its partner hits a real scroll limit.
export function alignPair(anchor: HTMLElement, target: HTMLElement) {
  const pane = target.closest<HTMLElement>(".fields-scroll, .conversation-scroll");
  if (!pane) return;
  const bounds = anchor.getBoundingClientRect();
  alignTo(pane, target, bounds.top + bounds.height / 2);
  const aligned = target.getBoundingClientRect();
  const actualY = aligned.top + aligned.height / 2;
  if (Math.abs(actualY - (bounds.top + bounds.height / 2)) > 1) {
    const anchorPane = anchor.closest<HTMLElement>(".fields-scroll, .conversation-scroll");
    if (anchorPane) alignTo(anchorPane, anchor, actualY);
  }
}
