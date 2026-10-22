/** Title + one line under it, the same on every sign-in page. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1.5">
      <h1 className="text-page-title">{title}</h1>
      {subtitle && <p className="text-dense text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
