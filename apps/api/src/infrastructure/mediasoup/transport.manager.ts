import type { DtlsParameters, WebRtcTransport } from "mediasoup/types";
import { RouterManager } from "./router.manager.js";
import { transportOptions } from "./mediasoup.config.js";

export type TransportDirection = "send" | "recv";

type PeerTransportState = {
  generation: number;

  transports: Map<TransportDirection, WebRtcTransport>;

  creationPromise: Map<TransportDirection, Promise<WebRtcTransport>>;
};

export class TransportManager {
  // peerId -> {generation, transport, creationPromise}
  private readonly peers = new Map<string, PeerTransportState>();

  constructor(private readonly routerManager: RouterManager) {}

  private getOrCreateState(peerId: string): PeerTransportState {
    let state = this.peers.get(peerId);

    if (!state) {
      state = {
        generation: 0,
        transports: new Map(),
        creationPromise: new Map(),
      };

      this.peers.set(peerId, state);
    }

    return state;
  }

  private removeTransport(peerId: string, direction: TransportDirection): void {
    const state = this.peers.get(peerId);

    if (!state) return;

    state.transports.delete(direction);

    this.cleanupPeerState(peerId, state);
  }

  private removeCreationPromise(
    peerId: string,
    direction: TransportDirection,
  ): void {
    const state = this.peers.get(peerId);

    if (!state) return;

    state.creationPromise.delete(direction);

    this.cleanupPeerState(peerId, state);
  }

  private cleanupPeerState(peerId: string, state: PeerTransportState): void {
    if (state.transports.size === 0 && state.creationPromise.size === 0) {
      this.peers.delete(peerId);
    }
  }

  async create(
    peerId: string,
    direction: TransportDirection,
    roomId: string,
  ): Promise<WebRtcTransport> {
    const state = this.getOrCreateState(peerId);

    const existing = state.transports.get(direction);
    if (existing) {
      return existing;
    }

    const pending = state.creationPromise.get(direction);
    if (pending) {
      return pending;
    }

    const generation = state.generation;

    // Creating Transport
    const creation = this.createTransport(roomId);

    state.creationPromise.set(direction, creation);

    try {
      const transport = await creation;

      if (state.generation !== generation) {
        transport.close();

        throw new Error(`Transport creation became stale for peer ${peerId}`);
      }

      state.transports.set(direction, transport);

      transport.on("routerclose", () => {
        this.removeTransport(peerId, direction);
      });

      return transport;
    } finally {
      this.removeCreationPromise(peerId, direction);
    }
  }

  get(peerId: string, direction: TransportDirection): WebRtcTransport {
    const state = this.peers.get(peerId);
    if (!state) {
      throw new Error(`No Transport state found for peer ${peerId}`);
    }

    const transport = state.transports.get(direction);
    if (!transport) {
      throw new Error(
        `Transport not found for the peer ${peerId} with direction ${direction}`,
      );
    }

    return transport;
  }

  exists(peerId: string, direction: TransportDirection): boolean {
    return this.peers.get(peerId)?.transports.has(direction) ?? false;
  }

  close(peerId: string, direction: TransportDirection): void {
    const state = this.peers.get(peerId);
    if (!state) return;

    ++state.generation;

    const transport = state.transports.get(direction);

    if (!transport) {
      this.cleanupPeerState(peerId, state);
      return;
    }

    transport.close();

    this.removeTransport(peerId, direction);
  }

  closeForPeer(peerId: string): void {
    const state = this.peers.get(peerId);
    if (!state) return;

    ++state.generation;

    for (const transport of state.transports.values()) {
      transport.close();
    }

    state.transports.clear();
    this.cleanupPeerState(peerId, state);
  }

  async connect(
    peerId: string,
    roomId: string,
    direction: TransportDirection,
    dtlsParameters: DtlsParameters,
  ) {
    const transport = this.get(peerId, direction);
    await transport.connect({ dtlsParameters });
  }

  private async createTransport(roomId: string): Promise<WebRtcTransport> {
    const router = this.routerManager.get(roomId);

    return router.createWebRtcTransport(transportOptions);
  }
}
