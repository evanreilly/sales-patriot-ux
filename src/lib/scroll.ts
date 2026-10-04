// Center the selected evidence in its pane; the guide anchors beneath it.
export function centerInPane(pane: HTMLElement, target: HTMLElement) {
  const visibleHeight = pane.clientHeight;
  pane.scrollTo({
    top:
      pane.scrollTop +
      target.getBoundingClientRect().top -
      pane.getBoundingClientRect().top +
      target.offsetHeight / 2 -
      visibleHeight / 2,
    behavior: "instant",
  });
}
