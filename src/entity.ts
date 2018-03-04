///////////////////////////////////////////////////////////////////////////////
// Collections

export type Entities = { [Key: number]: Entity };
export type RemoteEntities = { [Key: number]: RemoteEntity };
export type ServerEntities = { [Key: number]: ServerEntity };


///////////////////////////////////////////////////////////////////////////////
// Entity: Base entity

export class Input {

    pressTime: number;
    inputSequenceNumber: number;
    entityID: number;
    position: number;

    copy(src: Input) {
        this.pressTime = src.pressTime;
        this.inputSequenceNumber = src.inputSequenceNumber;
        this.entityID = src.entityID;
        this.position = src.position;
    }
}

export class Entity {

    entityID: number;
    x: number = 0;
    displayX: number = 0;
    speed: number = 2;
    connected: boolean = true;
    error: boolean = false;

    applyInput(input: Input) {
        this.x += input.pressTime * this.speed;
        this.setPosition(this.x);
    }

    setPosition(x: number) {
        this.x = x;
        this.displayX = x;
    }
}


///////////////////////////////////////////////////////////////////////////////
// LocalEntity: Represents the player on the client

export class LocalEntity extends Entity {

    protected inputSequenceNumber: number = 0;
    protected pendingInputs: Array<Input> = [];

    protected errorTimer: number = 0;

    incrementSequenceNumber(): number {
        this.inputSequenceNumber++;
        return this.inputSequenceNumber;
    }

    numberOfPendingInputs(): number {
        return this.pendingInputs.length;
    }

    saveInput(input: Input) {
        this.pendingInputs.push(input);
    }

    dropInputs() {
        this.pendingInputs = [];
    }

    setPosition(x: number) {
        this.x = x;
    }

    errorCorrect(dtSec: number) {
        if (this.error) {
            let weight = 0.65;
            this.displayX = this.displayX * weight + this.x * (1.0 - weight);

            this.errorTimer += dtSec;

            if (this.errorTimer > 0.25) {
                this.error = false;
            }
        }
        else {
            this.displayX = this.x;
        }
    }

    reconcile(state: ServerEntityState) {
        // Set authoritative position
        this.x = state.position;

        let idx = 0;
        while (idx < this.pendingInputs.length) {
            var input = this.pendingInputs[idx];
            
            if (input.inputSequenceNumber == state.lastProcessedInput) {
                let offset = state.position - input.position;
                if (offset != 0.0) {
                    this.error = true;
                    this.errorTimer = 0.0;
                }
            }
            
            idx++;
        }

        // Server Reconciliation. Re-apply all the inputs not yet processed by
        // the server.
        var j = 0;
        while (j < this.pendingInputs.length) {
            var input = this.pendingInputs[j];
            
            if (input.inputSequenceNumber <= state.lastProcessedInput) {
                // Already processed. Its effect is already taken into account into the world update
                // we just got, so we can drop it.
                this.pendingInputs.splice(j, 1);
            }
            else {
                // Not processed by the server yet. Re-apply it.
                this.applyInput(input);
                j++;
            }
        }
    }
}


///////////////////////////////////////////////////////////////////////////////
// RemoteEntity: Represents the other players on the client

export class InterpolationPosition {

    timestamp: number;
    position: number;

    constructor(timestamp: number, position: number) {
        this.timestamp = timestamp;
        this.position = position;
    }
}

export class RemoteEntity extends Entity {

    protected positionBuffer: Array<InterpolationPosition> = [];

    addPosition(position: InterpolationPosition) {
        this.positionBuffer.push(position);
    }

    interpolate(renderTimestamp: number) {
        // Find the two authoritative positions surrounding the rendering timestamp
        let buffer = this.positionBuffer;
        
        // Drop older positions
        while (buffer.length >= 2 && buffer[1].timestamp <= renderTimestamp) {
            buffer.shift();
        }

        // Interpolate between the two surrounding authoritative positions
        if (buffer.length >= 2 && buffer[0].timestamp <= renderTimestamp && renderTimestamp <= buffer[1].timestamp) {
            let x0 = buffer[0].position;
            let x1 = buffer[1].position;
            let t0 = buffer[0].timestamp;
            let t1 = buffer[1].timestamp;

            this.x = x0 + (x1 - x0) * (renderTimestamp - t0) / (t1 - t0);
        }
        // Just set this directly if there's only one position
        else if (buffer.length == 1) {
            let x = buffer[0].position;
            this.x = x;
        }
    }
}


///////////////////////////////////////////////////////////////////////////////
// ServerEntity: Represents the players on the server

export class ServerEntityState {

    entityID: number;
    position: number;
    lastProcessedInput: number;

    copy(src: ServerEntityState) {
        this.entityID = src.entityID;
        this.position = src.position;
        this.lastProcessedInput = src.lastProcessedInput;
    }
}

export class ServerEntity extends Entity {

    protected lastProcessedInput: number = 0;

    serverTimeSimulated: number = 0;
    clientTimeSimulated: number = 0;

    getLastProcessedInput(): number {
        return this.lastProcessedInput;
    }

    constructState(): ServerEntityState {
        let state = new ServerEntityState();
        state.entityID = this.entityID;
        state.position = this.x;
        state.lastProcessedInput = this.lastProcessedInput;
        return state;
    }

    // Check whether this input seems to be valid (e.g. "make sense" according
    // to the physical rules of the World)
    validateInput(input: Input) {
        // if (Math.abs(input.pressTime) > 1.0 / 40.0) {
        //     return false;
        // }
        return true;
    }

    processInput(input: Input) {
        // Update the state of the entity, based on its input
        // We just ignore inputs that don't look valid; this is what prevents clients from cheating
        if (this.validateInput(input)) {
            this.applyInput(input);
            this.lastProcessedInput = input.inputSequenceNumber;
        }
    }
}
