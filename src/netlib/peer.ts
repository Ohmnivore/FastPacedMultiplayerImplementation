import { NetMessage } from "./host";

export class NetPeer {

    // Abstraction for IP address + port
    networkID: number;

    // Unique ID
    id: number;
    protected static curID = 0;

    sendBuffer: Array<NetMessage> = [];

    constructor() {
        // Automatically assing a unique ID
        this.id = NetPeer.curID++;
    }
}
