/* The bar every screen sits under.
 *
 * Each screen renders its own, because what belongs in it differs: Home shows
 * the app name, a project or a note shows a way back. Keeping it per screen
 * means a back arrow never has to be threaded through a shared layout. */

import type { ReactNode } from "react";
import { Link } from "react-router";

type TopBarProps = {
	/** Where the back arrow goes. Omit it on Home, which is the root. */
	backTo?: string;
	/** The title text; a screen with nothing to say leaves it out. */
	title: ReactNode;
	/** Anything that sits at the right edge, such as a saved indicator. */
	trailing?: ReactNode;
};

export function TopBar({ backTo, title, trailing }: TopBarProps) {
	return (
		<header className="sticky top-0 z-10 flex h-topbar items-center gap-3 border-b border-border bg-surface px-4">
			{backTo !== undefined && (
				<Link
					to={backTo}
					aria-label="Back"
					className="-ml-2 rounded-card px-2 py-1 text-muted hover:bg-surface-hover hover:text-text"
				>
					‹
				</Link>
			)}

			<span className="min-w-0 flex-1 truncate text-lg font-medium tracking-tight">
				{title}
			</span>

			{trailing}
		</header>
	);
}
