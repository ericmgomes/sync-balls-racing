/** Number keys mirror the release buttons; pointer input is handled by those buttons. */
export class InputManager {
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.defaultPrevented || event.isComposing) return;

    const target = event.target;
    if (target instanceof Element) {
      if (target.closest('input, textarea, select, [role="textbox"]')) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
    }

    if (!/^[1-9]$/.test(event.key)) return;
    const trackId = Number(event.key) - 1;
    if (trackId >= this.trackCount) return;

    event.preventDefault();
    this.onRelease(trackId);
  };

  constructor(
    private readonly onRelease: (trackId: number) => void,
    private readonly trackCount = 6,
  ) {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
