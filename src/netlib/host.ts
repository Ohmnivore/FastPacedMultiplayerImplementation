import { NetPeer } from "./peer";

export enum NetMessageType {

    Unreliable,
    UnreliableSequenced,
    Reliable,
    ReliableOrdered,
    ReliableSequenced
}

export class NetMessage {

    type: NetMessageType;
    payload: any;

    constructor(type: NetMessageType, payload: any) {
        this.type = type;
        this.payload = payload;
    }
}

export class NetIncomingMessage extends NetMessage {

    fromPeerID: number;

    constructor(original: NetMessage, fromPeerID: number) {
        super(original.type, original.payload);
        this.fromPeerID = fromPeerID;
    }
}

export class NetHost {

    // Mapping peers by their networkID
    peers: { [Key: number]: NetPeer } = {};

    protected recvBuffer: Array<NetIncomingMessage> = [];

    acceptNewPeer(networkID: number): NetPeer {
        let newPeer = new NetPeer();
        this.peers[networkID] = newPeer;
        return newPeer;
    }

    enqueueSend(msg: NetMessage, toNetworkID: number) {
        if (msg.type == NetMessageType.Unreliable) {
            // No extra processing required
            this.peers[toNetworkID].sendBuffer.push(msg);
        }
    }

    enqueueRecv(msg: NetMessage, fromNetworkID: number) {
        let incomingMsg = new NetIncomingMessage(msg, this.peers[fromNetworkID].id);

        if (incomingMsg.type == NetMessageType.Unreliable) {
            // No extra processing required
            this.recvBuffer.push(incomingMsg);
        }
    }

    getSendBuffer(destNetworkID: number): Array<NetMessage> {
        // Returns a copy of the buffer, and empties the original buffer
        return this.peers[destNetworkID].sendBuffer.splice(0);
    }

    getRecvBuffer(): Array<NetIncomingMessage> {
        // Returns a copy of the buffer, and empties the original buffer
        return this.recvBuffer.splice(0);
    }
}
