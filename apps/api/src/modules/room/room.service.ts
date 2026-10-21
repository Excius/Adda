import { ConsumerManager } from "../../infrastructure/mediasoup/consumer.manager.js";
import { ProducerManager } from "../../infrastructure/mediasoup/producer.manager.js";
import { RouterManager } from "../../infrastructure/mediasoup/router.manager.js";
import { TransportManager } from "../../infrastructure/mediasoup/transport.manager.js";
import { PeerRepository } from "../peer/peer.repository.js";
import { RoomRepository } from "./room.repository.js";
import { Redis } from "ioredis";
import { Room } from "./room.types.js";
import { Peer } from "../peer/peer.types.js";

export class RoomService {
  constructor(
    private readonly redis: Redis,
    private readonly roomRepository: RoomRepository,
    private readonly peerRepository: PeerRepository,
    private readonly routerManager: RouterManager,
    private readonly transportManager: TransportManager,
    private readonly producerManager: ProducerManager,
    private readonly consumerManager: ConsumerManager,
  ) {}

  async createRoom(roomId: string, socketId: string, name: string) {
    const exists = await this.roomRepository.exists(roomId);
    if (exists) throw new Error(`Room ${roomId} already exists`);

    const peerId = crypto.randomUUID();

    const room: Room = {
      id: roomId,
      ownerId: peerId,
    };

    const peer: Peer = {
      id: peerId,
      socketId,
      roomId,
      name,
    };

    const tx = this.redis.multi();

    this.roomRepository.create(tx, room);
    this.peerRepository.create(tx, peer);
    this.roomRepository.addPeer(tx, roomId, peerId);

    try {
      const result = await tx.exec();

      if (result === null) {
        throw new Error("Redis transaction was aborted");
      }

      for (const [error] of result) {
        if (error) {
          throw error;
        }
      }
      return {
        room,
        peer,
      };
    } catch (err) {
      this.routerManager.close(roomId);

      throw new Error("error: failed to create room", {
        cause: err,
      });
    }
  }

  async joinRoom(roomId: string, socketId: string, name: string) {
    const exists = await this.roomRepository.exists(roomId);
    if (!exists) throw new Error(`Room ${roomId} doesn't exists`);

    const peerId = crypto.randomUUID();

    const peer: Peer = {
      id: peerId,
      name,
      roomId,
      socketId,
    };

    const tx = this.redis.multi();

    this.peerRepository.create(tx, peer);
    this.roomRepository.addPeer(tx, roomId, peerId);

    try {
      const result = await tx.exec();

      if (result === null) {
        throw new Error("Redis transaction was aborted");
      }

      for (const [error] of result) {
        if (error) {
          throw error;
        }
      }

      return { peer };
    } catch (err) {
      throw new Error("error: failed to add peer", {
        cause: err,
      });
    }
  }

  async leaveRoom(roomId: string, peerId: string) {
    const peer = await this.peerRepository.findById(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`);
    }

    if (peer.roomId !== roomId) {
      throw new Error(`Peer ${peerId} doesn't belong to room ${roomId}`);
    }

    const isRoom = await this.roomRepository.exists(roomId);
    if (!isRoom) {
      throw new Error(`Room ${roomId} not found`);
    }

    const exists = await this.roomRepository.hasPeer(roomId, peerId);
    if (!exists) {
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);
    }

    // close infra resources
    this.consumerManager.closeForPeer(peerId);
    this.producerManager.closeForPeer(peerId);
    this.transportManager.closeForPeer(peerId);

    //HACK: there might be a race condition in this case where two request run the peerCount and get 2
    const peerCount = await this.roomRepository.getPeerCount(roomId);
    const isLastPeer = peerCount === 1;

    const tx = this.redis.multi();

    this.roomRepository.removePeer(tx, roomId, peerId);
    this.peerRepository.remove(tx, peer);

    if (isLastPeer) {
      this.roomRepository.remove(tx, roomId);
    }

    try {
      const result = await tx.exec();

      if (result === null) {
        throw new Error("Redis transaction was aborted");
      }

      for (const [error] of result) {
        if (error) {
          throw error;
        }
      }

      if (isLastPeer) {
        this.routerManager.close(roomId);
      }

      return { peer };
    } catch (err) {
      throw new Error("error: failed to leave room", {
        cause: err,
      });
    }
  }
}
