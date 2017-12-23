import { LagNetwork } from "./lagNetwork";

export class Host {

    // Simulated network connection
    network: LagNetwork = new LagNetwork();

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;
    protected loopElapsed: number = 0.0;

    // UI
    protected canvas: HTMLCanvasElement;
    protected status: HTMLElement;

    constructor(canvas: HTMLCanvasElement, status: HTMLElement) {
        this.canvas = canvas;
        this.status = status;
    }

    setUpdateRate(hz: number) {
        this.updateRate = hz;

        // Fallback to setInterval if this better timing feature is unavailable
        if (window.requestAnimationFrame == undefined) {
            clearInterval(this.updateInterval);
            this.updateInterval = setInterval(
                    (function(self) { return function() { self.update(); }; })(this),
                    1000 / this.updateRate
                );
        }
    }

    loop(delta: number) {
        this.loopElapsed += delta;
        let updateDuration = 1000.0 / this.updateRate; // In ms

        if (this.loopElapsed >= updateDuration) {
            this.update();
            this.loopElapsed -= updateDuration;
        }
    }

    update() {
        
    }
}
