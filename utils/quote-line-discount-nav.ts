import type { KeyboardEvent } from "react";

/** Enter u rabatu → fokus na rabat sledeće/prethodne stavke u ponudi. */
export function focusAdjacentDiscountInput(
  root: HTMLElement | null,
  productIds: number[],
  currentId: number,
  direction: 1 | -1 = 1,
): boolean {
  if (!root || productIds.length === 0) return false;

  const idx = productIds.indexOf(currentId);
  if (idx < 0) return false;

  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= productIds.length) return false;

  const nextId = productIds[nextIdx];
  const el = root.querySelector<HTMLInputElement>(
    `[data-quote-discount-input="${nextId}"]`,
  );
  if (!el) return false;

  el.focus();
  el.select();
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

export function handleDiscountInputKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  root: HTMLElement | null,
  productIds: number[],
  currentId: number,
  onCommit?: () => void,
): void {
  if (e.key !== "Enter") return;

  e.preventDefault();
  onCommit?.();
  const direction: 1 | -1 = e.shiftKey ? -1 : 1;
  focusAdjacentDiscountInput(root, productIds, currentId, direction);
}
