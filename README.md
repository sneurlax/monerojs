# Monero Library
A Monero library written in Node.js by the [Monero Integrations](https://monerointegrations.com) [team](https://github.com/sneurlax/moneronodejs/graphs/contributors).

[//]: # (Update contributors link to https://github.com/monero-integrations/moneronodejs/graphs/contributors if/when it is merged in)

**NOTE:** due to the existence of the [`monero-nodejs` package by PsychicCat](https://github.com/PsychicCat/monero-nodejs), `moneronodejs` will never be publishable on npm.  Thus, this repository is being finalized, archived, and continued as [`monerojs`](https://github/com/sneurlax/monerojs).  If the Monero Integrations team will merge this into [monero-ingtegrations/moneronodejs](https://github.com/monero-integrations/moneronodejs) then it will be revived and updated as needed, otherwise please refer to [`monerojs`](https://github/com/sneurlax/monerojs) for the latest code and best features.

[//]: # (Update monerojs repository link to https://github.com/monero-integrations/monerojs if/when it is merged in)

## How It Works
This library has two main parts: a Monero daemon JSON RPC API wrapper, `daemonRPC.js`, and a Monero wallet (`monero-wallet-rpc`) JSON RPC API wrapper, `walletRPC.js`.

## Configuration
### Requirements
 - Node.js

*Monero daemon now optional!*

## Installation
```bash
npm install monerojs
```
*`--save` optional*

## Usage

This library wraps Monero RPC methods in promises.  It can also autoconnect.  Here's an example of using the autoconnection feature:

```js
const Monero = require('monerojs');

var daemonRPC = new Monero.daemonRPC({ autoconnect: true })
.then((daemon) => {
  daemonRPC = daemon;
  
  daemonRPC.getblockcount()
    .then(blocks => {
      console.log(blocks);
    });
  })
  .catch((err) => {
    console.error(err);
  });
```

Here's an example of connecting to a specific Monero daemon synchronously:

```js
// const daemonRPC = new Monero.daemonRPC(); // Connect with defaults
// const daemonRPC = new Monero.daemonRPC('127.0.0.1', 28081, 'user', 'pass', 'http'); // Example of passing in parameters
// const daemonRPC = new Monero.daemonRPC({ port: 28081, protocol: 'https'); // Parameters can be passed in as an object/dictionary
const daemonRPC = new Monero.daemonRPC({ hostname: '127.0.0.1', port: 28081 });

daemonRPC.getblockcount()
.then(height => {
  console.log(height);
});

const walletRPC = new Monero.walletRPC();

walletRPC.create_wallet('monero_wallet', '')
.then(new_wallet => {
  walletRPC.open_wallet('monero_wallet', '')
  .then(wallet => {
    walletRPC.getaddress()
    .then(balance => {
      console.log(balance);
    });
  });
});
```
