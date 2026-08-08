/**
 * True only in an internal build (`VITE_INTERNAL=true pnpm build`), which is
 * deployed behind auth. The public build tree-shakes internal UI away and
 * the CI grep proves the bundle carries no cost/GP strings.
 */
export const IS_INTERNAL_BUILD = import.meta.env.VITE_INTERNAL === "true";
