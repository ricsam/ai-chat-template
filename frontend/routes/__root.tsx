import { Outlet, createRootRoute } from "@richie-router/react";
import { useAuthSession } from "../auth-client";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isInitialLoad } = useAuthSession();

  // Show loading while checking auth
  if (isInitialLoad) {
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
