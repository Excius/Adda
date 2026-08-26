# Adda Architecture & Mediasoup WebRTC Connection Flow

This document details the architecture, SFU (Selective Forwarding Unit) entities, and step-by-step WebRTC connection lifecycle used in the **Adda** platform.

---

## 🏛️ Mediasoup Core Entities

Mediasoup architecture relies on 5 primary server-side entities:

```
[ Worker (C++ Process) ]
       │
       └── [ Router (Room-level Media Router) ]
                  ├── [ WebRtcTransport (c2s - Send) ] ───► [ Producer (Audio Track) ]
                  └── [ WebRtcTransport (s2c - Recv) ] ───► [ Consumer (Audio Track) ]
```

1. **Worker**: A C++ subprocess running on a single CPU core that routes media streams.
2. **Router**: Created inside a Worker to manage codec capabilities (`audio/opus`, `video/H264`) for a specific room.
3. **WebRtcTransport**: A WebRTC connection endpoint created on a Router for a peer.
   - **Send Transport (`c2s`)**: Handles Client-to-Server media transmission (publishing mic/camera).
   - **Recv Transport (`s2c`)**: Handles Server-to-Client media transmission (subscribing to remote tracks).
4. **Producer**: Represents an incoming media track sent from a client's microphone/camera into the SFU.
5. **Consumer**: Represents an outgoing media track forwarded from the SFU to a client.

---

## ⚙️ Efficient Usage & Scaling Guidelines

- **1 Worker per CPU Core**: Instantiate one `mediasoup.Worker` per physical CPU core for maximum throughput and parallel processing.
- **1 Router per Room**: Map each active room to a single `Router` instance to handle intra-room media routing efficiently.
- **Separate Transports per Direction**: Create distinct WebRtcTransports for producing (`c2s`) and consuming (`s2c`). Key them using `${userId}:${direction}` on the server to prevent collision.
- **Pause / Resume Pattern**: Create consumers in a `paused: true` state to avoid sending media packets before the client-side consumer transport is connected. Explicitly invoke `resumeConsumer` once the client is ready.

---

## 🔄 Step-by-Step Connection & Signaling Flow

```text
Client (Next.js)                                         Server (Express + Socket.IO + Mediasoup)
       │                                                                   │
       ├───────────────────── 1. joinRoom ────────────────────────────────►│ (Create Peer in Redis)
       │◄──────────────────── { success: true } ───────────────────────────┤
       │                                                                   │
       ├───────────────────── 2. getRouterRtpCapabilities ─────────────────►│ (Fetch Room Router RTP Caps)
       │◄──────────────────── { data: rtpCapabilities } ────────────────────┤
       │ (device.load({ routerRtpCapabilities }))                          │
       │                                                                   │
       ├───────────────────── 3. createTransport (direction: "c2s") ──────►│ (createWebRtcTransport "c2s")
       │◄──────────────────── { id, iceParameters, dtlsParameters... } ────┤
       │ (initSendTransport)                                               │
       │                                                                   │
       ├─── producerTransport.on("connect") ──────────────────────────────►│
       │    socket.emitWithAck("connectTransport", { direction: "c2s" })   │ (transport.connect({ dtlsParameters }))
       │◄──────────────────── { success: true } ───────────────────────────┤
       │                                                                   │
       ├─── producerTransport.on("produce") ──────────────────────────────►│
       │    socket.emitWithAck("produce", { roomId, kind, rtpParameters }) │ (transport.produce())
       │                                                                   ├─► Broadcast "newProducer" to Room
       │◄──────────────────── { id: producerId } ──────────────────────────┤
       │                                                                   │
       ├───────────────────── 4. createTransport (direction: "s2c") ──────►│ (createWebRtcTransport "s2c")
       │◄──────────────────── { id, iceParameters, dtlsParameters... } ────┤
       │ (initRecvTransport)                                               │
       │                                                                   │
       ├─── consumerTransport.on("connect") ──────────────────────────────►│
       │    socket.emitWithAck("connectTransport", { direction: "s2c" })   │ (transport.connect({ dtlsParameters }))
       │◄──────────────────── { success: true } ───────────────────────────┤
       │                                                                   │
       ├─ (On "existingProducers" or "newProducer" event)                  │
       │                                                                   │
       ├───────────────────── 5. consume { producerId } ───────────────────►│ (router.canConsume & transport.consume)
       │◄──────────────────── { data: consumerParams } ─────────────────────┤
       │ (consumerTransport.consume(consumerParams))                       │
       │                                                                   │
       ├───────────────────── 6. resumeConsumer { consumerId } ────────────►│ (consumer.resume())
       │◄──────────────────── { success: true } ───────────────────────────┤
       │                                                                   │
       └─── 🎵 Audio stream starts playing via HTMLAudioElement ───────────┘
```

---

## 🛠️ Step-by-Step Breakdown

### Phase 1: Capabilities & Device Loading

1. **`joinRoom`**: Client joins a room with `roomId` and `name`. Server registers the socket in Redis and creates a room `Router` if it doesn't already exist.
2. **`getRouterRtpCapabilities`**: Client requests `rtpCapabilities` from the room's `Router`.
3. **`device.load`**: Client initializes `mediasoupClient.Device` and loads the router's RTP capabilities to ensure codec compatibility (e.g. `audio/opus`).

---

### Phase 2: Producer Transport (`c2s`)

1. **`createTransport` (`direction: "c2s"`)**: Server creates a send `WebRtcTransport` on the room's Router and returns ICE/DTLS parameters.
2. **`initSendTransport`**: Client instantiates `producerTransport` using `device.createSendTransport`.
3. **`connectTransport`**: When media production begins, `producerTransport` triggers its `connect` event. Client sends DTLS parameters to the server to finalize the WebRTC handshake.
4. **`produce`**: Client calls `producerTransport.produce({ track })`. `producerTransport` triggers `produce` event. Server calls `transport.produce()`, stores the `Producer` instance, and broadcasts a `"newProducer"` event to all other clients in the room.

---

### Phase 3: Consumer Transport (`s2c`) & Stream Consumption

1. **`createTransport` (`direction: "s2c"`)**: Server creates a receive `WebRtcTransport` for the client.
2. **`initRecvTransport`**: Client instantiates `consumerTransport` using `device.createRecvTransport`.
3. **`connectTransport`**: Client connects the consumer transport by signaling DTLS parameters with `direction: "s2c"`.
4. **`consume`**: When notified of a producer (via `"existingProducers"` on join or `"newProducer"` when a remote user starts talking), client calls `socket.emitWithAck("consume", { producerId })`.
   - Server validates room permissions and codec support.
   - Server creates a `Consumer` on the receive transport with `paused: true` and returns consumer parameters (`id`, `producerId`, `kind`, `rtpParameters`).
5. **`consumerTransport.consume`**: Client creates local consumer track using `consumerTransport.consume(consumerParams)` and attaches the track to an HTML `<audio>` element.
6. **`resumeConsumer`**: Client signals `socket.emitWithAck("resumeConsumer", { consumerId })`. Server calls `consumer.resume()`, allowing audio RTP packets to start flowing.

---

## 🧹 Disconnect & Cleanup Flow

When a client closes the browser or leaves the room:

1. Socket disconnects (`socket.on("disconnect")`).
2. Server removes peer mappings from Redis (`removePeerFromRoom`, `removePeer`).
3. Server closes associated `Producer` and `Transport` instances.
4. Server broadcasts `"userLeft"` event with `{ peerId }` to remaining room members.
5. Remaining clients update their participant UI list and stop rendering audio for the departed user.
