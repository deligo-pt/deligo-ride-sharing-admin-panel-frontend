import { authMetadata } from "@/features/auth/metadata";
import { LoginFlow, type LoginNotice } from "@/features/auth/login-flow";
import { safeNextPath } from "@/lib/session";

export const generateMetadata = authMetadata("auth.login");

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const query = await searchParams;
  const notice: LoginNotice | null =
    first(query.reason) === "expired" ? "expired" : first(query.reset) === "done" ? "reset" : null;
  return <LoginFlow next={safeNextPath(first(query.next))} notice={notice} />;
}
