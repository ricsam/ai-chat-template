import { defineRouterSchema } from "@richie-router/core";

export const routerSchema = defineRouterSchema({
  __root__: {
    serverHead: true,
  },
});

export type RouterSchema = typeof routerSchema;
