import { Server } from "socket.io";
import { handleRoomEvents } from "./handlers/room.js";
import { logger } from "../infrastructure/logger/logger.js";
import { handleTransportevents } from "./handlers/transport.js";
import { handleConsume } from "./handlers/consume.js";
import { handleProduce } from "./handlers/produce.js";
import { RoomService } from "../modules/room/room.service.js";

export const initializeSocket = (io: Server, roomService: RoomService) => {
  io.on("connection", (socket) => {
    logger.info(`⚡ New socket connection: ${socket.id}`);

    // Attach the room handlers (joinRoom)
    handleRoomEvents(io, socket, roomService);

    // Handle the transport creation
    handleTransportevents(io, socket, roomService);

    // Handle the consume requests
    handleConsume(io, socket, roomService);

    // Handle the produce requests
    handleProduce(io, socket, roomService);

    //  3: Disconnect Cleanup
    socket.on("disconnect", async () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
      // TODO: Need to remove the trasnport, consumer, producer for the respecive user
      try {
        // 1. Get peerId using the socket lookup key
        const peerId = await roomService.peerBySocket(socket.id);
        const peer = await roomService.leaveRoom(peerId);

        if (peer) {
          io.to(peer.roomId).emit("userLeft", { peerId });

          logger.info(
            `🧹 Cleaned up peer [${peerId}] from room [${peer.roomId}]`,
          );
        }
      } catch (error) {
        logger.error("🔴 Error during disconnect cleanup: %s", error);
      }
    });
  });
};
