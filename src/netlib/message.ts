import { NetPeer } from "./host";

export enum NetMessageType {

    Unreliable,
    Reliable,
    ReliableOrdered,
    ReliableHeartbeat,  // For internal use
    Disconnect          // For internal use
}

export type NetMsgAckCallback = (msg: NetMessage, peer: NetPeer) => void;
export type NetMsgResendCallback = (msg: NetStoredReliableMessage, peer: NetPeer) => void;

export class NetMessage {

    protected type: number;
    payload: any;
    seqID: number;

    getType(): NetMessageType {
        return this.type;
    }

    getWireForm(): any {
        return {};
    }

    fromWireForm(src: any) {
        this.type = src.type;
        this.payload = src.payload;
        this.seqID = src.seqID;
    }
}

export class NetUnreliableMessage extends NetMessage {

    constructor(payload: any) {
        super();
        this.type = NetMessageType.Unreliable;
        this.payload = payload;
    }

    getWireForm(): any {
        return {
            "type": this.type,
            "payload": this.payload,
            "seqID": this.seqID
        };
    }
}

export class NetReliableMessage extends NetUnreliableMessage {

    critical: boolean = true;
    relSeqID: number;
    originalRelSeqID: number = -1;
    relRecvHeadID: number;
    relRecvBuffer: Array<boolean>;

    onAck: NetMsgAckCallback;
    onResend: NetMsgResendCallback;

    constructor(payload: any) {
        super(payload);
        this.type = NetMessageType.Reliable;
    }

    getWireForm(): any {
        return {
            "type": this.type,
            "payload": this.payload,
            "seqID": this.seqID,
            "relSeqID": this.relSeqID,
            "originalRelSeqID": this.originalRelSeqID,
            "relRecvHeadID": this.relRecvHeadID,
            "relRecvBuffer": this.relRecvBuffer
        };
    }

    fromWireForm(src: any) {
        this.type = src.type;
        this.payload = src.payload;
        this.seqID = src.seqID;
        this.relSeqID = src.relSeqID;
        this.originalRelSeqID = src.originalRelSeqID;
        this.relRecvHeadID = src.relRecvHeadID;
        this.relRecvBuffer = src.relRecvBuffer;
    }
}

export class NetReliableOrderedMessage extends NetReliableMessage {

    relOrderSeqID: number;

    constructor(payload: any) {
        super(payload);
        this.type = NetMessageType.ReliableOrdered;
    }

    getWireForm(): any {
        return {
            "type": this.type,
            "payload": this.payload,
            "seqID": this.seqID,
            "relSeqID": this.relSeqID,
            "originalRelSeqID": this.originalRelSeqID,
            "relRecvHeadID": this.relRecvHeadID,
            "relRecvBuffer": this.relRecvBuffer,
            "relOrderSeqID": this.relOrderSeqID
        };
    }

    fromWireForm(src: any) {
        this.type = src.type;
        this.payload = src.payload;
        this.seqID = src.seqID;
        this.relSeqID = src.relSeqID;
        this.originalRelSeqID = src.originalRelSeqID;
        this.relRecvHeadID = src.relRecvHeadID;
        this.relRecvBuffer = src.relRecvBuffer;
        this.relOrderSeqID = src.relOrderSeqID;
    }
}

export class NetIncomingMessage extends NetMessage {

    fromPeerID: number;

    constructor(fromPeerID: number) {
        super();
        this.fromPeerID = fromPeerID;
    }
}

export class NetStoredReliableMessage {

    msg: NetReliableMessage;
    sentTimestamp: number;          // milliseconds
    lastSentTimestamp: number;      // milliseconds
    resendInterval: number = 100;   // milliseconds
    rtt: number = 0;                // milliseconds
    timesSent: number = 1;
    obsolete: boolean = false;
    acked: boolean = false;

    constructor(msg: NetReliableMessage, curTimestamp: number) {
        this.msg = msg;
        this.sentTimestamp = curTimestamp;
        this.lastSentTimestamp = curTimestamp;
    }
}
