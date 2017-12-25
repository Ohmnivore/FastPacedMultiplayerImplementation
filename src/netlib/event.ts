import { NetHost, NetMessage } from "./host";
import { NetPeer } from "./peer";

export type NetEventHandler = (host: NetHost, peer: NetPeer, error: NetEvent, msg: NetMessage | undefined) => void;

export enum NetEvent {

    DuplicatesBufferOverrun,
    DuplicatesBufferOverflow,
    ReliableRecvBufferOverflow,
    ReliableSendBufferOverrun,
    DisconnectRecv,
    Timeout
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
        else if (error == NetEvent.DisconnectRecv) {
            return "Disconnect request received";
        }
        else {
            // NetEvent.Timeout
            return "Timeout";
        }
    }

    static defaultHandler(host: NetHost, peer: NetPeer, error: NetEvent, msg: NetMessage | undefined) {
        console.log("netlib event: [" + NetEventUtils.getEventString(error) + "] on networkID: [" + peer.networkID + "] ID: [" + peer.id + "]");
        host.disconnectPeer(peer.networkID);
    }
}
