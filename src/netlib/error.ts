import { NetHost, NetMessage } from "./host";
import { NetPeer } from "./peer";

export type NetErrorHandler = (host: NetHost, peer: NetPeer, error: NetError, msg: NetMessage) => void;

export enum NetError {

    DuplicatesBufferOverrun,
    ReliableRecvBufferOverrun,
    ReliableSendBufferOverrun
}

export class NetErrorUtils {

    static getErrorString(error: NetError): string {
        if (error == NetError.DuplicatesBufferOverrun) {
            return "Duplicates buffer overrun";
        }
        else if (error == NetError.ReliableRecvBufferOverrun) {
            return "Reliable receive buffer overrun";
        }
        else {
            // NetError.ReliableSendBufferOverrun
            return "Reliable send buffer overrun";
        }
    }

    static defaultHandler(host: NetHost, peer: NetPeer, error: NetError, msg: NetMessage) {
        console.log("netlib error: [" + NetErrorUtils.getErrorString(error) + "] on peer [" + peer.id + "]");
        host.disconnectPeer(peer.id);
    }
}
