// Can be done as a bitmask instead, but this way is simpler.

export class SlidingBuffer {

    latestID: number = -1;
    maxLength: number = 32;
    defaultValue: boolean = true;
    protected buffer: Array<boolean> = [];

    constructor(maxLength: number = 32, defaultValue: boolean = true) {
        this.maxLength = maxLength;
        this.defaultValue = defaultValue;
    }

    set(id: number) {
        let delta = this.latestID - id;
        let idx = this.buffer.length - (this.latestID - id) - 1;

        if (idx < 0) {
            return;
        }

        if (id >= this.latestID) {
            for (let i = 0; i < delta; ++i) {
                this.buffer.push(false);
            }

            this.buffer[this.buffer.length - 1] = true;
            this.latestID = id;
        }
        else {
            this.buffer[idx] = true;
        }
    }

    isSet(id: number) {
        if (id > this.latestID) {
            return false;
        }

        let idx = this.buffer.length - (this.latestID - id) - 1;
        
        if (idx < 0) {
            return this.defaultValue;
        }

        return this.buffer[idx];
    }
}
