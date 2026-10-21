import { ChainableCommander, Redis } from "ioredis";
import { Consumer } from "./consumer.types.js";
import { keys } from "../../infrastructure/redis/redis.keys.js";

// ConsumerRepository
// ├── consumer:{consumerId}
// ├── peer:{peerId}:consumers
// └── producer:{producerId}:consumers

export class ConsumerRepository {
  constructor(private readonly redis: Redis) {}

  async findById(consumerId: string): Promise<Consumer | null> {
    const data = await this.redis.hgetall(keys.consumer(consumerId));

    if (Object.keys(data).length === 0) return null;

    return {
      id: consumerId,
      peerId: data.peerId,
      roomId: data.roomId,
      producerId: data.producerId,
      kind: data.kind,
    } as Consumer;
  }

  async findIdsByPeer(peerId: string): Promise<string[]> {
    return await this.redis.smembers(keys.peerConsumers(peerId));
  }

  async findIdsByProducer(producerId: string): Promise<string[]> {
    return await this.redis.smembers(keys.producerConsumers(producerId));
  }

  async exists(consumerId: string): Promise<boolean> {
    const exists = await this.redis.exists(keys.consumer(consumerId));

    return exists === 1;
  }

  create(tx: ChainableCommander, consumer: Consumer): void {
    tx.hset(keys.consumer(consumer.id), {
      peerId: consumer.peerId,
      roomId: consumer.roomId,
      producerId: consumer.producerId,
      kind: consumer.kind,
    });

    tx.sadd(keys.peerConsumers(consumer.peerId), consumer.id);

    tx.sadd(keys.producerConsumers(consumer.producerId), consumer.id);
  }

  remove(tx: ChainableCommander, consumerId: string): void {
    tx.del(keys.consumer(consumerId));

    tx.srem(keys.peerConsumers(consumerId), consumerId);

    tx.srem(keys.producerConsumers(consumerId), consumerId);
  }
}
