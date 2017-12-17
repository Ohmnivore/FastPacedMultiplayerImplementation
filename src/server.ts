import { Input, ServerEntity, ServerEntities } from "./entity";
import { LagNetwork } from "./lagNetwork";
import { Client } from "./client";
import { renderWorld } from "./render";
import { Host } from "./host";

export class Server extends Host {

    // Connected clients and their entities
    protected clients: Array<Client> = [];
    protected entities: ServerEntities = {};

    constructor(canvas: HTMLCanvasElement, status: HTMLElement) {
        super(canvas, status);

        // Default update rate
        this.setUpdateRate(10);
    }

    connect(client: Client) {
        // Give the Client enough data to identify itself
        client.server = this;
        client.localEntityID = this.clients.length;
        this.clients.push(client);
      
        // Create a new Entity for this Client
        let entity = new ServerEntity();
        this.entities[client.localEntityID] = entity;
        entity.entityID = client.localEntityID;
      
        // Set the initial state of the Entity (e.g. spawn point)
        let spawnPoints = [4, 6];
        entity.x = spawnPoints[client.localEntityID];
    }

    protected update() {
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
            client.network.send(client.recvState, worldState, this.network.id);
        }
    }

    protected processInputs() {
        // Process all pending messages from clients
        while (true) {
            let input = this.network.receive() as Input;
            if (!input) {
                break;
            }

            this.entities[input.entityID].processInput(input);
        }

        // Show some info
        let info = "Last acknowledged input: ";
        for (let i = 0; i < this.clients.length; ++i) {
            let entity = this.entities[this.clients[i].localEntityID];
            info += "Player " + i + ": #" + (entity.getLastProcessedInput() || 0) + "   ";
        }
        this.status.textContent = info;
    }
}
