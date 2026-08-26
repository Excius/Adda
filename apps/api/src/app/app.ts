import express from "express";
import { Request, Response } from "express";
import { logger } from "../infrastructure/logger/logger.js";
const app: express.Express = express();
const startTime = Date.now();

logger.info({ startTime }, "Hello there");

app.get("/health", (req: Request, res: Response) => {
  res.json({
    message: "I am alive!",
    upTime: `${(Date.now() - startTime) / (1000 * 60)} min`,
  });
});

export default app;
