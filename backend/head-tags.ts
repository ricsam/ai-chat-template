import { defineHeadTags } from "@richie-router/server";
import { routeManifest } from "@/route-manifest";
import { routerSchema } from "@/shared/router-schema.ts";

export const headTags = defineHeadTags(routeManifest, routerSchema, {
  __root__: {
    staleTime: 60_000,
    head: () => ([
      { tag: "title", children: "AI Chat" },
      { tag: "meta", name: "description", content: "Chat with AI models" },
    ]),
  },
});
