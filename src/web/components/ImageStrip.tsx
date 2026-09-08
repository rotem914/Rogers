/* The pictures in a note: thumbnails, a remove button on each, and the
 * lightbox that opens when one is clicked.
 *
 * A picture opens the lightbox everywhere, a row included; only the composer
 * and the note page can also remove one. */

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

	/* lg is the note page: the picture at its own pixel size, pinned top left,
	   shrunk only when it is wider than the column or past 1160px; the only
	   size that shows the original bytes, the two small sizes ask for the list
	   copy. */
	const box =
		size === "sm" ? "size-[216px]" : size === "lg" ? "w-fit max-w-[1160px]" : "size-24";
	const fill = size === "lg" ? "block h-auto max-w-full" : "size-full object-cover";

	return (
		<>
			<ul className={`flex flex-wrap ${size === "sm" ? "gap-4" : size === "lg" ? "flex-col items-start gap-6" : "gap-2"}`}>
				{keys.map((key) => (
					<li
						key={key}
						className={`group/thumb relative ${size === "lg" ? "w-fit max-w-full" : ""}`}
					>
						{onRemove === undefined ? (
							/* In a note row the whole card is covered by a link to the
							   note, so the picture has to sit above it and take its own
							   clicks back: z-10 over the link, and pointer-events-auto
							   because the row switches them off for everything under it. */
							<button
								type="button"
								aria-label="Open image"
								onClick={() => setOpen(key)}
								className={`${box} relative z-10 block overflow-hidden rounded-card border border-border pointer-events-auto`}
							>
								<img
									src={imageSrc(key, "sm")}
									alt=""
									loading="lazy"
									className="size-full object-cover"
								/>
							</button>
						) : (
							<>
								<button
									type="button"
									aria-label="Open image"
									onClick={() => setOpen(key)}
									className={`${box} block overflow-hidden rounded-card border border-border`}
								>
									<img
										src={imageSrc(key, size === "lg" ? "full" : "sm")}
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
			className="fixed inset-0 z-40 flex items-center justify-center bg-bg/90 p-14"
		>
			{/* Not draggable: a picture drags itself by default, so pressing on it and
			    moving a hair starts a drag and the click that closes this never fires. */}
			<img
				src={src}
				alt=""
				draggable={false}
				className="max-h-full max-w-full rounded-card object-contain"
			/>
		</div>
	);
}
