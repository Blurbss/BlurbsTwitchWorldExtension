var https = require('https');
const fs = require('fs');
const Hapi = require('@hapi/hapi');
const path = require('path');
const Boom = require('boom');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');
const WebSocket = require('ws');
const request = require('request');
const wss = new WebSocket.Server({ port: 8008 },()=>{
    console.log('server started')
})
let ws = null;
const serverTokenDurationSec = 30;          // our tokens for pubsub expire after 30 seconds
// const request = require('request');

// The developer rig uses self-signed certificates.  Node doesn't accept them
// by default.  Do not use this in production.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use verbose logging during development.  Set this to false for production.
const verboseLogging = true;
const verboseLog = verboseLogging ? console.log.bind(console) : () => { };

// Service state variables
const bearerPrefix = 'Bearer ';             // HTTP authorization headers have this prefix
var votes = {};
var ballots = 0;
var round = 0;
var locked = false;

//STUFF FOR AFK WIDGET
var flotsamPull = false;
var blurbsPull = false;

const STRINGS = {
  secretEnv: usingValue('secret'),
  clientIdEnv: usingValue('client-id'),
  serverStarted: 'Server running at %s',
  secretMissing: missingValue('secret', 'EXT_SECRET'),
  clientIdMissing: missingValue('client ID', 'EXT_CLIENT_ID'),
  cyclingColor: 'Cycling color for c:%s on behalf of u:%s',
  sendColor: 'Sending color %s to c:%s',
  invalidAuthHeader: 'Invalid authorization header',
  invalidJwt: 'Invalid JWT',
  vote: 'adding vote'
};

ext.
  version(require('../package.json').version).
  option('-s, --secret <secret>', 'Extension secret').
  option('-c, --client-id <client_id>', 'Extension client ID').
  parse(process.argv);


  wss.on('connection', function connection(wsocket) {
    ws = wsocket;
    ws.on('message', (data) => {
       console.log('data received \n %o',data)
       let lock = data.includes("LOCK");
       if (data == "ChoicePls")
        tallyVotes(true);
       if (data == "StatusPls")
        tallyVotes(false, lock);
    })
  })
  wss.on('listening',()=>{
    console.log('listening on 8008')
  })

const key = "Q2jjgE2Vg2l9+wj6GjHYxbM794h56EpScW4cstkJShw=";//Buffer.from(getOption('secret', 'ENV_SECRET'), 'base64');
const secret = Buffer.from(key, 'base64');
const ownerId = '48566375';
const clientId = getOption('clientId', 'ENV_CLIENT_ID');
const serverOptions = {
  host: 'localhost',
  port: 8081,
  routes: {
    cors: {
      origin: [
        'https://28lg0adwdxpa06vtsq2kekkml5ahvs.ext-twitch.tv',
        'https://*.ext-twitch.tv',
        'https://api.twitch.tv',
        'wss://pubsub-edge.twitch.tv',
        'https://streamelements.com',
        'null'
        //'*'
      ]
    }
  }
};
const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'extension1');
console.log(serverPathRoot);
if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) {
  console.log("CERTIFICATE EXISTS");
  serverOptions.tls = {
    // If you need a certificate, execute "npm run cert".
    cert: fs.readFileSync(serverPathRoot + '.crt'),
    key: fs.readFileSync(serverPathRoot + '.key')
  };
}
const server = new Hapi.Server(serverOptions);
(async () => {
  server.route({
    method: 'GET',
    path: '/test',
    handler: helloWorldHandler
  });
  server.route({
    method: 'GET',
    path: '/round',
    handler: getRoundHandler
  });
  server.route({
    method: 'GET',
    path: '/chatters/{user}',
    handler: getChattersHandler
  });
  server.route({
    method: 'GET',
    path: '/time/{user}',
    handler: getTimeHandler
  });
  server.route({
    method: 'GET',
    path: '/pull/{user}',
    handler: getPullHandler
  });
  server.route({
    config: {
        cors: {
            origin: [
              'https://28lg0adwdxpa06vtsq2kekkml5ahvs.ext-twitch.tv',
              'https://*.ext-twitch.tv',
              'https://api.twitch.tv',
              'wss://pubsub-edge.twitch.tv',
              'https://streamelements.com',
              'null'
              //'*'
            ],
            additionalHeaders: ['cache-control', 'x-requested-with']
        }
    },
    method: 'POST',
    path: '/vote',
    handler: setVoteHandler
  });
  // Start the server.
await server.register({
  plugin: require('hapi-rate-limit'),
  options: {
    enabled: true,
    userLimit: 5,
    userCache: {
      segment: 'hapi-rate-limit-user',
      expiresIn: 5000
    }
  }
});
  await server.start();
  console.log(STRINGS.serverStarted, server.info.uri);
})();

//setInterval(tallyVotes, 5000);

