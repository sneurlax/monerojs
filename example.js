// const Monero = require('moneronodejs'); // Used when accessing class outside of library
const Monero = require('./index.js'); // Used when accessing class from within library

// Connect synchronously
// const daemonRPC = new Monero.daemonRPC();
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

// Autoconnect asynchronously (with a promise)
var daemonRPC = new Monero.daemonRPC({ autoconnect: true, random: true })
.then((daemon) => {
  daemonRPC = daemon;
  
  daemonRPC.getblockcount()
  .then(blocks => {
    console.log(blocks['count'] - 1);
  });
})
.catch((error) => {
  console.error(error);
});
