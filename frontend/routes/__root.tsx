import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useSession } from "../auth-client";
import { useEffect } from "react";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isPending } = useSession();

  // Add dark class to body for dark mode
  useEffect(() => {
    document.body.classList.add("dark");
  }, []);

  // Show loading while checking auth
  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