function tallyVotes(reset = false, lock = false) {
  locked = lock;
  
  let votesSorted = [];
  let max = 0;
  let keys = Object.keys(votes);

  for (let i = 0;i < keys?.length;i++) {
    let cell = keys[i];
    votesSorted.push({key: cell, value: votes[cell]});
  }

  votesSorted.sort((a, b) => a.value < b.value ? 1 : a.value > b.value ? -1 : 0);
  let choices = votesSorted.slice(0, 3).map(x => {
    let percentage = ((x.value / ballots) * 100).toFixed(2);
    return {Key: x.key, Value: percentage};
  });

  if (choices[0] == null)
    choices[0] = {Key: "test1", Value: 0};
  if (choices[1] == null)
    choices[1] = {Key: "test2", Value: 0};
  if (choices[2] == null)
    choices[2] = {Key: "test3", Value: 0};
  let data = {
    choices: choices,
    //percentage: percentage,
    final: reset,
    locked: lock
  };

  console.log("CHOICE: " + choices);

  if (reset)
  {
    round++;
    console.log("RESETTING VOTES");
    votes = {};
    ballots = 0;
    sendBroadcast('48566375', null);
  }
  else
    sendBroadcast('48566375', choices);

  if (ws && choices[0] != "")
    ws.send(JSON.stringify(data));
  else
    console.log("ERROR: WS is null or no choice selected");
}

function usingValue (name) {
  return `Using environment variable for ${name}`;
}

function missingValue (name, variable) {
  const option = name.charAt(0);
  return `Extension ${name} required.\nUse argument "-${option} <${name}>" or environment variable "${variable}".`;
}

// Get options from the command line or the environment.
function getOption (optionName, environmentName) {
  const option = (() => {
    if (ext[optionName]) {
      console.log(optionName + ": " + ext[optionName]);
      return ext[optionName];
    } else if (process.env[environmentName]) {
      console.log(STRINGS[optionName + 'Env']);
      return process.env[environmentName];
    }
    console.log(STRINGS[optionName + 'Missing']);
    process.exit(1);
  })();
  console.log(`Using "${option}" for ${optionName}`);
  return option;
}

// Verify the header and the enclosed JWT.
function verifyAndDecode (header) {
  if (header.startsWith(bearerPrefix)) {
    try {
      const token = header.substring(bearerPrefix.length);
      console.log(token);
      var x = jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] });
      console.log(x);
      return x;
    }
    catch (ex) {
      console.log("EXCEPTION: " + ex);
      throw Boom.unauthorized(STRINGS.invalidJwt);
    }
  }
  console.log("UNAUTHORIZED");
  throw Boom.unauthorized(STRINGS.invalidAuthHeader);
}

function setVoteHandler (req) {
  if (locked)
    return "Voting locked for end of this round";
  verifyAndDecode(req.headers.authorization); //AUTH
  let vote = req.payload.vote;
  let roundVoted = req.payload.round;
  if (roundVoted < round)
    return "Late vote discarded";
  console.log("VOTE: " + vote);
  let count = votes[vote];
  votes[vote] = Number.isInteger(count) ? count + 1 : 1;
  console.log(votes);
  ballots++;
  return "Vote succesful!";
}

function helloWorldHandler (req) {
  console.log("HELLO WORLD");
  return "Hello World!";
}

function getRoundHandler (req) {
  return round;
}

function getChattersHandler(req) {
  var settings = {
      host: 'tmi.twitch.tv',
      path: '/group/user/' + req.params.user + '/chatters'
  };
  return new Promise((resolve) => {
    const request = https.request(settings, res => {
      let str = '';
      res.on('data', d => {
        str += d;
      });

      res.on('end', function() {
        resolve(JSON.parse(str).chatters.viewers);
      });
    });

    request.end();
  });
}

function getPullHandler(req) {
  let user = req.params.user.toLowerCase();
  if (user == "blurbs")
    blurbsPull = true;
  if (user == "flotsam")
    flotsamPull = true;

  return "Next update will pull name";
}

function getTimeHandler(req) {
  let user = req.params.user.toLowerCase();
  if (user == "blurbs")
  {
    let pull = blurbsPull;
    blurbsPull = false;
    console.log(pull);

    return pull;
  }
  if (user == "flotsam")
  {
    let pull = flotsamPull;
    flotsamPull = false;
    console.log(pull);

    return pull;
  }

  return false;
}

function sendBroadcast(channelId, choices) {
  // Set the HTTP headers required by the Twitch API.
  const headers = {
    'Client-ID': clientId,
    'Content-Type': 'application/json',
    'Authorization': bearerPrefix + makeServerToken(channelId),
  };

  let message = "";
  if (choices == null)
    message = `newRound${round}`;
  else
    message = `statusUpdate${choices.map(x => `${x.Key + x.Value.toString()}%`).join("")}`;

  // Create the POST body for the Twitch API request.
  const body = JSON.stringify({
    content_type: 'application/json',
    message: message,
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  console.log("SENDING PUBSUB");
  request(
    `https://api.twitch.tv/extensions/message/${channelId}`,
    {
      method: 'POST',
      headers,
      body,
    }
    , (err, res) => {
      if (err) {
        console.log(STRINGS.messageSendError, channelId, err);
      } else {
        verboseLog(STRINGS.pubsubResponse, channelId, res.statusCode);
      }
    });
}

// Create and return a JWT for use by this service.
function makeServerToken(channelId) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
    channel_id: channelId,
    user_id: ownerId, // extension owner ID for the call to Twitch PubSub
    role: 'external',
    pubsub_perms: {
      send: ['*'],
    },
  };
  return jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' });
}
/* 
function userIsInCooldown(opaqueUserId) {
  // Check if the user is in cool-down.
  const cooldown = userCooldowns[opaqueUserId];
  const now = Date.now();
  if (cooldown && cooldown > now) {
    return true;
  }

  // Voting extensions must also track per-user votes to prevent skew.
  userCooldowns[opaqueUserId] = now + userCooldownMs;
  return false;
} */


