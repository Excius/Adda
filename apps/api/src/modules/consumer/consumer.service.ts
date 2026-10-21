import { RtpCapabilities } from "mediasoup/types";
import { PeerRepository } from "../peer/peer.repository.js";
import { RoomRepository } from "../room/room.repository.js";
import { ConsumerRepository } from "./consumer.repository.js";
import { ConsumerManager } from "../../infrastructure/mediasoup/consumer.manager.js";
import type { Consumer } from "./consumer.types.js";
import { Redis } from "ioredis";

export class ConsumerService {
  constructor(
    private readonly consumerRepository: ConsumerRepository,
    private readonly consumerManager: ConsumerManager,
    private readonly peerRepository: PeerRepository,
    private readonly roomRepository: RoomRepository,
    private readonly redis: Redis,
  ) {}

  async consume(
    peerId: string,
    roomId: string,
    rtpCapabilities: RtpCapabilities,
    producerId: string,
  ) {
    const roomExists = await this.roomRepository.exists(roomId);
    if (!roomExists) throw new Error(`Room ${roomId} is not found`);

    const peer = await this.peerRepository.findById(peerId);
    if (!peer) throw new Error(`Peer ${peerId} is not found`);

    if (peer.roomId !== roomId) {
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);
    }

    const consumerId = await this.consumerManager.consume(
      peerId,
      roomId,
      producerId,
      rtpCapabilities,
    );

    const consumer: Consumer = {
      id: consumerId,
      kind: "audio",
      peerId: peerId,
      producerId: producerId,
      roomId: roomId,
    };

    const tx = this.redis.multi();

    this.consumerRepository.create(tx, consumer);

    try {
      const result = await tx.exec();

      if (result === null) {
        throw new Error(`Redis transaction was aborted`);
      }

      for (const [error] of result) {
        if (error) {
          throw error;
        }
      }

      return {
        consumerId,
      };
    } catch (err) {
      this.consumerManager.close(consumerId);

      throw new Error(
        `error: failed to consume for peer ${peerId} in room ${roomId}`,
        {
          cause: err,
        },
      );
    }
  }

  async resumeConsumer(peerId: string, consumerId: string) {
    const consumer = await this.consumerRepository.findById(consumerId);

    if (!consumer || consumer.peerId !== peerId) {
      throw new Error(`Consumer not found`);
    }

    if (!this.consumerManager.exists(consumerId)) {
      throw new Error(`Live consumer not found`);
    }

    await this.consumerManager.resumeConsumer(consumerId);
  }

  async closeConsumer(peerId: string, consumerId: string) {
    const consumer = await this.consumerRepository.findById(consumerId);

    if (!consumer || consumer.peerId !== peerId) {
      throw new Error(`Consumer not found`);
    }

    if (!this.consumerManager.exists(consumerId)) {
      throw new Error(`Live consumer not found`);
    }

    this.consumerManager.close(consumerId);

    const tx = this.redis.multi();

    this.consumerRepository.remove(tx, consumerId);

    try {
      const result = await tx.exec();

      if (!result) throw new Error(`Redis transaction was aborted`);

      for (const [error] of result) {
        if (error) throw error;
      }

      return {
        consumerId,
      };
    } catch (err) {
      throw new Error(`Failed to close consumer ${consumerId}`, {
        cause: err,
      });
    }
  }
}
