import { ChainableCommander, Redis } from "ioredis";
import { keys } from "../../infrastructure/redis/redis.keys.js";
import { Peer } from "./peer.types.js";

// PeerRepository
// ├── peer:{peerId}
// └── socket:{socketId}

export class PeerRepository {
  constructor(private readonly redis: Redis) {}

  async findById(peerId: string): Promise<Peer | null> {
    const data = await this.redis.hgetall(keys.peer(peerId));

    if (Object.keys(data).length === 0) {
      return null;
    }

    return {
      id: peerId,
      socketId: data.socketId,
      roomId: data.roomId,
      name: data.name,
    } as Peer;
  }

  /**
   * Fetches peerId corresponding to the socketId
   *
   * @param {string} socketId - socketId of the connection
   * @returns {Promise<string>} The peerId of the user connected
   */
  async findBySocket(socketId: string): Promise<string | null> {
    return await this.redis.get(keys.peerBySocket(socketId));
  }

  /**
   * Check if peer exists or not
   *
   * @param peerId - peerId of the user
   * @returns {Promise<boolean>} peer exists or not
   */
  async exists(peerId: string): Promise<boolean> {
    const exists = await this.redis.exists(keys.peer(peerId));
    return exists === 1;
  }

  create(tx: ChainableCommander, peer: Peer): void {
    tx.hset(keys.peer(peer.id), {
      socketId: peer.socketId,
      roomId: peer.roomId,
      name: peer.name,
    });

    tx.set(keys.peerBySocket(peer.socketId), peer.id);
  }

  remove(tx: ChainableCommander, peer: Peer): void {
    tx.del(keys.peer(peer.id));

    tx.del(keys.peerBySocket(peer.socketId));
  }
}
