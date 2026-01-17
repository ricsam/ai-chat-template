import type { BetterAuthClientPlugin } from "better-auth/client";

interface FetchOptions {
  method?: string;
  body?: unknown;
  [key: string]: unknown;
}

type BetterAuthFetch = (url: string, options?: FetchOptions) => Promise<unknown>;

export function credentialsClient() {
  return {
    id: "credentials",
    getActions: ($fetch: BetterAuthFetch) => {
      return {
        signIn: {
          credentials: async (
            data: { username: string },
            fetchOptions?: FetchOptions
          ) => {
            return $fetch("/sign-in/credentials", {
              method: "POST",
              body: data,
              ...fetchOptions,
            });
          },
        },
      };
    },
  } satisfies BetterAuthClientPlugin;
}
