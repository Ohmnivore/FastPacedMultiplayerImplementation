// Circular buffer
export class SlidingArrayBuffer<T> {

    protected latestID: number = -1;
    protected maxSize: number;
    protected buffer: Array<T | undefined> = [];
    protected fillFunction: (idx: number) => (T | undefined);

    constructor(maxSize: number = 32, fillFunction: (idx: number) => (T | undefined)) {
        this.maxSize = maxSize;
        this.fillFunction = fillFunction;

        for (let idx = 0; idx < this.maxSize; ++idx) {
            this.buffer.push(fillFunction(idx));
        }
    }

    getLatestID(): number {
        return this.latestID;
    }

    getMaxSize(): number {
        return this.maxSize;
    }

    set(id: number, value: T) {
        if (id > this.latestID) {
            // Reset the values that just went from tail to head
            for (let seq = this.latestID + 1; seq <= id; ++seq) {
                let idx = seq % this.maxSize;
                this.buffer[idx] = this.fillFunction(seq);
            }

            // Update the most recently sent ID
            this.latestID = id;
        }

        let idx = id % this.maxSize;
        this.buffer[idx] = value;
    }

    isNew(id: number): boolean {
        return id > this.latestID;
    }

    isTooOld(id: number): boolean {
        return this.latestID - id >= this.maxSize;
    }

    get(id: number): T | undefined {
        let idx = id % this.maxSize;
        return this.buffer[idx];
    }

    cloneBuffer(): Array<T | undefined> {
        return this.buffer.slice(0);
    }
}
