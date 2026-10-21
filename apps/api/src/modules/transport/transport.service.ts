import { DtlsParameters } from "mediasoup/types";
import { logger } from "../../infrastructure/logger/logger.js";
import { ConsumerManager } from "../../infrastructure/mediasoup/consumer.manager.js";
import { ProducerManager } from "../../infrastructure/mediasoup/producer.manager.js";
import {
  TransportDirection,
  TransportManager,
} from "../../infrastructure/mediasoup/transport.manager.js";
import { PeerRepository } from "../peer/peer.repository.js";
import { RoomRepository } from "../room/room.repository.js";

export class TranportService {
  constructor(
    private readonly transportManager: TransportManager,
    private readonly consumerManager: ConsumerManager,
    private readonly producerManager: ProducerManager,
    private readonly roomRepository: RoomRepository,
    private readonly peerRepository: PeerRepository,
  ) {}

  async createTransport(
    roomId: string,
    peerId: string,
    direction: TransportDirection,
  ) {
    const peerExists = await this.peerRepository.exists(peerId);
    if (!peerExists) throw new Error(`Peer ${peerId} is not found`);

    const roomExists = await this.roomRepository.exists(roomId);
    if (!roomExists) throw new Error(`Room ${roomId} is not found`);

    const exists = await this.roomRepository.hasPeer(roomId, peerId);
    if (!exists)
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);

    const transport = await this.transportManager.create(
      peerId,
      direction,
      roomId,
    );

    logger.debug(transport.iceCandidates, "Ice Candidates");
    logger.debug(transport.iceParameters, "Ice Parameters");

    return {
      id: transport.id,
      iceCandidates: transport.iceCandidates,
      iceParameters: transport.iceParameters,
      dtlsParameters: transport.dtlsParameters,
      direction,
    };
  }

  async connectTransport(
    roomId: string,
    peerId: string,
    direction: TransportDirection,
    transportId: string,
    dtlsParameters: DtlsParameters,
  ) {
    const peerExists = await this.peerRepository.exists(peerId);
    if (!peerExists) throw new Error(`Peer ${peerId} is not found`);

    const roomExists = await this.roomRepository.exists(roomId);
    if (!roomExists) throw new Error(`Room ${roomId} is not found`);

    const exists = await this.roomRepository.hasPeer(roomId, peerId);
    if (!exists)
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);

    const transportExists = this.transportManager.exists(peerId, direction);
    if (!transportExists)
      throw new Error(`Peer ${peerId} doesn't own any transport`);

    const transport = this.transportManager.get(peerId, direction);
    if (transport.id !== transportId)
      throw new Error(`Peer ${peerId} doesn't own this transport`);

    await this.transportManager.connect(
      peerId,
      roomId,
      direction,
      dtlsParameters,
    );
  }

  async closeTransport(
    peerId: string,
    roomId: string,
    direction: TransportDirection,
  ) {
    const peer = await this.peerRepository.findById(peerId);
    if (!peer) throw new Error(`Peer ${peerId} not found`);

    if (peer.roomId !== roomId)
      throw new Error(`Peer ${peerId} is not a member of room ${roomId}`);

    const roomExists = await this.roomRepository.exists(roomId);
    if (!roomExists) throw new Error(`Room ${roomId} in not found`);

    if (!this.transportManager.exists(peerId, direction))
      throw new Error(`Transport ${direction} not found for peer ${peerId}`);

    const transport = this.transportManager.get(peerId, direction);

    this.producerManager.closeForTranport(transport.id);
    this.consumerManager.closeForTranport(transport.id);
    this.transportManager.close(peerId, direction);
  }
}
