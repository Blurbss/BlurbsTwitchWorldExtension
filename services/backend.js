const fs = require('fs');
const Hapi = require('@hapi/hapi');
const path = require('path');
const Boom = require('boom');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8008 },()=>{
    console.log('server started')
})
let ws = null;
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
       if (data == "ChoicePls")
        tallyVotes(true);
      if (data == "StatusPls")
        tallyVotes(false);
    })
  })
  wss.on('listening',()=>{
    console.log('listening on 8008')
  })

const key = "Q2jjgE2Vg2l9+wj6GjHYxbM794h56EpScW4cstkJShw=";//Buffer.from(getOption('secret', 'ENV_SECRET'), 'base64');
const secret = Buffer.from(key, 'base64');
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
        'wss://pubsub-edge.twitch.tv'
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
    config: {
        cors: {
            origin: ['*'],
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

function tallyVotes(reset = false) {
  let choice = "";
  let max = 0;
  let keys = Object.keys(votes);
  let percentage = 0;

  for (let i = 0;i < keys?.length;i++) {
    let key = keys[i];
    let value = votes[key];
    if (value > max) {
      max = value;
      choice = key;
    }
  }

  percentage = ((max / ballots) * 100).toFixed(2);
  let data = {
    choice: choice,
    percentage: percentage,
    final: reset
  };

  console.log("CHOICE: " + choice);

  if (reset)
  {
    round++;
    console.log("RESETTING VOTES");
    votes = {};
    ballots = 0;
  }

  if (ws && choice != "")
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
  //verifyAndDecode(req.headers.authorization); //AUTH
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
