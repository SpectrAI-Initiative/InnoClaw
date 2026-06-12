"use client";

import { FormEvent, useState } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/lib/fetcher";
import type { PublicUser } from "@/types/auth";

export function UserManagementClient() {
  const { data, mutate, isLoading } = useSWR<{ users: PublicUser[] }>(
    "/api/admin/users",
    fetcher,
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");

  async function request(path: string, init: RequestInit) {
    const res = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, name, password, role }),
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("user");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  async function updateUser(userId: string, updates: Record<string, unknown>) {
    setError("");
    try {
      await request("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, ...updates }),
      });
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function resetPassword(userId: string) {
    const nextPassword = window.prompt("New password, at least 8 characters");
    if (!nextPassword) return;
    await updateUser(userId, { password: nextPassword });
  }

  async function deleteUser(userId: string) {
    if (!window.confirm("Delete this user and transfer their data to your admin account?")) {
      return;
    }
    setError("");
    try {
      await request("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  const users = data?.users ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage local accounts, roles, status, and passwords.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create user</CardTitle>
            <CardDescription>Admins can create accounts in addition to open registration.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_140px_auto]" onSubmit={createUser}>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input id="new-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as "admin" | "user")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit">Create</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>{isLoading ? "Loading users..." : `${users.length} account(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">User</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Active</th>
                    <th className="py-2 pr-4 font-medium">Last login</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <Select value={user.role} onValueChange={(value) => updateUser(user.id, { role: value })}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={user.isActive} onCheckedChange={(checked) => updateUser(user.id, { isActive: checked })} />
                          <Badge variant={user.isActive ? "secondary" : "outline"}>
                            {user.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => resetPassword(user.id)}>
                            Reset password
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteUser(user.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
