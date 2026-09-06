/* The bar every screen sits under.
 *
 * Each screen renders its own, because what belongs in it differs: Home shows
 * the app name, a project or a note shows a way back. Keeping it per screen
 * means a back arrow never has to be threaded through a shared layout. */

import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";

type TopBarProps = {
	/** Where the back arrow goes. Omit it on Home, which is the root. */
	backTo?: string;
	/**
	 * Run instead of navigating, for a screen that has to save first. It gets
	 * to navigate itself when it is done. Middle click and modifier clicks are
	 * left to the browser, so opening in a new tab still works.
	 */
	onBack?: () => void;
	/** The title text; a screen with nothing to say leaves it out. */
	title: ReactNode;
	/** Anything that sits at the right edge, such as a saved indicator. */
	trailing?: ReactNode;
	/**
	 * Anything that starts where the page's own column starts, in the title's
	 * row: the project page puts its tabs here. Leave it out and the bar is the
	 * single row it has always been.
	 */
	center?: ReactNode;
};

export function TopBar({ backTo, onBack, title, trailing, center }: TopBarProps) {
	function handleBack(event: MouseEvent<HTMLAnchorElement>) {
		if (onBack === undefined) return;
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
		event.preventDefault();
		onBack();
	}

	const back = backTo !== undefined && (
		<Link
			to={backTo}
			onClick={handleBack}
			aria-label="Back"
			className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-[144ms] ease-out hover:bg-surface-hover hover:text-text"
		>
			<svg
				viewBox="0 0 24 24"
				aria-hidden="true"
				className="size-8"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M15 18 9 12l6-6" />
			</svg>
		</Link>
	);

	const heading = (
		<span className="min-w-0 flex-1 truncate text-[32px] font-medium tracking-tight">
			{title}
		</span>
	);

	if (center === undefined) {
		return (
			<header className="sticky top-0 z-10 flex min-h-topbar items-center pt-8">
				<div className="mx-auto flex w-full max-w-[1324px] items-center gap-3 px-[72px] max-[900px]:px-[18px]">
					{back}
					{heading}
					{trailing}
				</div>
			</header>
		);
	}

	/* The middle column IS the page column: 752px wide with the same 16px
	   inside it, centred on the same centre the page's own column uses, so its
	   left edge and the cards' left edge are one edge at every width.

	   The 72px of breathing room sits on the outer columns rather than on the
	   container, and that is the whole trick: as container padding it would
	   squeeze the middle column just above the breakpoint and walk the tabs off
	   the cards' edge. The cost is that the title gets only the left gutter, so
	   it truncates earlier on a middle-sized window.

	   The container is the same 1324px the other screens use, and the title
	   sits at the same 72px inside it, so a project's name lands exactly where
	   the app's own name lands on Home. The arrow does not push it: it hangs
	   out of the flow, in the gutter, on a flex item of no width at all. Below
	   900px there is no gutter to hang in, so it rejoins the row.

	   Below 900px the columns stack, and the 18px bar padding is pulled back by
	   2px so the strip still starts on the cards' own 16px edge. */
	return (
		<header className="sticky top-0 z-10 flex min-h-topbar items-center pt-8">
			<div className="mx-auto grid w-full max-w-[1324px] grid-cols-[1fr_minmax(0,752px)_1fr] items-center max-[900px]:grid-cols-1 max-[900px]:gap-y-2 max-[900px]:px-[18px]">
				<div className="flex min-w-0 items-center pl-[72px] max-[900px]:gap-3 max-[900px]:pl-0">
					{backTo !== undefined && (
						<div className="relative w-0 shrink-0 max-[900px]:w-auto">
							<div className="absolute top-1/2 right-3 -translate-y-1/2 max-[900px]:static max-[900px]:translate-y-0">
								{back}
							</div>
						</div>
					)}
					{heading}
				</div>
				<div className="min-w-0 px-4 max-[900px]:-ml-[2px] max-[900px]:px-0">{center}</div>
				<div className="justify-self-end pr-[72px] max-[900px]:pr-0">{trailing}</div>
			</div>
		</header>
	);
}
