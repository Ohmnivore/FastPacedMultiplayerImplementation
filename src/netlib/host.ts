import { NetEventHandler, NetEventUtils, NetEvent } from "./event";
import { NetIncomingMessage, NetMessage, NetMessageType, NetReliableMessage, NetReliableOrderedMessage, NetUnreliableMessage, NetStoredReliableMessage } from "./message";
import { SlidingArrayBuffer } from "./slidingBuffer";

export interface NetAddress {

    getID(): number;
}

export class NetSimpleAddress implements NetAddress {

    protected netID: number;

    constructor(netID: number) {
        this.netID = netID;
    }

    getID(): number {
        return this.netID;
    }

    toString(): string {
        return "" + this.netID;
    }
}

///////////////////////////////////////////////////////////////////////////////
// NetPeer

export interface NetPeer {

    // Abstraction for IP address + port
    address: NetAddress;

    // Unique ID
    id: number;

    // Stats
    getRTT(): number; // milliseconds, assume 100 when peer connects
    getDropRate(): number;
    setRTTSmoothingFactor(factor: number): void;
}

class NetPeerInternal implements NetPeer {

    // Abstraction for IP address + port
    address: NetAddress;

    // Unique ID
    id: number;
    protected static curID = 0;

    // To allow other peers to detect duplicates
    msgSeqID: number = 0;

    // The received seqIDs from this peer, to detect duplicates
    recvSeqIDs: SlidingArrayBuffer<boolean> = new SlidingArrayBuffer(1024, (idx: number) => false);

    // Sequence number for reliability algorithm
    relSeqID: number = 0;

    // The reliable messages sent to this peer
    relSentMsgs: SlidingArrayBuffer<NetStoredReliableMessage> = new SlidingArrayBuffer(1024, (idx: number): (NetStoredReliableMessage | undefined) => undefined);

    // The reliable messages received from this peer
    relRecvMsgs: SlidingArrayBuffer<boolean> = new SlidingArrayBuffer(256, (idx: number) => false);

    // Packets are re-ordered here
    relRecvOrderMsgs: SlidingArrayBuffer<NetIncomingMessage> = new SlidingArrayBuffer(2048, (idx: number): (NetIncomingMessage | undefined) => undefined);
    relRecvOrderStartSeqID: number = 0;
    relOrderSeqID: number = 0;

    // Flag indicates if this peer was sent a reliable message this frame
    relSent: boolean = false;

    sendBuffer: Array<any> = [];

    // Disconnection and timeout
    waitingForDisconnect: boolean = false;
    protected lastReceivedTimestamp: number; // milliseconds
    protected lastReceivedTimestampSet: boolean = false;

    // Stats
    rtt: number = 100; // milliseconds, assume 100 when peer connects
    protected smoothingFactor: number;
    dropRate: number = 0.0;

    constructor() {
        // Automatically assing a unique ID
        this.id = NetPeerInternal.curID++;
        this.setRTTSmoothingFactor(64);
    }

    updateTimeout(timestamp: number) {
        this.lastReceivedTimestampSet = true;
        this.lastReceivedTimestamp = timestamp;
    }

    hasTimedOut(timestamp: number, timeout: number): boolean {
        // In case we never receive a message at all, we need
        // to also set this here
        if (!this.lastReceivedTimestampSet) {
            this.lastReceivedTimestampSet = true;
            this.lastReceivedTimestamp = timestamp;
            return false;
        }

        return timestamp - this.lastReceivedTimestamp >= timeout;
    }

    updateRTT(rtt: number) {
        // Exponential smoothing
        this.rtt = rtt * this.smoothingFactor + this.rtt * (1.0 - this.smoothingFactor);
    }

    getRTT() {
        return this.rtt;
    }

    getDropRate() {
        return this.dropRate;
    }

    setRTTSmoothingFactor(factor: number) {
        this.smoothingFactor = 2.0 / (1.0 + factor);
    }
}


///////////////////////////////////////////////////////////////////////////////
// NetHost

class NetReliableHeartbeatMessage extends NetReliableMessage {

    constructor() {
        super(undefined);
        this.type = NetMessageType.ReliableHeartbeat;
    }
}

class NetDisconnectMessage extends NetUnreliableMessage {

    constructor() {
        super(undefined);
        this.type = NetMessageType.Disconnect;
    }
}

export class NetHost {

    debug: boolean = false;
    eventHandler: NetEventHandler;
    timeoutSeconds: number = 5.0;

    // Mapping peers by their network ID
    protected peersNetID: { [Key: number]: NetPeer } = {};

    // Mapping peers by their internal ID
    protected peersID: { [Key: number]: NetPeer } = {};

    protected recvBuffer: Array<NetIncomingMessage> = [];

