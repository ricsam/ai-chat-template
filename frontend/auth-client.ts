import { createAuthClient } from "better-auth/react";
import { credentialsClient } from "./credentials-client";
import env from "@/env";

export const authClient = createAuthClient({
  baseURL: env.API_BASE_URL + "/auth",
  plugins: [credentialsClient()],
});

export const { signOut, useSession } = authClient;

// Sign in or sign up with just a username
export async function signInWithUsername(username: string) {
  return authClient.signIn.credentials({ username });
}
