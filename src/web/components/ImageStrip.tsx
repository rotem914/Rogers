/* The pictures in a note: thumbnails, a remove button on each, and the
 * lightbox that opens when one is clicked.
 *
 * Read-only in a row (no remove, no lightbox), editable in the composer and
 * on the note page. */

import { useEffect, useState } from "react";
import { imageSrc } from "../lib/upload";

export function ImageStrip({
	keys,
	onRemove,
	size = "md",
}: {
	keys: string[];
	/** Present when the pictures can be removed and opened. */
	onRemove?: (key: string) => void;
	size?: "sm" | "md" | "lg";
}) {
	const [open, setOpen] = useState<string | null>(null);
	if (keys.length === 0) return null;

	/* lg is the note page: the picture at its own aspect, as wide as the column
	   allows and never past 1160px. */
	const box =
		size === "sm" ? "size-[216px]" : size === "lg" ? "w-full max-w-[1160px]" : "size-24";
	const fill = size === "lg" ? "block w-full" : "size-full object-cover";

	return (
		<>
			<ul className={`flex flex-wrap ${size === "sm" ? "gap-4" : size === "lg" ? "gap-6" : "gap-2"}`}>
				{keys.map((key) => (
					<li
						key={key}
						className={`group/thumb relative ${size === "lg" ? "w-full" : ""}`}
					>
						{onRemove === undefined ? (
							<img
								src={imageSrc(key)}
								alt=""
								loading="lazy"
								className={`${box} rounded-card border border-border object-cover`}
							/>
						) : (
							<>
								<button
									type="button"
									aria-label="Open image"
									onClick={() => setOpen(key)}
									className={`${box} block overflow-hidden rounded-card border border-border`}
								>
									<img
										src={imageSrc(key)}
										alt=""
										loading="lazy"
										className={fill}
									/>
								</button>
								<button
									type="button"
									aria-label="Remove image"
									onClick={() => onRemove(key)}
									className="absolute -top-1.5 -right-1.5 hidden size-8 items-center justify-center rounded-pill border border-border bg-surface text-[24px] leading-none text-muted group-hover/thumb:flex hover:text-danger focus-visible:flex"
								>
									×
								</button>
							</>
						)}
					</li>
				))}
			</ul>

			{open !== null && <Lightbox src={imageSrc(open)} onClose={() => setOpen(null)} />}
		</>
	);
}

/** The picture at full size, over everything, until Escape or a click. */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			}
		}
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [onClose]);

	return (
		<div
			role="dialog"
			aria-label="Image"
			onClick={onClose}
			className="fixed inset-0 z-40 flex items-center justify-center bg-bg/90 p-6"
		>
			<img src={src} alt="" className="max-h-full max-w-full rounded-card object-contain" />
		</div>
	);
}
