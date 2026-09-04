/* Error feedback, the same everywhere.
 *
 * A toast is for a failure the person did not cause and cannot fix in place,
 * such as a list that would not load; failures inside an editor are shown next
 * to the text instead. It respects reduced motion by not moving.
 *
 * The loading placeholders that used to live here are gone: every screen here
 * loads fast enough that they only flickered. */

export function Toast({ message }: { message: string | null }) {
	if (message === null) return null;
	return (
		<div
			role="alert"
			className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-card border border-danger bg-surface px-4 py-3 text-sm text-text shadow-raised"
		>
			{message}
		</div>
	);
}
