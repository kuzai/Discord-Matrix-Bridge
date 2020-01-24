// Usage:
// node index.js -r -u "http://localhost:9000" # remember to add the registration!
// node index.js -p 9000
var http = require("http");
var qs = require('querystring');
var requestLib = require("request");
var bridge;
var PORT = 9898; // slack needs to hit this port e.g. use "ngrok 9898"
var DISCORD_WEBHOOK_URL = "https://discordapp.com/api/webhooks/670080943435939850/3XbkoCeBb6qc6Wn3qwPooLoGwsnq4ayCdaq9b6c77P1J4aTvJD02f2l81gj1N9OP-mSc";
var matrix_host = ":matrix.kuzaikami.com"
var ROOM_ID = "!djYGPCkyEbKPlHgxug" + matrix_host; // this room must have join_rules: public
var hostname = "https://matrix.kuzaikami.com"

http.createServer(function(request, response) {
    console.log(request.method + " " + request.url);

    var body = "";
    request.on("data", function(chunk) {
        body += chunk;
    });

    request.on("end", function() {
        var params = qs.parse(body);
        if (params.user_id !== "UDISCORDBOT") {
            var intent = bridge.getIntent("@discord_" + params.user_name + matrix_host);
            intent.sendText(ROOM_ID, params.text);
        }
        response.writeHead(200, {"Content-Type": "application/json"});
        response.write(JSON.stringify({}));
        response.end();
    });
}).listen(PORT);

var Cli = require("matrix-appservice-bridge").Cli;
var Bridge = require("matrix-appservice-bridge").Bridge;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;

new Cli({
    registrationPath: "discordBot-registration.yaml",
    generateRegistration,
    run: function(port, config) {
        bridge = new Bridge({
            homeserverUrl: hostname,
            domain: "matrix.kuzaikami.com",
            registration: "discordBot-registration.yaml",

            controller: {
                onUserQuery: function(queriedUser) {
                    return {}; // auto-provision users with no additonal data
                },

                onEvent: function(request, context) {
                    var event = request.getData();
                    if (event.type !== "m.room.message" || !event.content || event.room_id !== ROOM_ID) {
                        return;
                    }
                    requestLib({
                        method: "POST",
                        json: true,
                        uri: DISCORD_WEBHOOK_URL,
                        body: {
                            username: event.user_id,
                            text: event.content.body
                        }
                    }, function(err, res) {
                        if (err) {
                            console.log("HTTP Error: %s", err);
                        }
                        else {
                            console.log("HTTP %s", res.statusCode);
                        }
                    });
                }
            }
        });
        console.log("Matrix-side listening on port %s", port);
        bridge.run(port, config);
    }
}).run();

function generateRegistration(reg, callback)  {
    reg.setId(AppServiceRegistration.generateToken());
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart("discord_");
    reg.addRegexPattern("users", "@discord_.*", true);
    reg.addRegexPattern("aliases", "#discord_.*", true);
    reg.setRateLimited(false);
    reg.setProtocols(["discord"]);
    callback(reg);
}