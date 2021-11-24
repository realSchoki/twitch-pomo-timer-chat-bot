require('dotenv').config()
const tmi = require('tmi.js');
const schedule = require('node-schedule');
const http = require("http");
const url = require('url') 

if(!(USERNAME in process.env) || !(PASSWORD in process.env) || !(CHANNEL in process.env)){
  console.error(`Parameter not set correctly...`)
  process.exit(1)
}

const PORT = process.env.PORT || 5000;
const DEBUG = process.env.DEBUG || false;


var timers = {} // channel: string, username: string -> { createdAt: timestamp, time: number, topic: string }

const server = http.createServer(async (req, res) => {
    //set the request route
    const { pathname, query } = url.parse(req.url, true)

    if (pathname === "/" && req.method === "GET" && query["channel"] in timers) {
        //response headers
        res.writeHead(200, { "Content-Type": "text/plain" });
        //set the response
        result = Object.keys(timers[query["channel"]])
            .map( user => [
                user, 
                timers[query["channel"]][user].topic, 
                Math.ceil((timers[query["channel"]][user].createdAt + timers[query["channel"]][user].time * 1000 * 60 - Date.now()) / 1000 / 60)
            ])
            .map( ([user, topic, reminder]) => `${user} is working on '${topic}', ${reminder}  minutes left`).join(" +++ ");
        res.write(result);
        //end the response
        res.end();
    }
    
    if (pathname === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.write("OK");
        res.end();
    }

    // If no route present
    else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Route not found" }));
    }
});

server.listen(PORT, () => {
    console.log(`server started on port: ${PORT}`);
});

const job = schedule.scheduleJob('*/10 * * * * *', function(){
    Object.keys(timers)
    .flatMap( channel => Object.keys(timers[channel])
        .map( user => [channel, user, timers[channel][user].createdAt, timers[channel][user].time])
        .filter( obj => obj[2] + obj[3] * 1000 * 60 - Date.now() <= 0)
    ).forEach( obj => {
        client.say(obj[0], `@${obj[1]}, you've finished your work session. Good job! Enjoy your break :3` )
        delete timers[obj[0]][obj[1]]
    })
  });

// Define configuration options
const opts = {
  identity: {
    username: process.env.USERNAME,
    password: process.env.PASSWORD
  },
  channels: [
    process.env.CHANNEL
  ],
  options: {
    debug: DEBUG
  }
};

// Create a client with our options
const client = new tmi.client(opts);


function addChannel(channel) {
    if(!(channel in timers)){
        timers[channel] = []
    }
}

function addTimer(channel, username, time, topic) {
    if(channel in timers && !(username in timers[channel])){
        timers[channel][username] = { time, topic, createdAt: Date.now() }
        client.say(channel, `@${username} starts to work on ${topic} for ${time} minutes. Good luck!`)
    } else if (channel in timers) {
        client.say(channel, `@${username}, you've already have set up a timer`)
    } else {
        client.say(channel, `channel ${channel} is not set up, please talk with your broadcaster`)
    }
}

function cancelTimer(channel, username) {
    if(channel in timers && username in timers[channel]){
        var topic = timers[channel][username].topic
        delete timers[channel][username]
        client.say(channel, `@${username} timer for ${topic} stopped.`)
    } else {
        client.say(channel, `@${username}, you don't have set up a timer`)
    }
}

function checkTimer(channel, username) {
    if(channel in timers && username in timers[channel]){
        var reminder = Math.ceil((timers[channel][username].createdAt + timers[channel][username].time * 1000 * 60 - Date.now()) / 1000 / 60)
        client.say(channel, `@${username} there're ${reminder} minutes left on you current session. Stay focused, you can do it! :D`)
    } else {
        client.say(channel, `@${username}, you don't have set up a timer`)
    }
}

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called every time a message comes in
function onMessageHandler (channel, tags, msg, self) {
  if (self) { return; } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  if (commandName === '!pomo') {
    client.say(channel, `@${tags.username} if you want to start your own work timer type !pomo [number] [topic] to set a single timer. Use !pomo cancel to stop it.`);
  } else if (commandName === '!pomo check') {
    checkTimer(channel, tags.username)
  } else if (commandName === '!pomo cancel') {
    cancelTimer(channel, tags.username)
  } else if (commandName.startsWith('!pomo ') && commandName.split(/\w+/i).length >= 3){
    cmd = commandName.split(/\s+/i);
    addChannel(channel)
    addTimer(channel, tags.username, Number(cmd[1]), cmd.slice(2).join(' '))
  }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

