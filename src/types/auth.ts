export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
