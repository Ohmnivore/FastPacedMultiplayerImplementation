import { NetHost, NetPeer } from "./host";
import { NetMessage } from "./message";

export type NetEventHandler = (host: NetHost, peer: NetPeer, event: NetEvent, msg: NetMessage | undefined) => void;

export enum NetEvent {

    DuplicatesBufferOverrun,
    DuplicatesBufferOverflow,
    ReliableRecvBufferOverflow,
    ReliableSendBufferOverrun,
    DisconnectRecv,
    Timeout,
    ConnectionEstablished
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
        else if (error == NetEvent.Timeout) {
            return "Timeout";
        }
        else {
            // NetEvent.ConnectionEstablished
            return "Connection established";
        }
    }

    static defaultHandler(host: NetHost, peer: NetPeer, event: NetEvent, msg: NetMessage | undefined) {
        if (event != NetEvent.ConnectionEstablished) {
            console.log("netlib event: [" + NetEventUtils.getEventString(event) + "] on address: [" + peer.address + "] ID: [" + peer.id + "]");
            host.disconnectPeer(peer.id);
        }
    }
}
