import { Input, ServerEntityState } from "./entity";

type Payload = Input | ServerEntityState[];

class Message {

    recvTS: number;
    payload: Payload;

    constructor(recvTS: number, payload: Payload) {
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
        let newRoll = Math.random();
        if (this.lastDropRoll <= this.dropChance) { // Drop correlation enabled only when last packet was dropped
            newRoll = this.lastDropRoll * this.dropCorrelation + newRoll * (1.0 - this.dropCorrelation);
        }
        console.log(Math.round(newRoll * 100.0));
        this.lastDropRoll = newRoll;

        return newRoll <= this.dropChance;
    }

    shouldDuplicate(): boolean {
        return Math.random() <= this.duplicateChance;
    }
}

export class LagNetwork {

    protected messages: Array<Message> = [];

    send(state: NetworkState, message: Payload) {
        if (!state.shouldDrop()) {
            this.directSend(new Message(+new Date() + state.randomLag(), message));

            if (state.shouldDuplicate()) {
                this.directSend(new Message(+new Date() + state.randomLag(), message));
            }
        }
    }

    protected directSend(message: Message) {
        this.messages.push(message);
    }

    receive(): Payload | undefined {
        let now = +new Date();
        for (let i = 0; i < this.messages.length; i++) {
            let message = this.messages[i];
            
            if (message.recvTS <= now) {
                this.messages.splice(i, 1);
                return message.payload;
            }
        }
    }
}
