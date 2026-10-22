import { authMetadata } from "@/features/auth/metadata";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const generateMetadata = authMetadata("auth.forgot");

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
