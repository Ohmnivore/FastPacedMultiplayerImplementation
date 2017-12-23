import { NetMessage } from "./host";
import { SlidingBuffer } from "./slidingBuffer";

export class NetPeer {

    // Abstraction for IP address + port
    networkID: number;

    // Unique ID
    id: number;
    protected static curID = 0;

    // To allow other peers to detect duplicates
    msgSeqID: number = 0;

    // The received seqIDs from this peer
    recvSeqIDs: SlidingBuffer = new SlidingBuffer(128, true);

    sendBuffer: Array<NetMessage> = [];

    constructor() {
        // Automatically assing a unique ID
        this.id = NetPeer.curID++;
    }
}
