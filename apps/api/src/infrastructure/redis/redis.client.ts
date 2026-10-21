import { Redis } from "ioredis";
import { env } from "../../config/config.js";
import { logger } from "../logger/logger.js";

class RedisClient {
  private static instance: RedisClient;
  private readonly client: Redis;

  private constructor() {
    this.client = new Redis(env.REDIS_URL, {
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.warn(
          `Redis connection lost. Attempting to reconnect in ${delay}ms...`,
        );
        return delay;
      },
      //why null : related to mediasoup
      maxRetriesPerRequest: null,
    });

    this.registerEvents();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }

    return RedisClient.instance;
  }

  private registerEvents() {
    this.client.on("connect", () => {
      logger.info("Redis connected");
    });

    this.client.on("ready", () => {
      logger.info("Redis ready");
    });

    this.client.on("close", () => {
      logger.info("Redis closed");
    });

    this.client.on("reconnecting", () => {
      logger.info("Redis reconnecting...");
    });

    this.client.on("error", (err) => {
      logger.warn({ err }, "Redis error: ");
    });
  }

  async connect() {
    if (this.client.status === "wait") {
      await this.client.connect();
    }
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async disconnect() {
    await this.client.quit();
  }

  getClient() {
    return this.client;
  }
}

export const redis = RedisClient.getInstance();
