export const keys = {
  room: (roomId: string) => `room:${roomId}`, // HASH room meta-data
  roomPeers: (roomId: string) => `room:${roomId}:peers`, // SET room -> peerIds
  roomProducers: (roomId: string) => `room:${roomId}:producers`, // SET roomId -> producerIds (all the producers in the room)

  peer: (peerId: string) => `peer:${peerId}`, // HASH peer meta-data
  peerBySocket: (socketId: string) => `socket:${socketId}`, // String socketId -> peerId

  producer: (producerId: string) => `producer:${producerId}`, // HASH producer meta-data
  peerProducers: (peerId: string) => `peer:${peerId}:producers`, // SET peerId -> producerIds (all the producers by the peer(audio/video))

  consumer: (consumerId: string) => `consumer:${consumerId}`, // HASH consumer meta-data
  peerConsumers: (peerId: string) => `peer:${peerId}:consumers`, // SET peerId -> consumerIds (all the consumers peer consuming)
  producerConsumers: (producerId: string) => `producer:${producerId}:consumers`, // SET producerId -> consumerIds (all the consumers consuming this producer)
};
