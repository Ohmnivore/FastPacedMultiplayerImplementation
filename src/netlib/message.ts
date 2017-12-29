import { NetPeer } from "./peer";

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

    relSeqID: number;
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
            "relRecvHeadID": this.relRecvHeadID,
            "relRecvBuffer": this.relRecvBuffer
        };
    }

    fromWireForm(src: any) {
        this.type = src.type;
        this.payload = src.payload;
        this.seqID = src.seqID;
        this.relSeqID = src.relSeqID;
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
        this.relRecvHeadID = src.relRecvHeadID;
        this.relRecvBuffer = src.relRecvBuffer;
        this.relOrderSeqID = src.relOrderSeqID;
    }
}

export class NetReliableHeartbeatMessage extends NetReliableMessage {

    constructor() {
        super(undefined);
        this.type = NetMessageType.ReliableHeartbeat;
    }
}

export class NetDisconnectMessage extends NetUnreliableMessage {

    constructor() {
        super(undefined);
        this.type = NetMessageType.Disconnect;
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
    sentTimestamp: number;
    rtt: number = 0;
    resent = false;
    timesAcked: number = 0;

    constructor(msg: NetReliableMessage, curTimestamp: number) {
        this.msg = msg;
        this.sentTimestamp = curTimestamp;
    }
}
