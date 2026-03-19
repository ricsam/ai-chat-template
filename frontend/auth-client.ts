import { createAuthClient } from "better-auth/react";
import { useEffect, useState } from "react";
import { credentialsClient } from "./credentials-client";
import env from "@/env";

// Auth client - uses relative path for API calls
export const authClient = createAuthClient({
  baseURL: env.BASE_URL + "/api/auth",
  plugins: [credentialsClient()],
});

export const { signOut, useSession } = authClient;

export type AuthStatus = "initializing" | "authenticated" | "anonymous";

export function useAuthSession() {
  const sessionQuery = useSession();
  const [hasResolvedOnce, setHasResolvedOnce] = useState(() => !sessionQuery.isPending);

  useEffect(() => {
    if (!sessionQuery.isPending) {
      setHasResolvedOnce(true);
    }
  }, [sessionQuery.isPending]);

  const status: AuthStatus = !hasResolvedOnce
    ? "initializing"
    : sessionQuery.data
      ? "authenticated"
      : "anonymous";

  return {
    ...sessionQuery,
    session: sessionQuery.data,
    hasResolvedOnce,
    status,
    isInitialLoad: status === "initializing",
    isAuthenticated: status === "authenticated",
    isAnonymous: status === "anonymous",
  };
}

// Sign in or sign up with just a username
export async function signInWithUsername(username: string) {
  return authClient.signIn.credentials({ username });
}
