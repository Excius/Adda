export interface Consumer {
  id: string;
  peerId: string;
  roomId: string;
  producerId: string;
  kind: "audio" | "video";
  routerId: string;
}
