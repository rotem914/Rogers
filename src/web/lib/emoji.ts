/* Where a project's emoji picture lives. The files are OpenMoji's, served by
 * Rogers from public/emoji and named by lowercase code points. */

import { apiBaseUrl } from "../platform/platform";

export function emojiUrl(code: string): string {
	return `${apiBaseUrl}/emoji/${code}.svg`;
}
