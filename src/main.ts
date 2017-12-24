import { Client } from "./client";
import { Server } from "./server";
import { TestLauncher } from "./netlibTest";

// Setup a server, the player's client, and another player
let server = new Server(element("server_canvas") as HTMLCanvasElement, element("server_status"));
let player1 = new Client(element("player1_canvas") as HTMLCanvasElement, element("player1_status"));
let player2 = new Client(element("player2_canvas") as HTMLCanvasElement, element("player2_status"));

// Connect the clients to the server
server.connect(player1);
server.connect(player2);

// Read initial parameters from the UI
updateParameters();

// Setup UI listeners
setOnChangeListeners();

// Setup keyboard input
document.body.onkeydown = keyHandler;
document.body.onkeyup = keyHandler;

///////////////////////////////////////////////////////////////////////////////
// Netlib tests

let testsBtn = element("tests_btn") as HTMLButtonElement;
testsBtn.onclick = function() {
    TestLauncher.launchDefaultTests();
};


///////////////////////////////////////////////////////////////////////////////
// Helpers

function element(id: string): HTMLElement {
    let ret = document.getElementById(id);
    if (ret == undefined) {
        alert("Element with ID " + id + " not found.");
        return new HTMLElement(); // Tricking TypeScript's strict null check
    }
    else {
        return ret;
    }
}

// Set onchange listeners
function setOnChangeListeners() {
    // Players
    setPlayerOnChangeListeners("player1");
    setPlayerOnChangeListeners("player2");

    // Server
    element("server_fps").onchange = updateParameters;
}

function setPlayerOnChangeListeners(prefix: string) {
    element(prefix + "_send_lag_min").onchange = updateParameters;
    element(prefix + "_send_lag_max").onchange = updateParameters;
    element(prefix + "_send_dropped").onchange = updateParameters;
    element(prefix + "_send_correlation").onchange = updateParameters;
    element(prefix + "_send_duplicate").onchange = updateParameters;
    element(prefix + "_recv_lag_min").onchange = updateParameters;
    element(prefix + "_recv_lag_max").onchange = updateParameters;
    element(prefix + "_recv_dropped").onchange = updateParameters;
    element(prefix + "_recv_correlation").onchange = updateParameters;
    element(prefix + "_recv_duplicate").onchange = updateParameters;
    element(prefix + "_symmetric").onchange = updateParameters;
    element(prefix + "_prediction").onchange = updateParameters;
    element(prefix + "_reconciliation").onchange = updateParameters;
    element(prefix + "_interpolation").onchange = updateParameters;
}

// Update simulation parameters from UI
function updateParameters() {
    updatePlayerParameters(player1, "player1");
    updatePlayerParameters(player2, "player2");
    server.setUpdateRate(updateNumberFromUI(server.updateRate, "server_fps"));
}

function updatePlayerParameters(client: Client, prefix: string) {
    client.sendState.lagMin = updateNumberFromUI(client.sendState.lagMin, prefix + "_send_lag_min");
    client.sendState.lagMax = updateNumberFromUI(client.sendState.lagMax, prefix + "_send_lag_max");
    client.sendState.dropChance = updateNumberFromUI(client.sendState.dropChance, prefix + "_send_dropped") / 100.0;
    client.sendState.dropCorrelation = updateNumberFromUI(client.sendState.dropCorrelation, prefix + "_send_correlation") / 100.0;
    client.sendState.duplicateChance = updateNumberFromUI(client.sendState.duplicateChance, prefix + "_send_duplicate") / 100.0;

    let cbSymmetric = element(prefix + "_symmetric") as HTMLInputElement;
    let recvDisplay = "initial";
    if (cbSymmetric.checked) {
        client.recvState.copyFrom(client.sendState);
        recvDisplay = "none";
    }
    else {
        client.recvState.lagMin = updateNumberFromUI(client.recvState.lagMin, prefix + "_recv_lag_min");
        client.recvState.lagMax = updateNumberFromUI(client.recvState.lagMax, prefix + "_recv_lag_max");
        client.recvState.dropChance = updateNumberFromUI(client.recvState.dropChance, prefix + "_recv_dropped") / 100.0;
        client.recvState.dropCorrelation = updateNumberFromUI(client.recvState.dropCorrelation, prefix + "_recv_correlation") / 100.0;
        client.recvState.duplicateChance = updateNumberFromUI(client.recvState.duplicateChance, prefix + "_recv_duplicate") / 100.0;
    }
    element(prefix + "_recv1").style.display = recvDisplay;
    element(prefix + "_recv2").style.display = recvDisplay;

    let cbPrediction = element(prefix + "_prediction") as HTMLInputElement;
    let cbReconciliation = element(prefix + "_reconciliation") as HTMLInputElement;

    // Client Side Prediction disabled => disable Server Reconciliation
    if (client.clientSidePrediction && !cbPrediction.checked) {
        cbReconciliation.checked = false;
    }

    // Server Reconciliation enabled => enable Client Side Prediction
    if (!client.serverReconciliation && cbReconciliation.checked) {
        cbPrediction.checked = true;
    }

    client.clientSidePrediction = cbPrediction.checked;
    client.serverReconciliation = cbReconciliation.checked;

    let cbInterpolation = element(prefix + "_interpolation") as HTMLInputElement;
    client.entityInterpolation = cbInterpolation.checked;
}

function updateNumberFromUI(oldValue: number, elementID: string): number {
    let input = element(elementID) as HTMLInputElement;
    let newValue = parseInt(input.value);
    if (isNaN(newValue)) {
        newValue = oldValue;
    }
    input.value = String(newValue);
    return newValue;
}

// When the player presses the arrow keys, set the corresponding flag in the client
function keyHandler(e: KeyboardEvent) {
    if (e.keyCode == 39) {
        player1.keyRight = (e.type == "keydown");
    }
    else if (e.keyCode == 37) {
        player1.keyLeft = (e.type == "keydown");
    }
    else if (e.key == "d") { 
        player2.keyRight = (e.type == "keydown");
    }
    else if (e.key == "a") {
        player2.keyLeft = (e.type == "keydown");
    }
}
