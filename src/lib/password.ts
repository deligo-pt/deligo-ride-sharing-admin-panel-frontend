/** Password policy — shared by the reset form's live checklist and the "server" (services/auth.ts). */
export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRule = "length" | "cases" | "number" | "symbol";

export function passwordRules(password: string): Record<PasswordRule, boolean> {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    cases: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export const meetsPasswordRules = (password: string) =>
  Object.values(passwordRules(password)).every(Boolean);
