import { Input, ServerEntityState } from "./entity";

type Payload = Input | ServerEntityState[];

class Message {

    senderID: number;
    sendTS: number;
    recvTS: number;
    payload: Payload;

    constructor(senderID: number, recvTS: number, payload: Payload) {
        this.senderID = senderID;
        this.recvTS = recvTS;
        this.payload = payload;
    }
}

export class NetworkState {

    lagMin: number = 0.0;
    lagMax: number = 0.0;
    dropChance: number = 0.0;
    dropCorrelation: number = 0.0;
    duplicateChance: number = 0.0;

    protected lastDropRoll: number = 0.0;

    copyFrom(src: NetworkState) {
        this.lagMin = src.lagMin;
        this.lagMax = src.lagMax;
        this.dropChance = src.dropChance;
        this.dropCorrelation = src.dropCorrelation;
        this.duplicateChance = src.duplicateChance;
    }

    randomLag(): number {
        return Math.floor(Math.random() * (this.lagMax - this.lagMin)) + this.lagMin;
    }

    shouldDrop(): boolean {
        let newRoll = this.lastDropRoll * this.dropCorrelation + Math.random() * (1.0 - this.dropCorrelation);
        this.lastDropRoll = newRoll;
        return newRoll <= this.dropChance;
    }

    shouldDuplicate(): boolean {
        return Math.random() <= this.duplicateChance;
    }
}

export class LagNetwork {

    protected messages: Array<Message> = [];

    // Unique ID per object, auto-incremented
    id: number = 0;
    protected static curID: number = 0;

    // For logging
    logChart: any;
    logChartDatasetIdx: number;
    logSenderIDFilter: Array<number> = [];
    logPaused: boolean = false;
    protected logStartTime: number;
    protected logSecondsShown: number = 2.0;

    constructor() {
        this.logStartTime = +new Date();
        this.id = LagNetwork.curID++;
    }

    send(state: NetworkState, message: Payload, senderID: number) {
        if (!state.shouldDrop()) {
            this.directSend(new Message(senderID, +new Date() + state.randomLag(), message));

            if (state.shouldDuplicate()) {
                this.directSend(new Message(senderID, +new Date() + state.randomLag(), message));
            }
        }
    }

    protected directSend(message: Message) {
        message.sendTS = +new Date();
        this.messages.push(message);
    }

    // For logging
    protected addLogChartPoint(message: Message, now: number) {
        if (this.logChart != undefined && !this.logPaused) {
            let relTime = (message.sendTS - this.logStartTime) / 1000.0; // In seconds
            let deltaTime = now - message.sendTS; // In milliseconds
            let data = this.logChart.config.data.datasets[this.logChartDatasetIdx].data;

            // Remove points that aren't visible on the graph anymore
            for (let i = 0; i < data.length; ++i) {
                let point = data[i];

                // Add 2.0 to logSecondsShown to account for the duration of the animations
                if (point.x < (now - this.logStartTime) / 1000.0 - (this.logSecondsShown + 2.0)) {
                    data.splice(i, 1);
                }
                else {
                    break;
                }
            }

            // Filter by sender ID
            if (this.logSenderIDFilter.lastIndexOf(message.senderID) < 0) {
                return;
            }

            // Add new point
            data.push({x: relTime, y: deltaTime});
        }
    }

    // For logging
    protected updateLogChart(now: number) {
        if (this.logChart != undefined && !this.logPaused) {
            let relTime = (now - this.logStartTime) / 1000.0; // In seconds
            
            // Scroll the X axis to the right
            this.logChart.config.options.scales.xAxes[0].ticks.min = relTime - this.logSecondsShown - 1.0;
            this.logChart.config.options.scales.xAxes[0].ticks.max = relTime - 1.0;

            this.logChart.update();
        }
    }

    receive(): Payload | undefined {
        let now = +new Date();
        for (let i = 0; i < this.messages.length; i++) {
            let message = this.messages[i];
            
            if (message.recvTS <= now) {
                this.addLogChartPoint(message, now);

                this.messages.splice(i, 1);
                return message.payload;
            }
        }

        this.updateLogChart(now);
    }
}