    constructor() {
        this.eventHandler = NetEventUtils.defaultHandler;
    }

    getPeerByAddress(address: NetAddress): NetPeer | undefined {
        return this.peersNetID[address.getID()];
    }

    getPeerByID(id: number): NetPeer | undefined {
        return this.peersID[id];
    }

    acceptNewPeer(address: NetAddress): NetPeer {
        let newPeer = new NetPeerInternal();
        newPeer.address = address;
        this.peersNetID[address.getID()] = newPeer;
        this.peersID[newPeer.id] = newPeer;
        this.eventHandler(this, newPeer, NetEvent.ConnectionEstablished, undefined);
        return newPeer;
    }

    disconnectPeer(id: number) {
        let peer = this.peersID[id] as NetPeerInternal;
        if (peer != undefined && !peer.waitingForDisconnect) {
            // Clear all messages for this peer, and add a
            // disconnect message
            peer.sendBuffer.splice(0);
            // Timestamp is 0 because it doesn't matter for the Disconnect message type
            this.enqueueSend(new NetDisconnectMessage(), id, 0);
            peer.waitingForDisconnect = true;
        }
    }

    protected finalDisconnectPeer(id: number) {
        let peer = this.peersID[id];
        if (peer != undefined) {
            delete this.peersNetID[peer.address.getID()];
            delete this.peersID[id];
        }
    }

    enqueueSend(msg: NetMessage, toID: number, curTimestamp: number) {
        let peer = this.peersID[toID] as NetPeerInternal;
        if (peer == undefined || peer.waitingForDisconnect) {
            return;
        }

        let msgType = msg.getType();
        msg.seqID = peer.msgSeqID++;

        if (msgType == NetMessageType.Unreliable || msgType == NetMessageType.Disconnect) {
            // No extra processing required
            peer.sendBuffer.push(msg.getWireForm());
        }
        else {
            // Create a reliable message
            let reliableMsg = msg as NetReliableMessage;
            reliableMsg.relSeqID = peer.relSeqID++;

            if (msgType == NetMessageType.ReliableOrdered) {
                let reliableOrderedMsg = msg as NetReliableOrderedMessage;
                reliableOrderedMsg.relOrderSeqID = peer.relOrderSeqID++;
            }

            // Attach our acks
            reliableMsg.relRecvHeadID = peer.relRecvMsgs.getHeadID();
            reliableMsg.relRecvBuffer = peer.relRecvMsgs.cloneBuffer() as Array<boolean>;

            // Store message
            peer.relSentMsgs.set(reliableMsg.relSeqID, new NetStoredReliableMessage(reliableMsg, curTimestamp));

            // Enqueue
            peer.sendBuffer.push(reliableMsg.getWireForm());
            peer.relSent = true;
        }
    }

    enqueueRecv(msg: any, from: NetAddress, curTimestamp: number) {
        let peer = this.peersNetID[from.getID()] as NetPeerInternal;
        if (peer == undefined || peer.waitingForDisconnect) {
            return;
        }
        peer.updateTimeout(curTimestamp);

        // let incomingMsg = new NetIncomingMessage(msg, peer.id);
        let incomingMsg = new NetIncomingMessage(peer.id);
        incomingMsg.fromWireForm(msg);
        let msgType = incomingMsg.getType();

        // Detect and discard duplicates
        if (peer.recvSeqIDs.isNew(incomingMsg.seqID)) {
            peer.recvSeqIDs.set(incomingMsg.seqID, true); // Mark as received, and continue
        }
        else {
            if (!peer.recvSeqIDs.canGet(incomingMsg.seqID)) {
                this.eventHandler(this, peer, NetEvent.DuplicatesBufferOverrun, incomingMsg);
                return;
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
                    this.eventHandler(this, peer, NetEvent.DuplicatesBufferOverflow, incomingMsg);
                    return;
                }
            }
        }

