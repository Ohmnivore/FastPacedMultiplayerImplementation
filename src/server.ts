import { Input, ServerEntity, ServerEntities } from "./entity";
import { LagNetwork } from "./lagNetwork";
import { Client } from "./client";
import { renderWorld } from "./render";
import { Host } from "./host";
import { NetHost, NetPeer } from "./netlib/host";
import { NetEvent, NetEventUtils } from "./netlib/event";
import { NetUnreliableMessage, NetMessage } from "./netlib/message";

export class Server extends Host {

    // Connected clients and their entities
    protected clients: Array<Client> = [];
    protected entities: ServerEntities = {};
    protected peerIDToEntity: ServerEntities = {};

    constructor(canvas: HTMLCanvasElement, status: HTMLElement) {
        super();
        this.initialize(canvas, status);

        // Default update rate
        this.setUpdateRate(10);
        
        this.netHost.eventHandler = this.netEventHandler.bind(this);
    }

    connect(client: Client) {
        // Connect netlibs
        client.netHost.acceptNewPeer(this.netAddress);
        let peer = this.netHost.acceptNewPeer(client.netAddress);

        // Give the Client enough data to identify itself
        client.server = this;
        client.localEntityID = this.clients.length;
        this.clients.push(client);
      
        // Create a new Entity for this Client
        let entity = new ServerEntity();
        this.entities[client.localEntityID] = entity;
        this.peerIDToEntity[peer.id] = entity;
        entity.entityID = client.localEntityID;
      
        // Set the initial state of the Entity (e.g. spawn point)
        let spawnPoints = [4, 6];
        entity.x = spawnPoints[client.localEntityID];
    }

    update() {
        this.processInputs();
        this.sendWorldState();
        renderWorld(this.canvas, this.entities);
    }

    // Send the world state to all the connected clients
    protected sendWorldState() {
        // Gather the state of the world. In a real app, state could be filtered to avoid leaking data
        // (e.g. position of invisible enemies).
        let worldState = [];
        let numClients = this.clients.length;

        for (let i = 0; i < numClients; i++) {
            let entity = this.entities[i];
            worldState.push(entity.constructState());
        }

        // Broadcast the state to all the clients
        for (let i = 0; i < numClients; i++) {
            let client = this.clients[i];
            let peer = this.netHost.getPeerByAddress(client.netAddress);

            if (peer != undefined) {
                let curTimestamp = +new Date();
                this.netHost.enqueueSend(new NetUnreliableMessage(worldState), peer.id, curTimestamp);
                this.netHost.getSendBuffer(peer.id, curTimestamp).forEach(message => {
                    client.network.send(curTimestamp, client.recvState, message, this.netAddress.getID());
                });
            }
        }
    }

    protected processInputs() {
        // Process all pending messages from clients
        let messages = this.pollMessages(+new Date());

        messages.forEach(message => {
            let input = message.payload as Input;
            this.entities[input.entityID].processInput(input);
        });

        // Show some info
        let info = "Last acknowledged input: ";
        for (let i = 0; i < this.clients.length; ++i) {
            let entity = this.entities[this.clients[i].localEntityID];
            info += "Player " + i + ": #" + (entity.getLastProcessedInput() || 0) + "   ";
        }
        this.status.textContent = info;
    }

    protected netEventHandler(host: NetHost, peer: NetPeer, event: NetEvent, msg: NetMessage | undefined) {
        NetEventUtils.defaultHandler(host, peer, event, msg);

        if (event == NetEvent.ConnectionEstablished) {
            
        }
        else if (event == NetEvent.ReliableDeliveryFailedNoncritical) {
            
        }
        else {
            this.peerIDToEntity[peer.id].connected = false;
        }
    }
}
