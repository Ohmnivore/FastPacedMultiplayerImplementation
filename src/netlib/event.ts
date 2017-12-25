import { NetHost, NetMessage } from "./host";
import { NetPeer } from "./peer";

export type NetEventHandler = (host: NetHost, peer: NetPeer, error: NetEvent, msg: NetMessage) => void;

export enum NetEvent {

    DuplicatesBufferOverrun,
    DuplicatesBufferOverflow,
    ReliableRecvBufferOverflow,
    ReliableSendBufferOverrun,
    DisconnectRecv
}

export class NetEventUtils {

    static getEventString(error: NetEvent): string {
        if (error == NetEvent.DuplicatesBufferOverrun) {
            return "Duplicates buffer overrun";
        }
        else if (error == NetEvent.DuplicatesBufferOverflow) {
            return "Duplicates buffer overflow";
        }
        else if (error == NetEvent.ReliableRecvBufferOverflow) {
            return "Reliable receive buffer overflow";
        }
        else if (error == NetEvent.ReliableSendBufferOverrun) {
            return "Reliable send buffer overrun";
        }
        else {
            // NetEvent.DisconnectRecv
            return "Disconnect request received";
        }
    }

    static defaultHandler(host: NetHost, peer: NetPeer, error: NetEvent, msg: NetMessage) {
        console.log("netlib error: [" + NetEventUtils.getEventString(error) + "] on peer [" + peer.id + "]");
        host.disconnectPeer(peer.id);
    }
}
