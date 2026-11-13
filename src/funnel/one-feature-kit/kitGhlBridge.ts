/** The kit page registers the React wizard. The HTML button asks it to open. */
let opener: (() => void) | null = null;

export function bindKitGhlOpener(next: (() => void) | null) {
  opener = next;
}

export function openKitGhlPopup() {
  opener?.();
}
