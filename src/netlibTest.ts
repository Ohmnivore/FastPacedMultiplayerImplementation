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

    msgType: NetMessageType;
    keepSending: boolean = true;
    seqID: number = 0;
    seqIDs: Array<number> = [];

    constructor(fps: number) {
        super();
        this.fps = new FrameRateLimiter(fps);

        // Automatically assing a unique ID
        this.networkID = Host.curID++;
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

                this.netHost.enqueueSend(new NetMessage(this.msgType, seqID), client.networkID);
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

    doTrace: boolean = false;
    seqIDs: Array<number> = [];

    constructor(fps: number) {
        super();
        this.fps = new FrameRateLimiter(fps);

        // Automatically assing a unique ID
        this.networkID = Host.curID++;
    }

    update() {
        // Receive messages
        let messages = this.pollMessages(this.fps.getLastTimestampAsMilliseconds());

        messages.forEach(message => {
            let payload = message.payload as number;
            this.seqIDs.push(payload);

            if (this.doTrace) {
                console.log(payload);
            }
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

export class TestLauncher {

    static failedTests: Array<string> = [];

    public static launchDefaultTests() {
        TestLauncher.failedTests = [];

        let averageConnection = new NetworkState();
        averageConnection.set(100, 200, 0.02, 0.75, 0.02);

        let terribleConnection = new NetworkState();
        terribleConnection.set(100, 200, 0.5, 0.2, 0.1);

        TestLauncher.launchTest("Average connection reliable", NetMessageType.Reliable, false, 300, 60, 10, averageConnection, averageConnection);
        TestLauncher.launchTest("Average connection reliable ordered", NetMessageType.ReliableOrdered, false, 300, 60, 10, averageConnection, averageConnection);

        TestLauncher.launchTest("Average connection reliable lowfreq", NetMessageType.Reliable, false, 300, 10, 60, averageConnection, averageConnection);
        TestLauncher.launchTest("Average connection reliable ordered lowfreq", NetMessageType.ReliableOrdered, false, 300, 10, 60, averageConnection, averageConnection);

        TestLauncher.launchTest("Terrible connection reliable", NetMessageType.Reliable, false, 300, 60, 10, terribleConnection, terribleConnection);
        TestLauncher.launchTest("Terrible connection reliable ordered", NetMessageType.ReliableOrdered, false, 300, 60, 10, terribleConnection, terribleConnection);

        TestLauncher.launchTest("Terrible connection reliable lowfreq", NetMessageType.Reliable, false, 300, 10, 60, terribleConnection, terribleConnection);
        TestLauncher.launchTest("Terrible connection reliable ordered lowfreq", NetMessageType.ReliableOrdered, false, 300, 10, 60, terribleConnection, terribleConnection);
        
        TestLauncher.failedTests.forEach(name => {
            console.log("Failed test: [" + name + "]");
        });
    }

    public static launchTest(title: string, msgType: NetMessageType, doTrace: boolean, time: number,
                             serverFPS: number, clientFPS: number, sendState: NetworkState, recvState: NetworkState) {
        // Initialize
        let testServer = new TestServer(serverFPS);
        testServer.msgType = msgType;
        let testClient = new TestClient(clientFPS);
        testClient.doTrace = doTrace;
        testServer.connect(testClient);

        // Set network states
        testClient.sendState = sendState;
        testClient.recvState = recvState;

        // Simulate
        let curTime = 0.0;
        let maxTime = time;
        let extraTime = 15.0;
        let messagesSent = 0;
        for (let curTime = 0.0; curTime < maxTime + extraTime; curTime += 1.0 / 60.0) {
            testServer.fps.update(curTime);
            testClient.fps.update(curTime);

            if (testServer.fps.getShouldStep()) {
                testServer.update();

                if (testServer.keepSending) {
                    messagesSent++;
                }
            }
            if (testClient.fps.getShouldStep()) {
                testClient.update();
            }

            // Let in-flight packets arrive, and give
            // the reliability protocol some time to re-send
            if (curTime >= maxTime) {
                testServer.keepSending = false;
            }
        }

        let failed = testServer.seqIDs.length != messagesSent || testServer.seqIDs.length != testClient.seqIDs.length;
        if (failed) {
            TestLauncher.failedTests.push(title);
        }

        // Print results
        console.log("[" + title + "] results:");

        if (doTrace || failed) {
            console.log("Sent: " + testServer.seqIDs.length);
            console.log("Received: " + testClient.seqIDs.length);
        }
        else {
            console.log("Success!");
        }

        console.log("");
    }
}
