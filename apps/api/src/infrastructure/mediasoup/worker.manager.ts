import type { Worker } from "mediasoup/types";
import mediasoup from "mediasoup";
import { logger } from "../logger/logger.js";
import { env } from "../../config/config.js";

export class WorkerManager {
  private worker?: Worker;
  private initializationPromise?: Promise<Worker>;

  async initialize(): Promise<Worker> {
    if (this.worker) return this.worker;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.createWorker();

    try {
      this.worker = await this.initializationPromise;
      return this.worker;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  getWorker(): Worker {
    if (!this.worker) {
      throw new Error("Mediasoup worker is not initialized");
    }

    return this.worker;
  }

  close(): void {
    if (!this.worker) {
      return;
    }
    this.worker.close();
    this.worker = undefined;
  }

  private async createWorker(): Promise<Worker> {
    const worker = await mediasoup.createWorker({
      logLevel: "debug",
      rtcMinPort: env.MEDIASOUP_RTC_MIN_PORT,
      rtcMaxPort: env.MEDIASOUP_RTC_MAX_PORT,
    });

    worker.on("died", () => {
      logger.error("Worker died");

      setTimeout(() => {
        process.exit(1);
      }, 3000);
    });

    return worker;
  }
}
