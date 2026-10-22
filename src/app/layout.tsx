// The real root layout (html, body, fonts, providers) is app/[locale]/layout.tsx
// so <html lang> follows the language. This pass-through is required because
// app/not-found.tsx lives at the root.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
