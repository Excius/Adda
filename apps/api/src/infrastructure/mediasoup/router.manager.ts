import type { Router } from "mediasoup/types";
import { WorkerManager } from "./worker.manager.js";
import { mediaCodecs } from "./mediasoup.config.js";

export class RouterManager {
  private readonly routers = new Map<string, Router>();
  private readonly creationPromises = new Map<string, Promise<Router>>();

  constructor(private readonly workerManager: WorkerManager) {}

  async create(roomId: string): Promise<Router> {
    const existing = this.routers.get(roomId);
    if (existing) {
      return existing;
    }

    const pending = this.creationPromises.get(roomId);
    if (pending) {
      return pending;
    }

    const creation = this.createRouter();

    this.creationPromises.set(roomId, creation);

    try {
      const router = await creation;

      this.routers.set(roomId, router);

      return router;
    } finally {
      this.creationPromises.delete(roomId);
    }
  }

  get(roomId: string): Router {
    const router = this.routers.get(roomId);
    if (!router) {
      throw new Error(`Router not found for room ${roomId}`);
    }

    return router;
  }

  exists(roomId: string): boolean {
    return this.routers.has(roomId);
  }

  close(roomId: string): void {
    const router = this.routers.get(roomId);

    if (!router) {
      return;
    }

    router.close();
    this.routers.delete(roomId);
  }

  private async createRouter(): Promise<Router> {
    const worker = this.workerManager.getWorker();

    return await worker.createRouter({ mediaCodecs });
  }
}
