import { LagNetwork } from "./lagNetwork";

export class Host {

    // Simulated network connection
    network: LagNetwork = new LagNetwork();

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;

    // UI
    protected canvas: HTMLCanvasElement;
    protected status: HTMLElement;

    constructor(canvas: HTMLCanvasElement, status: HTMLElement) {
        this.canvas = canvas;
        this.status = status;
    }

    setUpdateRate(hz: number) {
        this.updateRate = hz;

        clearInterval(this.updateInterval);
        this.updateInterval = setInterval(
                (function(self) { return function() { self.update(); }; })(this),
                1000 / this.updateRate
            );
    }

    protected update() {
        
    }
}
