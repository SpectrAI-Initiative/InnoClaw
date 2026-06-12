import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth/mode";
import { UserManagementClient } from "./user-management-client";

export default function UserManagementPage() {
  if (isAuthDisabled()) {
    redirect("/");
  }

  return <UserManagementClient />;
}
