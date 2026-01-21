import { createAuthClient } from "better-auth/react";
import { credentialsClient } from "./credentials-client";
import env from "@/env";

// Auth client - uses relative path for API calls
export const authClient = createAuthClient({
  baseURL: env.BASE_URL + "/api/auth",
  plugins: [credentialsClient()],
});

export const { signOut, useSession } = authClient;

// Sign in or sign up with just a username
export async function signInWithUsername(username: string) {
  return authClient.signIn.credentials({ username });
}
