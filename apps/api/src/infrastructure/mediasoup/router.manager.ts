import type { Router } from "mediasoup/types";
import { WorkerManager } from "./worker.manager.js";
import { mediaCodecs } from "./mediasoup.config.js";

export class RouterManager {
  private readonly routers = new Map<string, Router>(); // roomId -> Router
  private readonly creationPromises = new Map<string, Promise<Router>>(); // roomId -> Router Promise

  constructor(private readonly workerManager: WorkerManager) {}

  async create(roomId: string): Promise<Router> {
    // Check the existing router for the room
    const existing = this.routers.get(roomId);
    if (existing) {
      return existing;
    }

    // If already in the creation pipeline
    const pending = this.creationPromises.get(roomId);
    if (pending) {
      return pending;
    }

    // router creation
    const creation = this.createRouter();

    this.creationPromises.set(roomId, creation);

    try {
      const router = await creation;

      this.routers.set(roomId, router);

      router.on("workerclose", () => {
        this.routers.delete(roomId);
      });

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
