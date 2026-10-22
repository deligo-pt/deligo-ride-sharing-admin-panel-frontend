/** Sidebar collapsed state lives in a cookie so the server renders it right (no flash). */
export const SIDEBAR_COOKIE = "deligo-sidebar";

export function writeSidebarCookie(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
}
