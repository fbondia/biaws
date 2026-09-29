import type { NextFunction, Request, RequestHandler, Response, Router } from "express";
import { z, ZodError } from "zod";
import {
  operationBodySchema,
  operationResponseSchema,
  routeQuerySchema,
  type ContractDomain,
} from "./domainSchemas.js";

interface HandlerLayer {
  handle: RequestHandler;
}

interface ExpressRoute {
  path: string;
  methods: Record<string, boolean>;
  stack: HandlerLayer[];
}

interface RouterLayer {
  route?: ExpressRoute;
}

export interface ContractRouter {
  domain: ContractDomain;
  prefix: string;
  router: Router;
}

export interface RouteContract {
  domain: ContractDomain;
  method: string;
  routePath: string;
  path: string;
  params: z.ZodType;
  query: z.ZodType;
  body: z.ZodType;
  response: z.ZodType;
}

function routeLayers(router: Router): RouterLayer[] {
  return (router as Router & { stack: RouterLayer[] }).stack;
}

function paramsSchema(routePath: string) {
  const shape: Record<string, z.ZodString> = {};
  for (const match of routePath.matchAll(/:([A-Za-z]\w*)/gu)) {
    shape[match[1]] = z.string().min(1);
  }
  return z.looseObject(shape);
}

function absolutePath(prefix: string, routePath: string) {
  return routePath === "/" ? prefix : `${prefix}${routePath}`;
}

export function collectRouteContracts(routers: readonly ContractRouter[]) {
  return routers.flatMap(({ domain, prefix, router }) =>
    routeLayers(router).flatMap(({ route }) => {
      if (!route) return [];
      return Object.entries(route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]): RouteContract => ({
          domain,
          method,
          routePath: route.path,
          path: absolutePath(prefix, route.path),
          params: paramsSchema(route.path),
          query: routeQuerySchema,
          body: operationBodySchema(domain, method, route.path),
          response: operationResponseSchema(domain, method, route.path),
        }));
    }),
  );
}

export function zodRequestError(error: ZodError, section: "params" | "query" | "body") {
  const first = error.issues[0];
  return Object.assign(new Error(first?.message || "Invalid request"), {
    statusCode: section === "query" ? 400 : 422,
    code: "BAD_REQUEST",
    fields: error.issues.map((issue) => ({
      path: [section, ...issue.path.map(String)].join("."),
      code: issue.code,
      message: issue.message,
    })),
  });
}

function validateRequest(contract: RouteContract, req: Request) {
  for (const section of ["params", "query", "body"] as const) {
    const result = contract[section].safeParse(req[section]);
    if (!result.success) return zodRequestError(result.error, section);
    if (section === "body") req.body = result.data;
  }
  return null;
}

const installedRouters = new WeakSet<Router>();

export function installRouteContracts(routers: readonly ContractRouter[]) {
  for (const { domain, prefix, router } of routers) {
    if (installedRouters.has(router)) continue;
    for (const { route } of routeLayers(router)) {
      if (!route) continue;
      const last = route.stack.at(-1);
      if (!last) continue;
      const method = Object.keys(route.methods).find((key) => route.methods[key]);
      if (!method) continue;
      const contract: RouteContract = {
        domain,
        method,
        routePath: route.path,
        path: absolutePath(prefix, route.path),
        params: paramsSchema(route.path),
        query: routeQuerySchema,
        body: operationBodySchema(domain, method, route.path),
        response: operationResponseSchema(domain, method, route.path),
      };
      const original = last.handle;
      last.handle = (req: Request, res: Response, next: NextFunction) => {
        const error = validateRequest(contract, req);
        if (error) return next(error);
        return original(req, res, next);
      };
    }
    installedRouters.add(router);
  }
}
