import { authMetadata } from "@/features/auth/metadata";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const generateMetadata = authMetadata("auth.reset");

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const token = (await searchParams).token;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
