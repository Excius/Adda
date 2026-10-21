import { Server, Socket } from "socket.io";
import {
  createWebRtcTransport,
  connectTransport,
} from "../../rtc/sfu/index.js";
import { logger } from "../../infrastructure/logger/logger.js";
import { getRouterCapabilities } from "../../rtc/sfu/routerManager.js";
import { DtlsParameters } from "@repo/types";
import { RoomService } from "../../services/room.service.js";

export const handleTransportevents = (
  io: Server,
  socket: Socket,
  roomService: RoomService,
) => {
  socket.on(
    "getRouterRtpCapabilities",
    ({ roomId }: { roomId: string }, callback) => {
      if (!roomId) {
        return callback({
          error: "room id is not provided",
        });
      }

      try {
        const rtpCapabilities = getRouterCapabilities(roomId);

        callback({
          data: rtpCapabilities,
        });
      } catch (error) {
        callback({
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    },
  );

  socket.on(
    "createTransport",
    async (
      { roomId, direction }: { roomId: string; direction: "c2s" | "s2c" },
      callback,
    ) => {
      try {
        const userId = await roomService.peerBySocket(socket.id);
        if (!userId) {
          throw new Error("No peerId associated with socket id");
        }

        const transportInfo = await createWebRtcTransport(
          userId,
          roomId,
          direction,
        );

        logger.debug(transportInfo.iceCandidates, "ICE Candidates");
        logger.debug(transportInfo.iceParameters, "ICE Parameters");

        callback({
          ...transportInfo,
          direction,
        });
      } catch (err) {
        logger.error(err);
        socket.emit("error", {
          message: "Failed to create transport event",
        });
      }
    },
  );

  socket.on(
    "connectTransport",
    async (
      {
        roomId,
        direction,
        dtlsParameters,
      }: {
        roomId: string;
        direction: "c2s" | "s2c";
        dtlsParameters: DtlsParameters;
      },
      callback,
    ) => {
      try {
        const userId = await roomService.peerBySocket(socket.id);
        if (!userId) {
          throw new Error("No peerId associated with socket id");
        }
        await connectTransport(userId, roomId, direction, dtlsParameters);
        if (typeof callback === "function") {
          callback({ success: true });
        }
      } catch (err) {
        if (typeof callback === "function") {
          callback({
            error:
              err instanceof Error
                ? err.message
                : "Failed to connect to transport",
          });
        }
      }
    },
  );
};

// TODO: Need to create a handleTransportDisconnect
