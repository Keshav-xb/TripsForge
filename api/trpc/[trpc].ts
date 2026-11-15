import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { appRouter } from "../../server/routers";

const trpcHandler = createHTTPHandler({
  router: appRouter,
  basePath: "/api/trpc/",
  createContext: ({ req, res }) => ({ req, res } as any),
});

export default function handler(req: any, res: any) {
  return trpcHandler(req, res);
}
