/* A textarea that is as tall as its text.
 *
 * A note has no fixed length, so the field grows with it instead of scrolling
 * inside a box. Mixed Hebrew and English is the normal case here, so each
 * paragraph takes its own direction: `dir="auto"` picks a direction for the
 * field as a whole, and the `bidi` class (`unicode-bidi: plaintext`) is what
 * makes each paragraph decide for itself. */

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	type Ref,
	type TextareaHTMLAttributes,
} from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
	value: string;
	/** The caller's ref, kept alongside the one the auto-grow needs. */
	ref?: Ref<HTMLTextAreaElement>;
};

export function AutoGrowTextarea({ value, className = "", ref, ...rest }: Props) {
	const own = useRef<HTMLTextAreaElement | null>(null);

	const attach = useCallback(
		(el: HTMLTextAreaElement | null) => {
			own.current = el;
			if (typeof ref === "function") ref(el);
			else if (ref) ref.current = el;
		},
		[ref],
	);

	const fit = useCallback(() => {
		const el = own.current;
		if (el === null) return;
		el.style.height = "0px";
		el.style.height = `${el.scrollHeight}px`;
	}, []);

	useLayoutEffect(fit, [fit, value]);

	/* The webfont arrives after the first paint, and its lines are sometimes
	   taller than the fallback's, so a height measured before it lands leaves
	   the last line of a note hidden behind `overflow-hidden`. Measure once more
	   when the font is in. Runs on mount only; by the time anything is typed the
	   font is long since loaded. */
	useEffect(() => {
		let live = true;
		void document.fonts.ready.then(() => {
			if (live) fit();
		});
		return () => {
			live = false;
		};
	}, [fit]);

	return (
		<textarea
			ref={attach}
			value={value}
			dir="auto"
			rows={1}
			className={`bidi block w-full resize-none overflow-hidden bg-transparent leading-relaxed text-text outline-none placeholder:text-faint ${className}`}
			{...rest}
		/>
	);
}
