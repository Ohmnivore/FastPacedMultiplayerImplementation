import { NetHost, NetMessage } from "./host";
import { NetPeer } from "./peer";

export type NetEventHandler = (host: NetHost, peer: NetPeer, error: NetEvent, msg: NetMessage) => void;

export enum NetEvent {

    DuplicatesBufferOverrun,
    DuplicatesBufferOverflow,
    ReliableRecvBufferOverflow,
    ReliableSendBufferOverrun
}

export class NetEventUtils {

    static getErrorString(error: NetEvent): string {
        if (error == NetEvent.DuplicatesBufferOverrun) {
            return "Duplicates buffer overrun";
        }
        else if (error == NetEvent.DuplicatesBufferOverflow) {
            return "Duplicates buffer overflow";
        }
        else if (error == NetEvent.ReliableRecvBufferOverflow) {
            return "Reliable receive buffer overflow";
        }
        else {
            // NetError.ReliableSendBufferOverrun
            return "Reliable send buffer overrun";
        }
    }

    static defaultHandler(host: NetHost, peer: NetPeer, error: NetEvent, msg: NetMessage) {
        console.log("netlib error: [" + NetEventUtils.getErrorString(error) + "] on peer [" + peer.id + "]");
        host.disconnectPeer(peer.id);
    }
}
