import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

const inputSchema = z.object({
  username: z.string().min(1),
});

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
}

export function credentialsPlugin(): BetterAuthPlugin {
  return {
    id: "credentials",
    endpoints: {
      signInCredentials: createAuthEndpoint(
        "/sign-in/credentials",
        {
          method: "POST",
          body: inputSchema,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (ctx: any): Promise<Response> => {
          const { username } = ctx.body;

          // Get the adapter to interact with the database
          const { adapter, internalAdapter } = ctx.context;

          // Try to find existing user by username
          let user = (await adapter.findOne({
            model: "user",
            where: [{ field: "username", value: username }],
          })) as User | null;

          // If user doesn't exist, create a new one
          if (!user) {
            const userId = crypto.randomUUID();
            const now = new Date();

            user = (await adapter.create({
              model: "user",
              data: {
                id: userId,
                username: username,
                name: username,
                email: `${username}@local.chat`,
                emailVerified: false,
                createdAt: now,
                updatedAt: now,
              },
            })) as User | null;

            if (!user) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create user",
              });
            }

            // Create an account for the user (credential type)
            await adapter.create({
              model: "account",
              data: {
                id: crypto.randomUUID(),
                userId: user.id,
                accountId: user.id,
                providerId: "credentials",
                createdAt: now,
                updatedAt: now,
              },
            });
          }

          // Create session using internal adapter
          const session = await internalAdapter.createSession(user.id, ctx.request);

          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create session",
            });
          }

          // Set session cookie
          await setSessionCookie(ctx, { session, user });

          return ctx.json({
            user,
            session,
          });
        }
      ),
    },
    schema: {
      user: {
        fields: {
          username: {
            type: "string",
            required: true,
            unique: true,
          },
        },
      },
    },
  };
}

export type CredentialsPlugin = ReturnType<typeof credentialsPlugin>;
