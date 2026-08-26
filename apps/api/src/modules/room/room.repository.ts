import { ChainableCommander, Redis } from "ioredis";
import { Room } from "./room.types.js";
import { keys } from "../../infrastructure/redis/redis.keys.js";

// RoomRepository
// ├── room:{roomId}
// ├── room:{roomId}:peers
// └── room:{roomId}:producers

export class RoomRepository {
  constructor(private readonly redis: Redis) {}

  async findById(roomId: string): Promise<Room | null> {
    const data = await this.redis.hgetall(keys.room(roomId));

    if (Object.keys(data).length === 0) return null;

    if (!data.ownerId) return null;

    return {
      id: roomId,
      ownerId: data.ownerId,
    } as Room;
  }

  async exists(roomId: string): Promise<boolean> {
    const exists = await this.redis.exists(keys.room(roomId));
    return exists === 1;
  }

  async findPeerIds(roomId: string): Promise<string[]> {
    return await this.redis.smembers(keys.roomPeers(roomId));
  }

  async getPeerCount(roomId: string): Promise<number> {
    return await this.redis.scard(keys.roomPeers(roomId));
  }

  async hasPeer(roomId: string, peerId: string): Promise<boolean> {
    const exists = await this.redis.sismember(keys.roomPeers(roomId), peerId);
    return exists === 1;
  }

  async findProducerIds(roomId: string): Promise<string[]> {
    return await this.redis.smembers(keys.roomProducers(roomId));
  }

  async getProducerCount(roomId: string): Promise<number> {
    return await this.redis.scard(keys.roomProducers(roomId));
  }

  create(tx: ChainableCommander, room: Room): void {
    tx.hset(keys.room(room.id), {
      ownerId: room.ownerId,
    });
  }

  remove(tx: ChainableCommander, roomId: string): void {
    tx.del(keys.room(roomId));
  }

  addPeer(tx: ChainableCommander, roomId: string, peerId: string): void {
    tx.sadd(keys.roomPeers(roomId), peerId);
  }

  removePeer(tx: ChainableCommander, roomId: string, peerId: string): void {
    tx.srem(keys.roomPeers(roomId), peerId);
  }

  addProducer(
    tx: ChainableCommander,
    roomId: string,
    producerId: string,
  ): void {
    tx.sadd(keys.roomProducers(roomId), producerId);
  }

  removeProducer(
    tx: ChainableCommander,
    roomId: string,
    producerId: string,
  ): void {
    tx.srem(keys.roomProducers(roomId), producerId);
  }
}
