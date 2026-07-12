import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth/mode";
import { getAuthContext } from "@/lib/auth/server";
import { UserManagementClient } from "./user-management-client";

export default async function UserManagementPage() {
  if (isAuthDisabled()) {
    redirect("/");
  }

  const auth = await getAuthContext();
  if (!auth || auth.user.role !== "admin") {
    redirect("/");
  }

  return <UserManagementClient />;
}
