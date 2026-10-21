import type { Producer, RtpParameters } from "mediasoup/types";
import { TransportManager } from "./transport.manager.js";

type PeerProducerState = {
  producer: Producer;
  roomId: string;
  peerId: string;
  transportId: string;
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

    this.addProducer(producer, peerId, roomId, transport.id);

    return producer.id;
  }

  private addProducer(
    producer: Producer,
    peerId: string,
    roomId: string,
    transportId: string,
  ): void {
    const producerId = producer.id;

    // producers
    this.producers.set(producerId, { producer, peerId, roomId, transportId });

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

  exists(producerId: string) {
    return this.producers.has(producerId);
  }

  close(producerId: string) {
    const entry = this.producers.get(producerId);
    if (!entry) throw new Error("Prodcuer not found");

    entry.producer.close();
  }

  closeForTranport(transportId: string): void {
    for (const entry of this.producers.values()) {
      if (entry.transportId === transportId) entry.producer.close();
    }
  }

  closeForPeer(peerId: string) {
    const producerIds = this.peerProducers.get(peerId);
    if (!producerIds) return;

    for (const producerId of producerIds) {
      this.producers.get(producerId)?.producer.close();
    }
  }
}
