/* Rearranging a list under the mouse.
 *
 * Two pure functions, nothing else. The project grid on Home and the note list
 * on a project page both drag rows around, and this is the part of that which
 * is the same on both, kept in one place so the two screens cannot drift into
 * two different ideas of what a drag does.
 *
 * The drag handlers themselves stay on their own screens, because a grid of
 * tiles and a column split into two sections are not the same shape. */

/**
 * `list`, arranged by an order the mouse is dragging.
 *
 * Any disagreement between the two, an item created or archived since the order
 * was taken, falls back to the list as it came from the Worker. An item is
 * never dropped from the screen to honour an order that has gone stale.
 */
export function arrange<T extends { id: string }>(
	list: T[],
	order: string[],
): T[] {
	if (order.length !== list.length) return list;

	const byId = new Map(list.map((item) => [item.id, item]));
	const arranged: T[] = [];
	for (const id of order) {
		const item = byId.get(id);
		if (item === undefined) return list;
		arranged.push(item);
	}
	return arranged;
}

/** The list with `id` moved to where `target` sits. Null when nothing moves. */
export function moved(
	ids: string[],
	id: string,
	target: string,
): string[] | null {
	const from = ids.indexOf(id);
	const to = ids.indexOf(target);
	if (from === -1 || to === -1 || from === to) return null;

	const next = [...ids];
	next.splice(from, 1);
	next.splice(to, 0, id);
	return next;
}
