import { Entity, Entities } from "./entity";

// Render all the entities in the given canvas
export function renderWorld(canvas: HTMLCanvasElement, entities: Entities) {
    // Clear the canvas
    canvas.width = canvas.width;

    let colours = ["blue", "red"];

    for (let i in entities) { 
        let entity = entities[i];

        // Compute size and position
        let radius = canvas.height * 0.9 / 2.0;
        let x = (entity.x / 10.0) * canvas.width;

        // Draw the entity
        let ctx = canvas.getContext("2d");
        if (ctx != undefined) {
            ctx.beginPath();
            ctx.arc(x, canvas.height / 2.0, radius, 0.0, 2.0 * Math.PI, false);
            ctx.fillStyle = colours[entity.entityID];
            ctx.fill();
            ctx.lineWidth = 5;
            if (entity.connected) {
                ctx.strokeStyle = "dark" + colours[entity.entityID];
            }
            else {
                ctx.strokeStyle = "yellow";
            }
            ctx.stroke();
        }
    }
}
