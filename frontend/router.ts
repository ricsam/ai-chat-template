import { routeTree } from "@/route-tree";
import { createRouter, createBrowserHistory } from "@tanstack/react-router";

export const history = createBrowserHistory();
const baseUrl = new URL(document.baseURI);

export const router = createRouter({
  routeTree,
  basepath: baseUrl.pathname,
  history,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
