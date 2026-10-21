import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { logger } from "../../infrastructure/logger/logger.js";
import { initRouterForRoom } from "../../rtc/sfu/routerManager.js";
import { getConsumableProducers } from "../../rtc/sfu/index.js";
import { RoomService } from "../../services/room.service.js";
import { PeerData } from "@repo/types";

export const handleRoomEvents = (
  io: Server,
  socket: Socket,
  roomService: RoomService,
) => {
  // Event 2.1: Client sends { roomId, name }
  socket.on(
    "joinRoom",
    async ({ roomId, name }: { roomId: string; name: string }, callback) => {
      try {
        // Verify it is callback based call
        if (typeof callback !== "function") {
          throw new Error("callback is not a function");
        }

        // 1. Generate peerId
        const peerId = randomUUID();

        // 2. Store in Redis
        await roomService.joinRoom(peerId, {
          socketId: socket.id,
          roomId,
          name,
        });

        // 3. Join the actual Socket.IO room for broadcasting
        socket.join(roomId);

        // Create router for the same room
        await initRouterForRoom(roomId);

        // 4. Fetch existing peers in the room
        const peerIds = await roomService.peersByRoom(roomId);

        //TODO : Add Redis-lua script to avoid race condition for leave and join
        // Faster way:
        const peerPromises = peerIds
          .filter((id) => id !== peerId)
          .map(async (id) => {
            const data = await roomService.peerById(id);
            return data ? { peerId: id, ...data } : null;
          });

        const results = await Promise.all(peerPromises);

        const existingPeers = results.filter(
          (peer): peer is PeerData & { peerId: string } => Boolean(peer),
        );

        callback({ success: true });

        // 5. Send existing users to the joining client
        socket.emit("existingUsers", existingPeers);

        // Send existing producers in the room to the joining client
        const consumableProducers = getConsumableProducers(roomId, peerId);
        const producersData = consumableProducers.map((p) => ({
          producerId: p!.producer.id,
          producerUserId: p!.userId,
          kind: p!.kind,
        }));
        socket.emit("existingProducers", producersData);

        // 6. Notify all OTHER clients in the room
        const newPeerData = { peerId, socketId: socket.id, roomId, name };
        socket.to(roomId).emit("userJoined", newPeerData);

        logger.info(
          `👤 User [${name}] joined room [${roomId}] with peerId: ${peerId}`,
        );
      } catch (error) {
        logger.error("🔴 Error in joinRoom flow: %s", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    },
  );
};
