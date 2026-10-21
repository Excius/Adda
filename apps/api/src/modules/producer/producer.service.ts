import { RtpParameters } from "mediasoup/types";
import { ProducerManager } from "../../infrastructure/mediasoup/producer.manager.js";
import { RoomRepository } from "../room/room.repository.js";
import { PeerRepository } from "../peer/peer.repository.js";
import { Redis } from "ioredis";
import { ProducerRepository } from "./producer.repository.js";
import type { Producer } from "./producer.types.js";
import { ConsumerRepository } from "../consumer/consumer.repository.js";

export class ProducerService {
  constructor(
    private readonly producerManager: ProducerManager,
    private readonly producerRepository: ProducerRepository,
    private readonly consumerRepository: ConsumerRepository,
    private readonly roomRepository: RoomRepository,
    private readonly peerRepository: PeerRepository,
    private readonly redis: Redis,
  ) {}

  async produce(peerId: string, roomId: string, rtpParameters: RtpParameters) {
    const roomExists = await this.roomRepository.exists(roomId);
    if (!roomExists) throw new Error(`Room ${roomId} is not found`);

    const peer = await this.peerRepository.findById(peerId);
    if (!peer) throw new Error(`Peer ${peerId} is not found`);

    if (peer.roomId !== roomId) {
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);
    }

    const producerId = await this.producerManager.produce(
      peerId,
      roomId,
      "audio",
      rtpParameters,
    );

    const producer: Producer = {
      id: producerId,
      kind: "audio",
      peerId: peerId,
      roomId: roomId,
    };

    const tx = this.redis.multi();
    this.producerRepository.create(tx, producer);
    this.roomRepository.addProducer(tx, roomId, producerId);

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
        producerId,
      };
    } catch (err) {
      this.producerManager.close(producerId);

      throw new Error(
        `error: failed to produce for peer ${peerId} in room ${roomId}`,
        {
          cause: err,
        },
      );
    }
  }

  async closeProducer(roomId: string, peerId: string, producerId: string) {
    const roomExists = await this.roomRepository.exists(roomId);
    if (!roomExists) throw new Error(`Room ${roomId} is not found`);

    const peer = await this.peerRepository.findById(peerId);
    if (!peer) throw new Error(`Peer ${peerId} is not found`);

    if (peer.roomId !== roomId) {
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);
    }

    if (!this.producerManager.exists(producerId)) {
      throw new Error(`Producer ${producerId} not exists`);
    }

    const producer = await this.producerRepository.findById(producerId);
    if (!producer) throw new Error(`Producer ${producerId} not exists`);

    if (producer.peerId !== peerId || producer.roomId !== roomId) {
      throw new Error(
        `Producer ${producerId} is not related to either the room ${roomId} or peer ${peerId}`,
      );
    }

    const liveProducer = this.producerManager.getProducerById(producerId);
    if (!liveProducer) throw new Error(`Live producer ${producerId} not found`);

    const consumerIds =
      await this.consumerRepository.findIdsByProducer(producerId);

    // close the live mediasoup producer
    this.producerManager.close(producerId);

    const tx = this.redis.multi();

    for (const consumerId of consumerIds) {
      this.consumerRepository.remove(tx, consumerId);
    }

    this.producerRepository.remove(tx, producer);
    this.roomRepository.removeProducer(tx, roomId, producerId);

    try {
      const result = await tx.exec();

      if (result === null) {
        throw new Error("Redis transaction was aborted");
      }

      for (const [error] of result) {
        if (error) throw error;
      }

      return {
        producerId,
      };
    } catch (err) {
      throw new Error(`Failed to close producer ${producerId}`, {
        cause: err,
      });
    }
  }
}
