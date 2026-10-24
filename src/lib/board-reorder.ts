/** Where a dragged card lands relative to the card under the pointer.
 *
 *  A board that renders one column per row reads top-to-bottom, so the pointer's
 *  vertical position picks the side. A multi-column board reads across a row, so
 *  the horizontal position does — using Y there would insert a card from the
 *  right-hand column *before* a target the pointer is to the right of.
 */

export interface DropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Track count from a resolved `grid-template-columns` value. `none` (a flex
 *  container) and an empty string both count as one column. */
export function columnCount(template: string): number {
  const tracks = template
    .trim()
    .split(/\s+/)
    .filter((track) => track && track !== 'none');
  return tracks.length || 1;
}

export function insertionAfter(
  columns: number,
  pointer: { x: number; y: number },
  rect: DropRect,
): boolean {
  return columns > 1
    ? pointer.x > rect.left + rect.width / 2
    : pointer.y > rect.top + rect.height / 2;
}
