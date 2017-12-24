import { Host } from "./host";
import { NetworkState } from "./lagNetwork";
import { NetMessage, NetMessageType } from "./netlib/host";

class FrameRateLimiter {

    frameRate: number;
    protected lastTimestampSet: boolean = false;
    protected lastTimestamp: number;
    protected accumulator: number = 0.0;
    protected shouldStep: boolean = false;

    constructor(frameRate: number) {
        this.frameRate = frameRate;
    }

    getLastTimestamp(): number {
        return this.lastTimestamp;
    }

    getLastTimestampAsMilliseconds(): number {
        return Math.round(this.lastTimestamp * 1000.0);
    }

    getShouldStep(): boolean {
        return this.shouldStep;
    }

    update(timestamp: number) {
        if (!this.lastTimestampSet) {
            this.lastTimestamp = timestamp;
            this.lastTimestampSet = true;
        }

        let delta = timestamp - this.lastTimestamp;
        this.accumulator += delta;
        let frameDuration = 1.0 / this.frameRate;

        if (this.accumulator >= frameDuration) {
            this.shouldStep = true;
            this.accumulator -= frameDuration;
        }
        else {
            this.shouldStep = false;
        }

        this.lastTimestamp = timestamp;
    }
}

export class TestServer extends Host {
    // Connected clients and their entities
    protected clients: Array<TestClient> = [];

    fps: FrameRateLimiter;

    keepSending: boolean = true;
    seqID: number = 0;
    seqIDs: Array<number> = [];

    constructor(fps: number) {
        super();
        this.fps = new FrameRateLimiter(fps);
    }

    connect(client: TestClient) {
        // Connect netlibs
        client.netHost.acceptNewPeer(this.networkID);
        this.netHost.acceptNewPeer(client.networkID);

        // Give the Client enough data to identify itself
        client.server = this;
        this.clients.push(client);
    }

    update() {
        this.pollMessages(this.fps.getLastTimestampAsMilliseconds());

        for (let i = 0; i < this.clients.length; i++) {
            let client = this.clients[i];

            if (this.keepSending) {
                let seqID = this.seqID++;
                this.seqIDs.push(seqID);

                this.netHost.enqueueSend(new NetMessage(NetMessageType.Reliable, seqID), client.networkID);
            }

            this.netHost.getSendBuffer(client.networkID).forEach(message => {
                client.network.send(this.fps.getLastTimestampAsMilliseconds(), client.recvState, message, this.networkID);
            });
        }
    }
}

export class TestClient extends Host {

    // Simulated network connection
    server: TestServer;
    sendState: NetworkState = new NetworkState();
    recvState: NetworkState = new NetworkState();

    fps: FrameRateLimiter;

    seqIDs: Array<number> = [];

    constructor(fps: number) {
        super();
        this.fps = new FrameRateLimiter(fps);
    }

    update() {
        // Receive messages
        let messages = this.pollMessages(this.fps.getLastTimestampAsMilliseconds());

        messages.forEach(message => {
            let payload = message.payload as number;
            this.seqIDs.push(payload);
            console.log(payload);
        });

        // Send messages
        this.netHost.getSendBuffer(this.server.networkID).forEach(message => {
            this.server.network.send(this.fps.getLastTimestampAsMilliseconds(), this.sendState, message, this.networkID);
        });
    }

    static setNetworkState(state: NetworkState, lagMin: number, lagMax: number, dropChance: number, dropCorrelation: number, duplicateChance: number) {
        state.lagMin = lagMin;
        state.lagMax = lagMax;
        state.dropChance = dropChance;
        state.dropCorrelation = dropCorrelation;
        state.duplicateChance = duplicateChance;
    }
}
