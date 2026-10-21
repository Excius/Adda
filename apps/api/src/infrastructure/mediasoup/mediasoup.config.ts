import {
  RouterRtpCodecCapability,
  WebRtcTransportOptions,
} from "mediasoup/types";
import { env } from "../../config/config.js";

export const mediaCodecs: RouterRtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
    },
  },
];

export const transportOptions: WebRtcTransportOptions = {
  listenIps: [
    {
      ip: "0.0.0.0",
      announcedIp: env.ANNOUNCED_IP,
    },
  ],
  enableUdp: true,
  enableTcp: false,
  preferUdp: true,
};
