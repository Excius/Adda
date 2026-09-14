import type { Consumer, RtpCapabilities } from "mediasoup/types";
import { TransportManager } from "./transport.manager.js";
import { RouterManager } from "./router.manager.js";
import { ProducerManager } from "./producer.manager.js";

type PeerConsumerState = {
  consumer: Consumer;
  peerId: string;
  producerId: string;
};

export class ConsumerManager {
  // consumerId -> Consumer
  private readonly consumers = new Map<string, PeerConsumerState>();

  // peerId -> Consumers belong to the peer
  private readonly peerConsumers = new Map<string, Set<string>>();

  // ProducerId -> consumers consuming that producer
  private readonly producerConsumers = new Map<string, Set<string>>();

  constructor(
    private readonly transportManager: TransportManager,
    private readonly producerManager: ProducerManager,
    private readonly routerManager: RouterManager,
  ) {}

  async consume(
    peerId: string,
    roomId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<Consumer> {
    const router = this.routerManager.get(roomId);

    const producerEntry = this.producerManager.getProducerById(producerId);
    if (!producerEntry) {
      throw new Error("Producer not found");
    }

    if (producerEntry.peerId === peerId) {
      throw new Error("Cannot consume own producer");
    }

    if (producerEntry.roomId !== roomId) {
      throw new Error("Cross-room consume not allowed");
    }

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error("Cannot consumer (codec mismatch)");
    }

    const transport = this.transportManager.get(peerId, "recv");

    const consumer: Consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // always start paused
    });

    this.addConsumer(consumer, peerId, producerId);

    // If the producer closes, automatically close every consumer consuming it
    producerEntry.producer.on("@close", () => {
      consumer.close();
    });

    return consumer;
  }

  private addConsumer(
    consumer: Consumer,
    peerId: string,
    producerId: string,
  ): void {
    const consumerId = consumer.id;

    this.consumers.set(consumerId, { consumer, peerId, producerId });

    let peerConsumerIds = this.peerConsumers.get(peerId);
    if (!peerConsumerIds) {
      peerConsumerIds = new Set();
      this.peerConsumers.set(peerId, peerConsumerIds);
    }
    peerConsumerIds.add(consumerId);

    let producerConsumersIds = this.producerConsumers.get(producerId);
    if (!producerConsumersIds) {
      producerConsumersIds = new Set();
      this.producerConsumers.set(producerId, producerConsumersIds);
    }
    producerConsumersIds.add(consumerId);

    consumer.on("@close", () => {
      this.removeConsumer(consumerId);
    });
  }

  private removeConsumer(consumerId: string): void {
    const entry = this.consumers.get(consumerId);
    if (!entry) return;

    const { peerId, producerId } = entry;

    this.consumers.delete(consumerId);

    const peerConsumerIds = this.peerConsumers.get(peerId);
    if (peerConsumerIds) {
      peerConsumerIds.delete(consumerId);

      if (peerConsumerIds.size === 0) {
        this.peerConsumers.delete(peerId);
      }
    }

    const producerConsumersIds = this.producerConsumers.get(producerId);
    if (producerConsumersIds) {
      producerConsumersIds.delete(consumerId);

      if (producerConsumersIds.size === 0) {
        this.producerConsumers.delete(producerId);
      }
    }
  }

  async resumeConsumer(consumerId: string): Promise<void> {
    const entry = this.consumers.get(consumerId);
    if (!entry) throw new Error("Consumer not found");

    return await entry.consumer.resume();
  }
}
