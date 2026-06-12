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

export type AuthMode = "local" | "disabled";

export interface AuthMeResponse {
  user: PublicUser;
  session: {
    expiresAt: string;
  };
  authMode: AuthMode;
  isAuthDisabled: boolean;
}
