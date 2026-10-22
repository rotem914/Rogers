/* The emoji a project can wear: the whole OpenMoji library, searchable.
 *
 * The pictures and their index are static files under /emoji, copied from
 * OpenMoji unchanged, with the licence beside them. The index is fetched the
 * first time a picker opens, once per page, so Home itself never pays for it;
 * each picture loads only when it scrolls into the grid. */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { emojiUrl } from "../lib/emoji";
import { apiFetch } from "../platform/api-client";

/** One emoji: its code points, its name, and the words a search matches. */
type Entry = [code: string, name: string, words: string];

/** The popup's own width: seven 36px cells and its padding. */
export const EMOJI_PICKER_WIDTH = 268;

let index: Promise<Entry[]> | null = null;

function loadIndex(): Promise<Entry[]> {
	if (index === null) {
		index = apiFetch<Entry[]>("/emoji/index.json").catch((error: unknown) => {
			/* Forget a failed load, so the next picker tries again. */
			index = null;
			throw error;
		});
	}
	return index;
}

export function EmojiPicker({
	style,
	onPick,
}: {
	style: CSSProperties | undefined;
	/** A code, or null for no emoji at all. */
	onPick: (code: string | null) => void;
}) {
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		let live = true;
		loadIndex().then(
			(list) => {
				if (live) setEntries(list);
			},
			() => {
				if (live) setFailed(true);
			},
		);
		return () => {
			live = false;
		};
	}, []);

	/* Every word typed has to appear in the name or the search words. */
	const shown = useMemo(() => {
		if (entries === null) return [];
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return entries;
		return entries.filter(([, name, keys]) => {
			const haystack = `${name.toLowerCase()} ${keys}`;
			return words.every((word) => haystack.includes(word));
		});
	}, [entries, query]);

	return (
		<div
			role="dialog"
			aria-label="Project emoji"
			style={style}
			className="absolute z-20 w-[268px] rounded-card border border-border bg-surface p-2 shadow-raised"
		>
			<input
				autoFocus
				type="search"
				value={query}
				dir="auto"
				placeholder="Search emoji"
				aria-label="Search emoji"
				onChange={(event) => setQuery(event.target.value)}
				className="mb-2 w-full rounded-[8px] bg-card px-3 py-2 text-sm text-text outline-none placeholder:text-muted"
			/>
			<div className="grid h-[252px] grid-cols-7 content-start overflow-y-auto">
				{entries !== null && query.trim() === "" && (
					<button
						type="button"
						aria-label="No emoji"
						title="No emoji"
						onClick={() => onPick(null)}
						className="flex aspect-square items-center justify-center rounded-[8px] hover:bg-surface-hover"
					>
						<span className="size-5 rounded-pill border border-border" />
					</button>
				)}
				{shown.map(([code, name]) => (
					<button
						key={code}
						type="button"
						aria-label={name}
						title={name}
						onClick={() => onPick(code)}
						className="flex aspect-square items-center justify-center rounded-[8px] hover:bg-surface-hover"
					>
						<img
							src={emojiUrl(code)}
							alt=""
							width={32}
							height={32}
							loading="lazy"
							draggable={false}
						/>
					</button>
				))}
				{failed && (
					<p className="col-span-7 px-1 py-2 text-sm text-muted">Could not load the emoji.</p>
				)}
				{entries !== null && shown.length === 0 && (
					<p className="col-span-7 px-1 py-2 text-sm text-muted">No emoji match.</p>
				)}
			</div>
		</div>
	);
}
