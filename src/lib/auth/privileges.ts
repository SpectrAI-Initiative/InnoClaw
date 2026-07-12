import { isAuthDisabled } from "./mode";
import { isSingleAdminMode } from "./policy";
import type { AuthContext } from "./server";

export function canUseHighRiskExecution(auth: AuthContext): boolean {
  return (
    isAuthDisabled() ||
    !isSingleAdminMode() ||
    auth.user.role === "admin"
  );
}
