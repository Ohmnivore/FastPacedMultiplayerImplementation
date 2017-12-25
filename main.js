var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
///////////////////////////////////////////////////////////////////////////////
// Collections
define("entity", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    ///////////////////////////////////////////////////////////////////////////////
    // Entity: Base entity
    var Input = /** @class */ (function () {
        function Input() {
        }
        return Input;
    }());
    exports.Input = Input;
    var Entity = /** @class */ (function () {
        function Entity() {
            this.x = 0;
            this.speed = 2;
            this.lastServerFrameID = -1;
        }
        Entity.prototype.applyInput = function (input) {
            this.x += input.pressTime * this.speed;
        };
        return Entity;
    }());
    exports.Entity = Entity;
    ///////////////////////////////////////////////////////////////////////////////
    // LocalEntity: Represents the player on the client
    var LocalEntity = /** @class */ (function (_super) {
        __extends(LocalEntity, _super);
        function LocalEntity() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.inputSequenceNumber = 0;
            _this.pendingInputs = [];
            return _this;
        }
        LocalEntity.prototype.incrementSequenceNumber = function () {
            return this.inputSequenceNumber++;
        };
        LocalEntity.prototype.numberOfPendingInputs = function () {
            return this.pendingInputs.length;
        };
        LocalEntity.prototype.saveInput = function (input) {
            this.pendingInputs.push(input);
        };
        LocalEntity.prototype.dropInputs = function () {
            this.pendingInputs = [];
        };
        LocalEntity.prototype.reconcile = function (state) {
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
        };
        return LocalEntity;
    }(Entity));
    exports.LocalEntity = LocalEntity;
    ///////////////////////////////////////////////////////////////////////////////
    // RemoteEntity: Represents the other players on the client
    var InterpolationPosition = /** @class */ (function () {
        function InterpolationPosition(timestamp, position) {
            this.timestamp = timestamp;
            this.position = position;
        }
        return InterpolationPosition;
    }());
    exports.InterpolationPosition = InterpolationPosition;
    var RemoteEntity = /** @class */ (function (_super) {
        __extends(RemoteEntity, _super);
        function RemoteEntity() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.positionBuffer = [];
            return _this;
        }
        RemoteEntity.prototype.addPosition = function (position) {
            this.positionBuffer.push(position);
        };
        RemoteEntity.prototype.interpolate = function (renderTimestamp) {
            // Find the two authoritative positions surrounding the rendering timestamp
            var buffer = this.positionBuffer;
            // Drop older positions
            while (buffer.length >= 2 && buffer[1].timestamp <= renderTimestamp) {
                buffer.shift();
            }
            // Interpolate between the two surrounding authoritative positions
            if (buffer.length >= 2 && buffer[0].timestamp <= renderTimestamp && renderTimestamp <= buffer[1].timestamp) {
                var x0 = buffer[0].position;
                var x1 = buffer[1].position;
                var t0 = buffer[0].timestamp;
                var t1 = buffer[1].timestamp;
                this.x = x0 + (x1 - x0) * (renderTimestamp - t0) / (t1 - t0);
            }
            else if (buffer.length == 1) {
                var x = buffer[0].position;
                this.x = x;
            }
        };
        return RemoteEntity;
    }(Entity));
    exports.RemoteEntity = RemoteEntity;
    ///////////////////////////////////////////////////////////////////////////////
    // ServerEntity: Represents the players on the server
    var ServerEntityState = /** @class */ (function () {
        function ServerEntityState(entityID, position, lastProcessedInput) {
            this.entityID = entityID;
            this.position = position;
            this.lastProcessedInput = lastProcessedInput;
        }
        return ServerEntityState;
    }());
    exports.ServerEntityState = ServerEntityState;
    var ServerEntity = /** @class */ (function (_super) {
        __extends(ServerEntity, _super);
        function ServerEntity() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.lastProcessedInput = 0;
            return _this;
        }
        ServerEntity.prototype.getLastProcessedInput = function () {
            return this.lastProcessedInput;
        };
        ServerEntity.prototype.constructState = function () {
            return new ServerEntityState(this.entityID, this.x, this.lastProcessedInput);
        };
        // Check whether this input seems to be valid (e.g. "make sense" according
        // to the physical rules of the World)
        ServerEntity.prototype.validateInput = function (input) {
            if (Math.abs(input.pressTime) > 1.0 / 40.0) {
                return false;
            }
            return true;
        };
        ServerEntity.prototype.processInput = function (input) {
            // Update the state of the entity, based on its input
            // We just ignore inputs that don't look valid; this is what prevents clients from cheating
            if (this.validateInput(input)) {
                this.applyInput(input);
                this.lastProcessedInput = input.inputSequenceNumber;
            }
        };
        return ServerEntity;
    }(Entity));
    exports.ServerEntity = ServerEntity;
});
define("lagNetwork", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    var Message = /** @class */ (function () {
        function Message(recvTS, payload) {
            this.recvTS = recvTS;
            this.payload = payload;
        }
        return Message;
    }());
    var NetworkState = /** @class */ (function () {
        function NetworkState() {
            this.lagMin = 0.0;
            this.lagMax = 0.0;
            this.dropChance = 0.0;
            this.dropCorrelation = 0.0;
            this.duplicateChance = 0.0;
            this.lastDropRoll = 0.0;
        }
        NetworkState.prototype.copyFrom = function (src) {
            this.lagMin = src.lagMin;
            this.lagMax = src.lagMax;
            this.dropChance = src.dropChance;
            this.dropCorrelation = src.dropCorrelation;
            this.duplicateChance = src.duplicateChance;
        };
        NetworkState.prototype.randomLag = function () {
            return Math.floor(Math.random() * (this.lagMax - this.lagMin)) + this.lagMin;
        };
        NetworkState.prototype.shouldDrop = function () {
            var newRoll = Math.random();
            if (this.lastDropRoll <= this.dropChance) {
                newRoll = this.lastDropRoll * this.dropCorrelation + newRoll * (1.0 - this.dropCorrelation);
            }
            console.log(Math.round(newRoll * 100.0));
            this.lastDropRoll = newRoll;
            return newRoll <= this.dropChance;
        };
        NetworkState.prototype.shouldDuplicate = function () {
            return Math.random() <= this.duplicateChance;
        };
        return NetworkState;
    }());
    exports.NetworkState = NetworkState;
    var LagNetwork = /** @class */ (function () {
        function LagNetwork() {
            this.messages = [];
        }
        LagNetwork.prototype.send = function (state, message) {
            if (!state.shouldDrop()) {
                this.directSend(new Message(+new Date() + state.randomLag(), message));
                if (state.shouldDuplicate()) {
                    this.directSend(new Message(+new Date() + state.randomLag(), message));
                }
            }
        };
        LagNetwork.prototype.directSend = function (message) {
            this.messages.push(message);
        };
        LagNetwork.prototype.receive = function () {
            var now = +new Date();
            for (var i = 0; i < this.messages.length; i++) {
                var message = this.messages[i];
                if (message.recvTS <= now) {
                    this.messages.splice(i, 1);
                    return message.payload;
                }
            }
        };
        return LagNetwork;
    }());
    exports.LagNetwork = LagNetwork;
});
define("render", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    // Render all the entities in the given canvas
    function renderWorld(canvas, entities) {
        // Clear the canvas
        canvas.width = canvas.width;
        var colours = ["blue", "red"];
        for (var i in entities) {
            var entity = entities[i];
            // Compute size and position
            var radius = canvas.height * 0.9 / 2.0;
            var x = (entity.x / 10.0) * canvas.width;
            // Draw the entity
            var ctx = canvas.getContext("2d");
            if (ctx != undefined) {
                ctx.beginPath();
                ctx.arc(x, canvas.height / 2.0, radius, 0.0, 2.0 * Math.PI, false);
                ctx.fillStyle = colours[entity.entityID];
                ctx.fill();
                ctx.lineWidth = 5;
                ctx.strokeStyle = "dark" + colours[entity.entityID];
                ctx.stroke();
            }
        }
    }
    exports.renderWorld = renderWorld;
});
define("host", ["require", "exports", "lagNetwork"], function (require, exports, lagNetwork_1) {
    "use strict";
    exports.__esModule = true;
    var Host = /** @class */ (function () {
        function Host(canvas, status) {
            // Simulated network connection
            this.network = new lagNetwork_1.LagNetwork();
            this.canvas = canvas;
            this.status = status;
        }
        Host.prototype.setUpdateRate = function (hz) {
            this.updateRate = hz;
            clearInterval(this.updateInterval);
            this.updateInterval = setInterval((function (self) { return function () { self.update(); }; })(this), 1000 / this.updateRate);
        };
        Host.prototype.update = function () {
        };
        return Host;
    }());
    exports.Host = Host;
});
define("server", ["require", "exports", "entity", "render", "host"], function (require, exports, entity_1, render_1, host_1) {
    "use strict";
    exports.__esModule = true;
    var Server = /** @class */ (function (_super) {
        __extends(Server, _super);
        function Server(canvas, status) {
            var _this = _super.call(this, canvas, status) || this;
            // Connected clients and their entities
            _this.clients = [];
            _this.entities = {};
            // Default update rate
            _this.setUpdateRate(10);
            return _this;
        }
        Server.prototype.connect = function (client) {
            // Give the Client enough data to identify itself
            client.server = this;
            client.localEntityID = this.clients.length;
            this.clients.push(client);
            // Create a new Entity for this Client
            var entity = new entity_1.ServerEntity();
            this.entities[client.localEntityID] = entity;
            entity.entityID = client.localEntityID;
            // Set the initial state of the Entity (e.g. spawn point)
            var spawnPoints = [4, 6];
            entity.x = spawnPoints[client.localEntityID];
        };
        Server.prototype.update = function () {
            this.processInputs();
            this.sendWorldState();
            render_1.renderWorld(this.canvas, this.entities);
        };
        // Send the world state to all the connected clients
        Server.prototype.sendWorldState = function () {
            // Gather the state of the world. In a real app, state could be filtered to avoid leaking data
            // (e.g. position of invisible enemies).
            var worldState = [];
            var numClients = this.clients.length;
            for (var i = 0; i < numClients; i++) {
                var entity = this.entities[i];
                worldState.push(entity.constructState());
            }
            // Broadcast the state to all the clients
            for (var i = 0; i < numClients; i++) {
                var client = this.clients[i];
                client.network.send(client.recvState, worldState);
            }
        };
        Server.prototype.processInputs = function () {
            // Process all pending messages from clients
            while (true) {
                var input = this.network.receive();
                if (!input) {
                    break;
                }
                this.entities[input.entityID].processInput(input);
            }
            // Show some info
            var info = "Last acknowledged input: ";
            for (var i = 0; i < this.clients.length; ++i) {
                var entity = this.entities[this.clients[i].localEntityID];
                info += "Player " + i + ": #" + (entity.getLastProcessedInput() || 0) + "   ";
            }
            this.status.textContent = info;
        };
        return Server;
    }(host_1.Host));
    exports.Server = Server;
});
define("client", ["require", "exports", "entity", "lagNetwork", "render", "host"], function (require, exports, entity_2, lagNetwork_2, render_2, host_2) {
    "use strict";
    exports.__esModule = true;
    var Client = /** @class */ (function (_super) {
        __extends(Client, _super);
        function Client(canvas, status) {
            var _this = _super.call(this, canvas, status) || this;
            // Local representation of the entities
            _this.entities = {};
            _this.remoteEntities = {};
            // Input state
            _this.keyLeft = false;
            _this.keyRight = false;
            _this.sendState = new lagNetwork_2.NetworkState();
            _this.recvState = new lagNetwork_2.NetworkState();
            // Toggle options
            _this.clientSidePrediction = false;
            _this.serverReconciliation = false;
            _this.entityInterpolation = true;
            // Update rate
            _this.setUpdateRate(50);
            return _this;
        }
        // Update Client state
        Client.prototype.update = function () {
            // Listen to the server
            this.processServerMessages();
            if (this.localEntity == undefined) {
                return; // Not connected yet
            }
            // Process inputs
            this.processInputs();
            // Interpolate other entities
            if (this.entityInterpolation) {
                this.interpolateEntities();
            }
            // Render the World
            render_2.renderWorld(this.canvas, this.entities);
            // Show some info
            var info = "Non-acknowledged inputs: " + this.localEntity.numberOfPendingInputs();
            this.status.textContent = info;
        };
        // Get inputs and send them to the server
        // If enabled, do client-side prediction
        Client.prototype.processInputs = function () {
            // Compute delta time since last update
            var nowTS = +new Date();
            var lastTS = this.lastTS || nowTS;
            var dtSec = (nowTS - lastTS) / 1000.0;
            this.lastTS = nowTS;
            // Package player's input
            var input = new entity_2.Input();
            if (this.keyRight) {
                input.pressTime = dtSec;
            }
            else if (this.keyLeft) {
                input.pressTime = -dtSec;
            }
            else {
                // Nothing interesting happened
                return;
            }
            // Send the input to the server
            input.inputSequenceNumber = this.localEntity.incrementSequenceNumber();
            input.entityID = this.localEntityID;
            this.server.network.send(this.sendState, input);
            // Do client-side prediction
            if (this.clientSidePrediction && this.localEntity != undefined) {
                this.localEntity.applyInput(input);
            }
            // Save this input for later reconciliation
            this.localEntity.saveInput(input);
        };
        // Process all messages from the server, i.e. world updates
        // If enabled, do server reconciliation
        Client.prototype.processServerMessages = function () {
            while (true) {
                var message = this.network.receive();
                if (!message) {
                    break;
                }
                // World state is a list of entity states
                for (var i = 0; i < message.length; i++) {
                    var state = message[i];
                    // If this is the first time we see this entity, create a local representation
                    if (this.entities[state.entityID] == undefined) {
                        var entity = void 0;
                        if (state.entityID == this.localEntityID) {
                            entity = this.createLocalEntity();
                        }
                        else {
                            entity = this.createRemoteEntity(state);
                        }
                        entity.entityID = state.entityID;
                        this.entities[state.entityID] = entity;
                    }
                    if (state.entityID == this.localEntityID) {
                        this.processLocalEntityState(this.localEntity, state);
                    }
                    else {
                        this.processRemoteEntityState(this.remoteEntities[state.entityID], state);
                    }
                }
            }
        };
        Client.prototype.createLocalEntity = function () {
            this.localEntity = new entity_2.LocalEntity();
            return this.localEntity;
        };
        Client.prototype.createRemoteEntity = function (state) {
            var entity = new entity_2.RemoteEntity();
            this.remoteEntities[state.entityID] = entity;
            return entity;
        };
        Client.prototype.processLocalEntityState = function (entity, state) {
            if (this.serverReconciliation) {
                entity.reconcile(state);
            }
            else {
                // Reconciliation is disabled, so drop all the saved inputs.
                entity.dropInputs();
                entity.x = state.position;
            }
        };
        Client.prototype.processRemoteEntityState = function (entity, state) {
            if (!this.entityInterpolation) {
                // Entity interpolation is disabled - just accept the server's position.
                entity.x = state.position;
            }
            else {
                // Add it to the position buffer.
                var timestamp = +new Date();
                entity.addPosition(new entity_2.InterpolationPosition(timestamp, state.position));
            }
        };
        Client.prototype.interpolateEntities = function () {
            // Compute render timestamp
            var now = +new Date();
            var renderTimestamp = now - (1000.0 / this.server.updateRate);
            for (var i in this.remoteEntities) {
                var entity = this.remoteEntities[i];
                entity.interpolate(renderTimestamp);
            }
        };
        return Client;
    }(host_2.Host));
    exports.Client = Client;
});
define("main", ["require", "exports", "client", "server"], function (require, exports, client_1, server_1) {
    "use strict";
    exports.__esModule = true;
    // Setup a server, the player's client, and another player
    var server = new server_1.Server(element("server_canvas"), element("server_status"));
    var player1 = new client_1.Client(element("player1_canvas"), element("player1_status"));
    var player2 = new client_1.Client(element("player2_canvas"), element("player2_status"));
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
    // Helpers
    function element(id) {
        var ret = document.getElementById(id);
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
    function setPlayerOnChangeListeners(prefix) {
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
    function updatePlayerParameters(client, prefix) {
        client.sendState.lagMin = updateNumberFromUI(client.sendState.lagMin, prefix + "_send_lag_min");
        client.sendState.lagMax = updateNumberFromUI(client.sendState.lagMax, prefix + "_send_lag_max");
        client.sendState.dropChance = updateNumberFromUI(client.sendState.dropChance, prefix + "_send_dropped") / 100.0;
        client.sendState.dropCorrelation = updateNumberFromUI(client.sendState.dropCorrelation, prefix + "_send_correlation") / 100.0;
        client.sendState.duplicateChance = updateNumberFromUI(client.sendState.duplicateChance, prefix + "_send_duplicate") / 100.0;
        var cbSymmetric = element(prefix + "_symmetric");
        var recvDisplay = "initial";
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
        var cbPrediction = element(prefix + "_prediction");
        var cbReconciliation = element(prefix + "_reconciliation");
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
        var cbInterpolation = element(prefix + "_interpolation");
        client.entityInterpolation = cbInterpolation.checked;
    }
    function updateNumberFromUI(oldValue, elementID) {
        var input = element(elementID);
        var newValue = parseInt(input.value);
        if (isNaN(newValue)) {
            newValue = oldValue;
        }
        input.value = String(newValue);
        return newValue;
    }
    // When the player presses the arrow keys, set the corresponding flag in the client
    function keyHandler(e) {
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
});
