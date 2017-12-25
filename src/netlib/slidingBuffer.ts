// Circular buffer
export class SlidingArrayBuffer<T> {

    protected initialized: boolean = false;
    protected tailID: number = 0;
    protected headID: number = -1;
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

    getHeadID(): number {
        return this.headID;
    }

    getMaxSize(): number {
        return this.maxSize;
    }

    set(id: number, value: T) {
        if (id > this.headID) {
            // Reset the values that just went from tail to head
            for (let seq = this.headID + 1; seq <= id; ++seq) {
                let idx = seq % this.maxSize;
                this.buffer[idx] = this.fillFunction(seq);
            }

            // Update the most recently sent ID
            this.headID = id;
        }

        let idx = id % this.maxSize;
        this.buffer[idx] = value;

        this.tailID = Math.min(this.tailID, id);
        this.tailID = Math.max(this.tailID, this.headID - this.maxSize + 1);
        this.initialized = true;
    }

    isNew(id: number): boolean {
        return id > this.headID;
    }

    canSet(id: number): boolean {
        if (!this.initialized) {
            return true;
        }

        return this.headID - id < this.maxSize;
    }

    canGet(id: number): boolean {
        if (!this.initialized) {
            return false;
        }

        if (id < this.tailID) {
            return false;
        }

        return id <= this.headID;
    }

    get(id: number): T | undefined {
        let idx = id % this.maxSize;
        return this.buffer[idx];
    }

    cloneBuffer(): Array<T | undefined> {
        return this.buffer.slice(0);
    }
}
