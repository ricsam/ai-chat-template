import { routeTree } from "@/route-tree";
import env from "@/env";
import { createBrowserHistory, createRouter } from "@richie-router/react";

const baseUrl = new URL(env.BASE_URL);

export const history = createBrowserHistory();

export const router = createRouter({
  routeTree,
  history,
  basePath: baseUrl.pathname,
});

declare module "@richie-router/react" {
  interface Register {
    router: typeof router;
  }
}
