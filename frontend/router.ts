import { routeTree } from "@/route-tree";
import env from "@/env";
import { createBrowserHistory, createRouter } from "@richie-router/react";

const baseUrl = new URL(env.BASE_URL);
const basePath = baseUrl.pathname === "/" ? "" : baseUrl.pathname.replace(/\/$/, "");

export const history = createBrowserHistory();

export const router = createRouter({
  routeTree,
  history,
  basePath,
});

declare module "@richie-router/react" {
  interface Register {
    router: typeof router;
  }
}
