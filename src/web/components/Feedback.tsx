/* Loading and error feedback, the same everywhere.
 *
 * A skeleton holds the shape of what is coming so the page does not jump when
 * it arrives. A toast is for a failure the person did not cause and cannot fix
 * in place, such as a list that would not load; failures inside an editor are
 * shown next to the text instead. Both respect reduced motion by not moving. */

export function Skeleton({
	lines = 3,
	className = "",
}: {
	lines?: number;
	className?: string;
}) {
	return (
		<div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
			{Array.from({ length: lines }, (_, index) => (
				<div
					key={index}
					className="h-4 rounded-card bg-surface-hover"
					style={{ width: `${index % 3 === 2 ? 55 : index % 3 === 1 ? 80 : 95}%` }}
				/>
			))}
		</div>
	);
}

/** A grid of tile-shaped placeholders for Home. */
export function TileSkeleton({ count = 3 }: { count?: number }) {
	return (
		<div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{Array.from({ length: count }, (_, index) => (
				<div key={index} className="aspect-4/3 rounded-card bg-surface-hover" />
			))}
		</div>
	);
}

/** Row-shaped placeholders for a project's list. */
export function RowSkeleton({ count = 4 }: { count?: number }) {
	return (
		<div aria-hidden="true" className="flex flex-col gap-2">
			{Array.from({ length: count }, (_, index) => (
				<div key={index} className="rounded-card border border-border bg-surface px-4 py-3">
					<Skeleton lines={index % 2 === 0 ? 2 : 1} />
				</div>
			))}
		</div>
	);
}

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
