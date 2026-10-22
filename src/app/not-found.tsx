import "./globals.css";

// Only reached by URLs the proxy doesn't localise (e.g. a missing file).
export default function GlobalNotFound() {
  return (
    <html lang="pt">
      <body className="grid min-h-svh place-items-center p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-page-title">404</p>
          {/* Outside the locale layout: a full page load is intended. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/pt/dashboard"
            className="text-dense font-medium text-primary underline-offset-4 hover:underline"
          >
            DeliGo Ride Admin
          </a>
        </div>
      </body>
    </html>
  );
}
