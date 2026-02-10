import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { userTable, accountTable } from "./schema";

const inputSchema = z.object({
  username: z.string().min(1),
});

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
        async (ctx) => {
          const { username } = ctx.body;
          const { internalAdapter } = ctx.context;

          // Try to find existing user by username
          let user = await db
            .select()
            .from(userTable)
            .where(eq(userTable.username, username))
            .then((rows) => rows[0] ?? null);

          // If user doesn't exist, create user + account in a transaction
          if (!user) {
            const userId = crypto.randomUUID();
            const now = new Date();

            user = await db.transaction(async (tx) => {
              const [newUser] = await tx
                .insert(userTable)
                .values({
                  id: userId,
                  username: username,
                  name: username,
                  email: `${username}@local.chat`,
                  emailVerified: false,
                  createdAt: now,
                  updatedAt: now,
                })
                .returning();

              if (!newUser) {
                throw new APIError("INTERNAL_SERVER_ERROR", {
                  message: "Failed to create user",
                });
              }

              await tx.insert(accountTable).values({
                id: crypto.randomUUID(),
                userId: newUser.id,
                accountId: newUser.id,
                providerId: "credentials",
                createdAt: now,
                updatedAt: now,
              });

              return newUser;
            });
          }

          // Create session using internal adapter
          const session = await internalAdapter.createSession(user.id);

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
        },
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
