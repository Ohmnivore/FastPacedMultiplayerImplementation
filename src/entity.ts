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
}

export class Entity {

    entityID: number;
    x: number = 0;
    speed: number = 2;
    lastServerFrameID: number = -1;

    applyInput(input: Input) {
        this.x += input.pressTime * this.speed;
    }
}


///////////////////////////////////////////////////////////////////////////////
// LocalEntity: Represents the player on the client

export class LocalEntity extends Entity {

    protected inputSequenceNumber: number = 0;
    protected pendingInputs: Array<Input> = [];

    incrementSequenceNumber(): number {
        return this.inputSequenceNumber++;
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

    reconcile(state: ServerEntityState) {
        // Set authoritative position
        // A possible improvement for a real game would be to smooth this out
        this.x = state.position;
        
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

    constructor(entityID: number, position: number, lastProcessedInput: number) {
        this.entityID = entityID;
        this.position = position;
        this.lastProcessedInput = lastProcessedInput;
    }
}

export class ServerEntity extends Entity {

    protected lastProcessedInput: number = 0;

    getLastProcessedInput(): number {
        return this.lastProcessedInput;
    }

    constructState(): ServerEntityState {
        return new ServerEntityState(
                this.entityID,
                this.x,
                this.lastProcessedInput
            );
    }

    // Check whether this input seems to be valid (e.g. "make sense" according
    // to the physical rules of the World)
    validateInput(input: Input) {
        if (Math.abs(input.pressTime) > 1.0 / 40.0) {
            return false;
        }
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
