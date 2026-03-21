import { defineHeadTags } from "@richie-router/server";
import { routeManifest } from "@/route-manifest";
import { routerSchema } from "@/shared/router-schema.ts";

export const headTags = defineHeadTags(routeManifest, routerSchema, {});
