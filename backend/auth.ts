import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "@/db";
import * as schema from "./schema";
import env from "@/env";
import { credentialsPlugin } from "./credentials-plugin";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET || "development-secret-change-in-production",
  baseURL: env.BASE_URL + "/api/auth",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
    },
  }),

  plugins: [credentialsPlugin()],
});

export type Session = typeof auth.$Infer.Session;

// Authenticate request and return user ID
export async function authenticateRequest(request: Request): Promise<{ userId: string } | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    return { userId: session.user.id };
  }
  return null;
}
