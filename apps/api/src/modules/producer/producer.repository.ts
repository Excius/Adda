import { ChainableCommander, Redis } from "ioredis";
import { Producer } from "./producer.types.js";
import { keys } from "../../infrastructure/redis/redis.keys.js";

// ProducerRepository
// ├── producer:{producerId}
// └── peer:{peerId}:producers

export class ProducerRepository {
  constructor(private readonly redis: Redis) {}

  async findById(producerId: string): Promise<Producer | null> {
    const data = await this.redis.hgetall(keys.producer(producerId));

    if (Object.keys(data).length === 0) return null;

    return {
      id: producerId,
      peerId: data.peerId,
      roomId: data.roomId,
      kind: data.kind,
    } as Producer;
  }

  async findIdsByPeer(peerId: string): Promise<string[]> {
    return await this.redis.smembers(keys.peerProducers(peerId));
  }

  async exists(producerId: string): Promise<boolean> {
    const exists = await this.redis.exists(keys.producer(producerId));

    return exists === 1;
  }

  create(tx: ChainableCommander, producer: Producer): void {
    tx.hset(keys.producer(producer.id), {
      peerId: producer.peerId,
      roomId: producer.roomId,
      kind: producer.kind,
    });

    tx.sadd(keys.peerProducers(producer.peerId), producer.id);
  }

  remove(tx: ChainableCommander, producer: Producer): void {
    tx.del(keys.producer(producer.id));

    tx.srem(keys.peerProducers(producer.peerId), producer.id);
  }
}
