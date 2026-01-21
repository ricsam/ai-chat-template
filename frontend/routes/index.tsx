import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { signInWithUsername, useSession } from "../auth-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import env from "@/env";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { data: session } = useSession();

  // Redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      navigate({ to: "/chat" });
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithUsername(username.trim());
      if (result.error) {
        setError(result.error.message || "Failed to sign in");
      } else {
        window.location.href = env.BASE_URL + "/chat";
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">AI Chat</CardTitle>
          <CardDescription>Enter your username to get started</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={isLoading}
              autoFocus
              className="h-12"
            />
            {error && (
              <div className="text-destructive text-sm text-center">{error}</div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              disabled={isLoading || !username.trim()}
              className="w-full h-12"
            >
              {isLoading ? "Signing in..." : "Continue"}
            </Button>
            <p className="text-muted-foreground text-sm text-center">
              New username? We'll create an account for you.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
