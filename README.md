# `monerojs`
A Monero library written in ES6 JavaScript

This library has two main parts: a Monero daemon (`monerod`) JSON-RPC API wrapper, `daemonRPC.js`, and a Monero wallet (`monero-wallet-rpc`) JSON-RPC API wrapper, `walletRPC.js`.

## Configuration
### Requirements
 - Node.js
 - A Monero node (remote nodes support most, but not all, methods.)

## Installation
```bash
npm install monerojs
```
*`--save` optional*

## Usage

This library wraps Monero RPC interfaces and methods in promises.  It can also autoconnect.  Here's an example of using the autoconnection feature:

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
