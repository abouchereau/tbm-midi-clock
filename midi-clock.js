//Linux : apt-get install libasound2-dev build-essential
//Windows : installer python visual studio
//python
//npm install midi
//npm install websocket
//...
//  pkg midi-clock.js --targets=node14-win-x64 --compress GZip -o pkg-target/tbm-midiclock-win-x64.exe
//  pkg midi-clock.js --targets=node14-linux-x64 --compress GZip -o pkg-target/tbm-midiclock-linux-x64

var midi   = require('midi');
var server = require('websocket').server;
var http   = require('http');
var NanoTimer = require('nanotimer');
var readline = require('readline');
const clc = require('cli-color');

const MIDI_TICK = 248;
const MIDI_START = 250;
const MIDI_STOP = 252;

const DEFAULT_PORT = 1337;
const DEFAULT_MIDI_INDEX = 0;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var timer = new NanoTimer();

console.info("Scanning MIDI Outputs...");
sleep(500);
const output = new midi.Output();
let nbMidiDevices = output.getPortCount();
if(nbMidiDevices == 0) {
    rl.question("No MIDI Output found",a => {
        process.exit();
    });
}
let gap = 0;
let tempo = 0;
let newTempo = 0;
let tickCounter = 0;
let cursorPosition = 0;
let hasFirstMeasure = false;

for(let i=0;i<nbMidiDevices;i++) {
    console.log(i+" : "+output.getPortName(i));
    sleep(150);
}
rl.question("=> Choose MIDI Output (default: "+DEFAULT_MIDI_INDEX+") : ", paramMidiIndex => {
    let midiIndex = DEFAULT_MIDI_INDEX;
    if (paramMidiIndex == null || paramMidiIndex =="" || parseInt(paramMidiIndex) > (nbMidiDevices - 1)) {
        rl.question("=> Bad index for MIDI Output", a => {
            process.exit();
        });
    }

    midiIndex = parseInt(paramMidiIndex);
    output.openPort(midiIndex);
    let deviceName = output.getPortName(midiIndex);
    console.log("Using "+ deviceName);
    sleep(300);
    rl.question("=> Add gap (in ms) ?  [default:0] : ", paramGap => {
        if (paramGap != null && paramGap != "" && !isNaN(parseInt(paramGap))) {
            gap = parseInt(paramGap);
            console.log("Adding "+ gap+" ms of gap");
        }

        rl.question("=> Choose Websocket Port (Leave default value if you don't know what to choose)  [default:" + DEFAULT_PORT + "] : ", paramPort => {
            let websocketPort = DEFAULT_PORT;
            if (paramPort != null && paramPort != "") {
                websocketPort = parseInt(paramPort);
            }


            console.log("Creating socket server on port " + websocketPort + "...");
            const socket = new server({httpServer: http.createServer().listen(websocketPort, ()=>{
                    console.log("Socket server OK");
                    sleep(300);
                    console.log("Now open your browser to the following URL : https://www.tony-b.org/?ws_ports=" + websocketPort);
                })
            });

            socket.on('error', function(err) {
                console.error("Error: " + err.message);
            });

            sleep(1000);
            socket.on('request', (request) => {
                var connection = request.accept(null, request.origin);
                console.log("do_Ob Tony-b Machine is now connected through port " + websocketPort);

                //enable MIDI module
                connection.send(JSON.stringify({"on": "midi-clock-out"}));

                //output
                connection.on('message', (message) => {
                    let data = JSON.parse(message.utf8Data);
                    if (data["tempo"] != null) {//beat
                        newTempo = parseFloat(data["tempo"])
                        if(tempo == 0) {//first time
                            setTempo(newTempo);
                        }
                    }
                    if (data["measure"] != null) {//beat
                        //console.log("measure");
                        setMeasure();
                    }
                });
                sleep(1000);
                process.stdout.write(clc.reset);
            });
        });
    });
});


function setTempo(paramTempo) {
    tempo = paramTempo;
    let tickDurationMicroNano = Math.round(1000000000 * ((60 / tempo) / 24));
    process.stdout.write(clc.move.to(0,1));
    process.stdout.write(String(tempo).padStart(3, " ")+ " BPM");
    process.stdout.write(clc.move.to(cursorPosition,0));
    if (hasFirstMeasure) {
        timer.clearInterval();
        timer.setInterval(onTick, '', tickDurationMicroNano + 'n');
    }
}

function onTick() {
    output.sendMessage([MIDI_TICK]);
    if(newTempo != tempo) {//on attend le tick pour set le tempo
        setTempo(newTempo);
    }
    if (tickCounter % 24 == 0) {
        process.stdout.write("| ");
        cursorPosition += 2;
    }
    else if (tickCounter % 6 == 0) {
        process.stdout.write(". ");
        cursorPosition += 2;
    }
    tickCounter++;
}

function setMeasure() {
    hasFirstMeasure = true;
    cursorPosition = 0;
    if (gap == 0) {
        startMeasure();
    }
    else if (gap >0) {
        timer.setTimeout(startMeasure,'',gap+"m");
    } else if (gap<0) {
        let carrureTime = 1000 * (60/tempo) * 16;
        carrureTime += gap;
        timer.setTimeout(startMeasure,'',carrureTime+"m");
    }
}

function startMeasure() {
    output.sendMessage([MIDI_STOP]);
    output.sendMessage([MIDI_START]);
    let tickDurationMicroNano = Math.round(1e9 * ((60 / tempo) / 24));
    tickCounter = 0;
    process.stdout.write(clc.move.to(0,0));
    process.stdout.write(clc.erase.line);
    onTick();
    timer.clearInterval();
    timer.setInterval(onTick, '', tickDurationMicroNano + 'n');
}

function sleep(ms) {
    var start = Date.now(),
        now = start;
    while (now - start < ms) {
        now = Date.now();
    }
}