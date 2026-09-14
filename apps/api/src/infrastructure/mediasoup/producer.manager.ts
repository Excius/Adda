import type { Producer, RtpParameters } from "mediasoup/types";
import { TransportManager } from "./transport.manager.js";

type PeerProducerState = {
  producer: Producer;
  roomId: string;
  peerId: string;
};

export class ProducerManager {
  // producerId -> Producer State
  private readonly producers = new Map<string, PeerProducerState>();

  // peerId -> Producers belong to the peer
  private readonly peerProducers = new Map<string, Set<string>>();

  // roomId -> Producers belong to the room
  private readonly roomProducers = new Map<string, Set<string>>();

  constructor(private readonly transportManager: TransportManager) {}

  async produce(
    peerId: string,
    roomId: string,
    kind: "audio" | "video",
    rtpParameters: RtpParameters,
  ): Promise<string> {
    const transport = this.transportManager.get(peerId, "send");

    const producer: Producer = await transport.produce({
      kind,
      rtpParameters,
    });

    this.addProducer(producer, peerId, roomId);

    return producer.id;
  }

  private addProducer(
    producer: Producer,
    peerId: string,
    roomId: string,
  ): void {
    const producerId = producer.id;

    // producers
    this.producers.set(producerId, { producer, peerId, roomId });

    // peer
    let peerProducersIds = this.peerProducers.get(peerId);
    if (!peerProducersIds) {
      peerProducersIds = new Set();
      this.peerProducers.set(peerId, peerProducersIds);
    }
    peerProducersIds.add(producerId);

    // room
    let roomProducersIds = this.roomProducers.get(roomId);
    if (!roomProducersIds) {
      roomProducersIds = new Set();
      this.roomProducers.set(roomId, roomProducersIds);
    }
    roomProducersIds.add(producerId);

    producer.on("@close", () => {
      this.removeProducer(producerId);
    });
  }

  private removeProducer(producerId: string): void {
    const entry = this.producers.get(producerId);
    if (!entry) return;

    const { roomId, peerId } = entry;

    this.producers.delete(producerId);

    const peerProducersIds = this.peerProducers.get(peerId);
    if (peerProducersIds) {
      peerProducersIds.delete(producerId);

      if (peerProducersIds.size === 0) {
        this.peerProducers.delete(peerId);
      }
    }

    const roomProducersIds = this.roomProducers.get(roomId);
    if (roomProducersIds) {
      roomProducersIds.delete(producerId);

      if (roomProducersIds.size === 0) {
        this.roomProducers.delete(roomId);
      }
    }
  }

  getProducerById(producerId: string): PeerProducerState | undefined {
    return this.producers.get(producerId);
  }
}
