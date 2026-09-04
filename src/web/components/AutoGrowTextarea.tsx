/* A textarea that is as tall as its text.
 *
 * A note has no fixed length, so the field grows with it instead of scrolling
 * inside a box. Mixed Hebrew and English is the normal case here, so each
 * paragraph takes its own direction: `dir="auto"` picks a direction for the
 * field as a whole, and the `bidi` class (`unicode-bidi: plaintext`) is what
 * makes each paragraph decide for itself. */

import {
	useCallback,
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

	useLayoutEffect(() => {
		const el = own.current;
		if (el === null) return;
		el.style.height = "0px";
		el.style.height = `${el.scrollHeight}px`;
	}, [value]);

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
