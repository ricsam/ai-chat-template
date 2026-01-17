import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useSession } from "../auth-client";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isPending } = useSession();

  // Show loading while checking auth
  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Outlet />
    </div>
  );
}
