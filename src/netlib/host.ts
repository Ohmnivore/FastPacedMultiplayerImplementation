import { NetPeer, StoredNetReliableMessage } from "./peer";

export enum NetMessageType {

    Unreliable,
    Reliable,
    ReliableOrdered,
    ReliableHeartbeat
}

export class NetMessage {

    type: NetMessageType;
    payload: any;
    seqID: number;

    constructor(type: NetMessageType, payload: any) {
        this.type = type;
        this.payload = payload;
    }
}

export class NetReliableMessage extends NetMessage {

    relSeqID: number;
    relOrderSeqID: number;
    relRecvHeadID: number;
    relRecvBuffer: Array<boolean>;

    constructor(original: NetMessage, relSeqID: number) {
        super(original.type, original.payload);
        this.seqID = original.seqID;

        this.relSeqID = relSeqID;
    }
}

export class NetIncomingMessage extends NetMessage {

    fromPeerID: number;

    constructor(original: NetMessage, fromPeerID: number) {
        super(original.type, original.payload);
        this.seqID = original.seqID;

        this.fromPeerID = fromPeerID;
    }
}

export class NetHost {

    debug: boolean = false;

    // Mapping peers by their networkID
    peers: { [Key: number]: NetPeer } = {};

    protected recvBuffer: Array<NetIncomingMessage> = [];

    acceptNewPeer(networkID: number): NetPeer {
        let newPeer = new NetPeer();
        this.peers[networkID] = newPeer;
        return newPeer;
    }

    enqueueSend(msg: NetMessage, toNetworkID: number) {
        let peer = this.peers[toNetworkID];
        msg.seqID = peer.msgSeqID++;

        if (msg.type == NetMessageType.Unreliable) {
            // No extra processing required
            peer.sendBuffer.push(msg);
        }
        else {
            // Create a reliable message
            let reliableMsg = new NetReliableMessage(msg, peer.relSeqID++);
            if (reliableMsg.type == NetMessageType.ReliableOrdered) {
                reliableMsg.relOrderSeqID = peer.relOrderSeqID++;
            }

            // Attach our acks
            reliableMsg.relRecvHeadID = peer.relRecvMsgs.getHeadID();
            reliableMsg.relRecvBuffer = peer.relRecvMsgs.cloneBuffer() as Array<boolean>;

            // Store message
            peer.relSentMsgs.set(reliableMsg.relSeqID, new StoredNetReliableMessage(reliableMsg));

            // Enqueue
            peer.sendBuffer.push(reliableMsg);
            peer.relSent = true;
        }
    }

    enqueueRecv(msg: NetMessage, fromNetworkID: number) {
        let peer = this.peers[fromNetworkID];
        let incomingMsg = new NetIncomingMessage(msg, peer.id);

        // Detect and discard duplicates
        if (peer.recvSeqIDs.isNew(incomingMsg.seqID)) {
            peer.recvSeqIDs.set(incomingMsg.seqID, true); // Mark as received, and continue
        }
        else {
            if (!peer.recvSeqIDs.canGet(incomingMsg.seqID)) {
                throw "received very old message";
                // return; // Assume that it's a duplicate message
            }
            else if (peer.recvSeqIDs.get(incomingMsg.seqID) == true) {
                return; // This is a duplicate message, discard it
            }
            else {
                if (peer.recvSeqIDs.canSet(incomingMsg.seqID)) {
                    peer.recvSeqIDs.set(incomingMsg.seqID, true); // Mark as received, and continue
                }
                else {
                    throw "can't update duplicates";
                }
            }
        }

        if (incomingMsg.type == NetMessageType.Unreliable) {
            // No extra processing required
            this.recvBuffer.push(incomingMsg);
        }
        else {
            let reliableMsg = msg as NetReliableMessage;

            if (reliableMsg.type == NetMessageType.Reliable) {
                // Let it be received right away
                this.recvBuffer.push(incomingMsg);
            }
            else if (reliableMsg.type == NetMessageType.ReliableOrdered) {
                // Store in queue
                if (peer.relRecvOrderMsgs.canSet(reliableMsg.relOrderSeqID)) {
                    peer.relRecvOrderMsgs.set(reliableMsg.relOrderSeqID, incomingMsg);
                }
                else {
                    throw "received very old reliable ordered message";
                }

                for (let seq = peer.relRecvOrderStartSeqID; seq <= peer.relRecvOrderMsgs.getHeadID(); ++seq) {
                    if (!peer.relRecvOrderMsgs.canGet(seq)) {
                        break;
                    }

                    let msg = peer.relRecvOrderMsgs.get(seq);

                    if (msg == undefined) {
                        break;
                    }

                    this.recvBuffer.push(msg);
                    peer.relRecvOrderStartSeqID++;
                }
            }
            else {
                // Process heartbeat messages but don't store them
            }

            // Update our acks
            if (peer.relRecvMsgs.canSet(reliableMsg.relSeqID)) {
                peer.relRecvMsgs.set(reliableMsg.relSeqID, true);
            }
            else {
                // Message is too old, just ignore
                // throw "can't update acks";
            }

            // Process the peer's acks
            let start = reliableMsg.relRecvHeadID - reliableMsg.relRecvBuffer.length + 1;
            let end = reliableMsg.relRecvHeadID;

            for (let relSeqID = start; relSeqID <= end; ++relSeqID) {
                let idx = relSeqID % reliableMsg.relRecvBuffer.length;

                if (reliableMsg.relRecvBuffer[idx] == true) {
                    // TODO: set ping
                }
                else {
                    if (peer.relSentMsgs.canGet(relSeqID)) {
                        let toResend = peer.relSentMsgs.get(relSeqID);

                        if (toResend == undefined) {
                            // Ignore
                            throw "can't find requested message to resend";
                        }
                        else {
                            // Attach our acks
                            toResend.msg.relRecvHeadID = peer.relRecvMsgs.getHeadID();
                            toResend.msg.relRecvBuffer = peer.relRecvMsgs.cloneBuffer() as Array<boolean>;

                            // Enqueue
                            peer.sendBuffer.push(toResend.msg);
                            peer.relSent = true;
                        }
                    }
                    else if (relSeqID >= 0) {
                        throw "can't find requested message to resend";
                    }
                }
            }
        }
    }

    getSendBuffer(destNetworkID: number): Array<NetMessage> {
        let peer = this.peers[destNetworkID];

        // If this peer wasn't sent any reliable messages this frame, send one for acks and ping
        if (!peer.relSent) {
            this.enqueueSend(new NetMessage(NetMessageType.ReliableHeartbeat, undefined), destNetworkID);
        }
        peer.relSent = false;

        // Returns a copy of the buffer, and empties the original buffer
        return peer.sendBuffer.splice(0);
    }

    getRecvBuffer(): Array<NetIncomingMessage> {
        // Returns a copy of the buffer, and empties the original buffer
        return this.recvBuffer.splice(0);
    }
}