        if (msgType == NetMessageType.Unreliable) {
            // No extra processing required
            this.recvBuffer.push(incomingMsg);
        }
        else if (msgType == NetMessageType.Disconnect) {
            this.eventHandler(this, peer, NetEvent.DisconnectRecv, incomingMsg);
            this.finalDisconnectPeer(peer.id);
        }
        else {
            let reliableMsg = new NetReliableMessage(undefined);
            reliableMsg.fromWireForm(msg);

            if (msgType == NetMessageType.Reliable) {
                // Let it be received right away
                this.recvBuffer.push(incomingMsg);
            }
            else if (msgType == NetMessageType.ReliableOrdered) {
                // Store in queue
                let reliableOrderedMsg = new NetReliableOrderedMessage(undefined);
                reliableOrderedMsg.fromWireForm(msg);

                if (peer.relRecvOrderMsgs.canSet(reliableOrderedMsg.relOrderSeqID)) {
                    peer.relRecvOrderMsgs.set(reliableOrderedMsg.relOrderSeqID, incomingMsg);
                }
                else {
                    this.eventHandler(this, peer, NetEvent.ReliableRecvBufferOverflow, incomingMsg);
                    return;
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
                    if (peer.relSentMsgs.canGet(relSeqID)) {
                        let stored = peer.relSentMsgs.get(relSeqID);

                        if (stored == undefined) {
                            // Ignore
                            this.eventHandler(this, peer, NetEvent.ReliableSendBufferOverrun, incomingMsg);
                            return;
                        }
                        else if (stored.timesAcked == 0) {
                            // Update peer RTT
                            let rtt = curTimestamp - stored.sentTimestamp;
                            stored.rtt = rtt;
                            peer.updateRTT(rtt);

                            // Ack callback
                            if (stored.msg.onAck != undefined) {
                                stored.msg.onAck(stored.msg, peer);
                            }

                            stored.timesAcked++;
                        }
                    }
                    else if (relSeqID >= 0) {
                        this.eventHandler(this, peer, NetEvent.ReliableSendBufferOverrun, incomingMsg);
                        return;
                    }
                }
                else {
                    if (peer.relSentMsgs.canGet(relSeqID)) {
                        let toResend = peer.relSentMsgs.get(relSeqID);

                        if (toResend == undefined) {
                            // Ignore
                            this.eventHandler(this, peer, NetEvent.ReliableSendBufferOverrun, incomingMsg);
                            return;
                        }
                        else if (toResend.timesAcked == 0) {
                            // Resend callback
                            if (toResend.msg.onResend != undefined) {
                                toResend.msg.onResend(toResend, peer);
                            }

                            // Enqueue
                            peer.sendBuffer.push(toResend.msg);
                        }
                    }
                    else if (relSeqID >= 0) {
                        this.eventHandler(this, peer, NetEvent.ReliableSendBufferOverrun, incomingMsg);
                        return;
                    }
                }
            }

            // Calculate drop rate for the past 4 seconds
            start = peer.relSentMsgs.getHeadID();
            end = start - peer.relSentMsgs.getMaxSize() + 1;
            let timeInterval = 4000;
            let threshold = peer.rtt * 1.2;
            let n = 0;
            let dropped = 0;

            for (let seqID = start; seqID >= end; --seqID) {
                if (peer.relSentMsgs.canGet(seqID)) {
                    let storedMsg = peer.relSentMsgs.get(seqID);

                    if (storedMsg != undefined) {
                        if (curTimestamp - storedMsg.sentTimestamp > timeInterval) {
                            break;
                        }

                        n++;
                        if (storedMsg.timesAcked == 0 && curTimestamp - storedMsg.sentTimestamp >= threshold) {
                            dropped++;
                        }
                        else if (storedMsg.timesAcked > 0 && storedMsg.rtt >= threshold) {
                            dropped++;
                        }
                    }
                }
            }

            peer.dropRate = dropped / Math.max(1, n);
        }
    }

    getSendBuffer(toID: number, curTimestamp: number): Array<NetMessage> {
        let peer = this.peersID[toID] as NetPeerInternal;
        if (peer == undefined) {
            return [];
        }

        // Check if the peer has timed out, disconnect if he has
        if (peer.hasTimedOut(curTimestamp, Math.round(this.timeoutSeconds * 1000.0))) {
            this.eventHandler(this, peer, NetEvent.Timeout, undefined);
            this.disconnectPeer(peer.id);
        }

        // If the peer is scheduled for disconnection,
        // disconnect him and send the disconnection message
        if (peer.waitingForDisconnect) {
            let ret = peer.sendBuffer.splice(0);
            this.finalDisconnectPeer(peer.id);
            return ret;
        }

        // Extremely basic redundancy strategy - resend the reliable messages from the past 4 frames
        let relHeadSeqID = peer.relSentMsgs.getHeadID();
        for (let relSeqID = relHeadSeqID; relSeqID >= relHeadSeqID - 4; --relSeqID) {
            let toResend = peer.relSentMsgs.get(relSeqID);

            if (toResend != undefined) {
                // Resend callback
                if (toResend.msg.onResend != undefined) {
                    toResend.msg.onResend(toResend, peer);
                }

                // Enqueue
                peer.sendBuffer.push(toResend.msg);
            }
        }

        // If this peer wasn't sent any reliable messages this frame, send one for acks and ping
        if (!peer.relSent) {
            this.enqueueSend(new NetReliableHeartbeatMessage(), peer.id, curTimestamp);
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
