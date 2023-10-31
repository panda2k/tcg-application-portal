import { recruitmentCycleRouter } from "~/server/api/routers/recruitment-cycle";
import { createTRPCRouter } from "~/server/api/trpc";
import { applicationQuestionRouter } from "./routers/application-question";
import { applicationRouter } from "./routers/application";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
    recruitmentCycle: recruitmentCycleRouter,
    applicationQuestion: applicationQuestionRouter,
    application: applicationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
