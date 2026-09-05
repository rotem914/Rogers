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
};

export function TopBar({ backTo, onBack, title, trailing }: TopBarProps) {
	function handleBack(event: MouseEvent<HTMLAnchorElement>) {
		if (onBack === undefined) return;
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
		event.preventDefault();
		onBack();
	}

	return (
		<header className="sticky top-0 z-10 flex min-h-topbar items-center pt-8">
			<div className="mx-auto flex w-full max-w-[1324px] items-center gap-3 px-[72px] max-[900px]:px-[18px]">
				{backTo !== undefined && (
					<Link
						to={backTo}
						onClick={handleBack}
						aria-label="Back"
						className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-card text-muted hover:bg-surface-hover hover:text-text"
					>
						<svg
							viewBox="0 0 24 24"
							aria-hidden="true"
							className="size-6"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M15 18 9 12l6-6" />
						</svg>
					</Link>
				)}

				<span className="min-w-0 flex-1 truncate text-[32px] font-medium tracking-tight">
					{title}
				</span>

				{trailing}
			</div>
		</header>
	);
}
