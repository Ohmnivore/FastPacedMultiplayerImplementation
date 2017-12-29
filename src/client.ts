import { Input, Entity, Entities, RemoteEntity, RemoteEntities, LocalEntity, InterpolationPosition, ServerEntityState } from "./entity";
import { LagNetwork, NetworkState } from "./lagNetwork";
import { renderWorld } from "./render";
import { Server } from "./server";
import { Host } from "./host";
import { NetHost } from "./netlib/host";
import { NetPeer } from "./netlib/peer";
import { NetEvent, NetEventUtils } from "./netlib/event";
import { NetReliableOrderedMessage, NetMessage } from "./netlib/message";

export class Client extends Host {

    // Local representation of the entities
    protected entities: Entities = {};
    protected remoteEntities: RemoteEntities = {};
    protected localEntity: LocalEntity;

    // Unique ID of our local entity, assigned by Server on connection
    localEntityID: number;

    // Input state
    keyLeft: boolean = false;
    keyRight: boolean = false;
    lastServerMsgSeqID: number = -1;

    // Simulated network connection
    server: Server;
    sendState: NetworkState = new NetworkState();
    recvState: NetworkState = new NetworkState();
    serverPeerID: number;

    // Toggle options
    clientSidePrediction: boolean = false;
    serverReconciliation: boolean = false;
    entityInterpolation: boolean = true;

    constructor(canvas: HTMLCanvasElement, status: HTMLElement) {
        super();
        this.initialize(canvas, status);

        // Update rate
        this.setUpdateRate(50);

        this.netHost.eventHandler = this.netEventHandler.bind(this);
    }

    // Update Client state
    update() {
        // Listen to the server
        this.processServerMessages();

        if (this.localEntity == undefined) {
            return;  // Not connected yet
        }

        // Process inputs
        this.processInputs();

        // Send messages
        let curTimestamp = +new Date();
        this.netHost.getSendBuffer(this.serverPeerID, curTimestamp).forEach(message => {
            this.server.network.send(curTimestamp, this.sendState, message, this.netAddress.getID());
        });

        // Interpolate other entities
        if (this.entityInterpolation) {
            this.interpolateEntities();
        }

        // Render the World
        renderWorld(this.canvas, this.entities);

        // Show some info
        let info = "Non-acknowledged inputs: " + this.localEntity.numberOfPendingInputs();
        let peerServer = this.netHost.getPeerByAddress(this.server.netAddress);
        if (peerServer != undefined) {
            info += " · Ping: " + Math.round(peerServer.rtt);
        }
        this.status.textContent = info;
    }

    // Get inputs and send them to the server
    // If enabled, do client-side prediction
    protected processInputs() {
        // Compute delta time since last update
        let nowTS = +new Date();
        let lastTS = this.lastTS || nowTS;
        let dtSec = (nowTS - lastTS) / 1000.0;
        this.lastTS = nowTS;

        // Package player's input
        let input = new Input();
        if (this.keyRight) {
            input.pressTime = dtSec;
        }
        else if (this.keyLeft) {
            input.pressTime = -dtSec;
        }
        else {
            // Nothing interesting happened
            return;
        }

        // Send the input to the server
        input.inputSequenceNumber = this.localEntity.incrementSequenceNumber();
        input.entityID = this.localEntityID;

        this.netHost.enqueueSend(new NetReliableOrderedMessage(input), this.serverPeerID, nowTS);

        // Do client-side prediction
        if (this.clientSidePrediction && this.localEntity != undefined) {
            this.localEntity.applyInput(input);
        }

        // Save this input for later reconciliation
        this.localEntity.saveInput(input);
    }

    // Process all messages from the server, i.e. world updates
    // If enabled, do server reconciliation
    protected processServerMessages() {
        // Receive messages
        let messages = this.pollMessages(+new Date());

        messages.forEach(message => {
            if (message.seqID <= this.lastServerMsgSeqID) {
                // Ignore this message, it's a late one
            }
            else {
                this.lastServerMsgSeqID = message.seqID;
                let payload = message.payload as ServerEntityState[];

                // World state is a list of entity states
                for (let i = 0; i < payload.length; i++) {
                    let state = payload[i];

                    // If this is the first time we see this entity, create a local representation
                    if (this.entities[state.entityID] == undefined) {
                        let entity: Entity;
                        if (state.entityID == this.localEntityID) {
                            entity = this.createLocalEntity();
                        }
                        else {
                            entity = this.createRemoteEntity(state);
                        }
                        entity.entityID = state.entityID;
                        this.entities[state.entityID] = entity;
                    }

                    if (state.entityID == this.localEntityID) {
                        this.processLocalEntityState(this.localEntity, state);
                    }
                    else {
                        this.processRemoteEntityState(this.remoteEntities[state.entityID], state);
                    }
                }
            }
        });
    }

    protected createLocalEntity(): Entity {
        this.localEntity = new LocalEntity();
        return this.localEntity;
    }

    protected createRemoteEntity(state: ServerEntityState): Entity {
        let entity = new RemoteEntity();
        this.remoteEntities[state.entityID] = entity;
        return entity;
    }

    protected processLocalEntityState(entity: LocalEntity, state: ServerEntityState) {
        if (this.serverReconciliation) {
            entity.reconcile(state);
        }
        else {
            // Reconciliation is disabled, so drop all the saved inputs.
            entity.dropInputs();
            entity.x = state.position;
        }
    }

    protected processRemoteEntityState(entity: RemoteEntity, state: ServerEntityState) {
        if (!this.entityInterpolation) {
            // Entity interpolation is disabled - just accept the server's position.
            entity.x = state.position;
        }
        else {
            // Add it to the position buffer.
            let timestamp = +new Date();
            entity.addPosition(new InterpolationPosition(timestamp, state.position));
        }
    }

    protected interpolateEntities() {
        // Compute render timestamp
        let now = +new Date(); 
        let renderTimestamp = now - (1000.0 / this.server.updateRate);

        for (let i in this.remoteEntities) { 
            let entity = this.remoteEntities[i];
            entity.interpolate(renderTimestamp);
        }
    }

    protected netEventHandler(host: NetHost, peer: NetPeer, event: NetEvent, msg: NetMessage | undefined) {
        NetEventUtils.defaultHandler(host, peer, event, msg);

        if (event == NetEvent.ConnectionEstablished) {
            this.serverPeerID = peer.id;
        }
        else {
            for (let entityID in this.entities) {
                this.entities[entityID].connected = false;
            }
        }
    }
}
