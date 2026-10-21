export interface Producer {
  id: string;
  peerId: string;
  roomId: string;
  kind: "audio" | "video";
}
