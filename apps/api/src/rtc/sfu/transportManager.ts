import { env } from "../../config/config.js";
import { getRouter } from "./routerManager.js";
import type { Transport, DtlsParameters } from "@repo/types";

const transports = new Map<string, Map<string, Transport>>();

export const getTransport = (
  userId: string,
  roomId: string,
  direction: "c2s" | "s2c",
) => {
  const roomTransports = transports.get(roomId);
  if (!roomTransports) {
    throw new Error(`No transports found for room ${roomId}`);
  }

  const transport = roomTransports.get(`${userId}:${direction}`);
  if (!transport) {
    throw new Error(
      `Transport not found for user ${userId} (${direction}) in room ${roomId}`,
    );
  }

  return transport;
};

export const createWebRtcTransport = async (
  userId: string,
  roomId: string,
  direction: "c2s" | "s2c",
) => {
  const router = getRouter(roomId);
  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        // listen to all extrenally
        ip: "0.0.0.0",
        // set up t he servers ip address
        announcedIp: env.ANNOUNCED_IP,
      },
    ],
    enableUdp: true,
    enableTcp: false,
    preferUdp: true,
  });
  // storing the transport in the map
  if (!transports.has(roomId)) {
    transports.set(roomId, new Map());
  }
  transports.get(roomId)!.set(`${userId}:${direction}`, transport);
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
};

export const connectTransport = async (
  userId: string,
  roomId: string,
  direction: "c2s" | "s2c",
  dtlsParameters: DtlsParameters,
) => {
  const transport = getTransport(userId, roomId, direction);
  await transport.connect({ dtlsParameters });
};
