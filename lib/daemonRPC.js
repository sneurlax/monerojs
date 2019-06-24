/**
 * monerojs/daemonRPC
 * 
 * A class for making calls to a Monero daemon's RPC API using Node.js
 * https://github.com/monerojs/monerojs
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

const request = require('request-promise-native'); // TODO eliminate external dependency
const http = require('http');

/**
 * @class daemonRPC
 * @param {string} hostname - RPC hostname
 * @param {number} port - RPC port
 * @param {string} user - RPC username
 * @param {string} pass - RPC password
 * @param {string} protocol - RPC protocol
 * @param {string} network - Monero network to connect to (default: 'mainnet')
 *
 *   OR
 *
 * @param {object} params - The same parameters above in any order as an object/dictionary
 *
 *   OR
 *
 * @param {object} params - Use autoconnect: true to autoconnect to a daemon from daemons.json and optionally random: true to connect to one randomly 
 *
 * @returns {promise} resolve, reject
 * @resolves {class} walletRPC
 */
class daemonRPC {
  constructor(hostname = '127.0.0.1', port = 18081, user = undefined, pass = undefined, protocol = 'http', network = 'mainnet') {
    return new Promise((resolve, reject) => {
      this.daemons = require('./remote-daemons.json');

      this.local = false;
      this.remote = false;

      if (typeof hostname == 'object') { // parameters can be passed in as object/dictionary
        let params = hostname;

        this.hostname = params['hostname'] || '127.0.0.1';
        this.port = params['port'] || port;
        this.user = params['user'] || user;
        this.pass = params['pass'] || pass;
        this.protocol = params['protocol'] || protocol;
        this.network = params['network'] || network;

        if (this.network in this.daemons) {
          this.daemons = this.daemons[this.network];
        } else {
          throw new Error(`No ${this.network} remote daemons found in list`);
          this.daemons = this.daemons['mainnet'];
        }

        // if ('daemons' in params) {
        //   // TODO set list of daemons from passed parameter, local file import, or HTTP/HTTPS URL
        // }

        if ('autoconnect' in params) {
          if (params['autoconnect']) { // TODO add mainnet/testnet toggle
            if ('random' in params) {
              // Fisher-Yates Shuffle  
              let i = 0,
                  j = 0,
                  temp = null;

              for (i = this.daemons.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1));
                temp = this.daemons[i];
                this.daemons[i] = this.daemons[j];
                this.daemons[j] = temp;
              }
            }

            let daemonsLocal = require('./local-daemons.json'); // local mainnet and testnet daemons
            if (this.network in daemonsLocal) {
              daemonsLocal = daemonsLocal[this.network];
            } else {
              throw new Error(`No ${this.network} local daemons found in list`);
              daemonsLocal = daemonsLocal['mainnet'];
            }
            this.daemons.unshift(...daemonsLocal); // Put common local monerod addresses and ports at the front of the list of daemons to try 
            // TODO add this by default unless eg. --nolocal flag

            // Try the passed daemon first
            if ('hostname' in params) {
              this.daemons.unshift({ hostname: this.hostname, port: this.port, protocol: this.protocol, user: this.user, pass: this.pass });
            }

            return this._autoconnect()
            .then(daemon => {
              if (daemon.hasOwnProperty('local'))
                this.local = daemon['local'];
              if (daemon.hasOwnProperty('remote'))
                this.remote = daemon['remote'];
              resolve(this);
            })
            .catch(err => {
              reject(err);
            });
          }
        }
      } else {
        this.hostname = hostname;
        this.port = port;
        this.user = user;
        this.pass = pass;
        this.protocol = protocol;
        this.network = network;

        // TODO set this.local and/or this.remote appropriately
      }

      return this._autoconnect([{
        hostname: this.hostname,
        port: this.port,
        user: this.user,
        pass: this.pass,
        protocol: this.protocol
      }])
      .then(daemon => {
        resolve(this);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Autoconnect to a local or remote daemon
   * 
   * @function _autoconnect
   * @param {array} daemons - Array of daemon objects
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   hostname: '127.0.0.1',
   *   port: 28081,
   *   protocol: 'http'
   * }
   */
  _autoconnect(daemons = this.daemons) {
    return new Promise((resolve, reject) => {
      let daemon = daemons.shift();

      this._test(daemon)
      .then(() => {
        this.hostname = daemon['hostname'];
        this.port = daemon['port'];
        this.protocol = daemon['protocol'];
        if ('user' in daemon)
          this.user = daemon['user'];
        if ('pass' in daemon)
          this.pass = daemon['pass'];
        if ('network' in daemon)
          this.network = daemon['network'];
        resolve(daemon);
      })
      .catch(() => {
        if (daemons.length > 0) {
          this._autoconnect(daemons)
          .then(daemon => { // TODO add daemon type
            resolve(daemon);
          })
          .catch(err => {
            reject('Failed to autoconnect to daemon', err);
          });
        } else {
          reject('Failed to autoconnect to daemon');
        }
      });
    });
  }

  /**
   * Test a local or remote Monero RPC API for accessibility
   *
   * @function _test
   * @param {string} hostname - RPC hostname
   * @param {string} port - RPC port
   * @param {string} user - RPC user
   * @param {string} pass - RPC pass
   * @param {string} protocol - RPC protocol
   *
   *   OR
   *
   * @param {object} params - The same parameters above in any order as an object/dictionary
   *
   * @return {promise} resolve, reject
   * @resolves {object} - Example: {
   *   hostname: '127.0.0.1',
   *   port: 28081,
   *   protocol: 'http'
   * }
   */
  _test(hostname = this.hostname, port = this.port, user = this.user, pass = this.pass, protocol = this.protocol) {
    if (typeof hostname == 'object') {
      let params = hostname;

      hostname = params['hostname'] || this.hostname;
      port = params['port'] || port || this.port;
      user = params['user'] || user || this.user;
      pass = params['pass'] || pass || this.pass;
      protocol = params['protocol'] || protocol || this.protocol;
    }
    let options = {
      json: {
        jsonrpc: '2.0',
        id: '0',
        method: 'getblockcount'
      },
      agent: new http.Agent({
        keepAlive: true,
        maxSockets: 1
      })
    };

    if (user) {
      options['forever'] = true;
      options['auth'] = {
        user: user,
        pass: pass,
        sendImmediately: false
      };
    }

    return new Promise((resolve, reject) => {
      // console.info(`Testing ${protocol}://${hostname}:${port}...`);
      return request.post(`${protocol}://${hostname}:${port}/json_rpc`, options)
      .then(result => {
        resolve({
          hostname: this.hostname,
          port: this.port,
          user: this.user,
          pass: this.pass,
          protocol: this.protocol
        }); // TODO test with authenticated endpoints
      })
      .catch(err => {
        reject();
      });
    });
  }

  /**
   * Execute command on the Monero RPC API
   *
   * @function _run
   * @param {string} method - RPC method to call
   * @param {ojbect} params - Options to include (optional)
   *
   * @returns {promise} resolve, reject resolve, reject
   * @resolves {object} - Method result, possibly including error object
   */
  _run(method = null, params = undefined, extension = 'json_rpc') {
    let options = {
      agent: new http.Agent({
        keepAlive: true,
        maxSockets: 1
      })
    };

    if (extension == 'json_rpc') { // Standard method
      options = {
        json: {
          jsonrpc: '2.0',
          id: '0',
          method: method,
          params: params
        }
      };
    } else { // "Other" method
      options = {
        json: params
      };
    }

    if (this.user) {
      options['forever'] = true;
      options['auth'] = {
        user: this.user,
        pass: this.pass,
        sendImmediately: false
      };
    }

    return request.post(`${this.protocol}://${this.hostname}:${this.port}/${extension}`, options)
    .then(result => {
      if (result['result']) {
        return result['result'];
      } else {
        return result;
      }
    })
    .catch(err => {
      throw new Error(err);
    });
  }

  /**
   * Look up how many blocks are in the longest chain known to the node
   *
   * @function getblockcount
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {  
   *   count: 993163,  
   *   status: 'OK'  
   * }  
   */
  getblockcount() {
    return this._run('getblockcount');
  }
  
  /**
   * Alias of getblockcount
   */
  get_block_count() {
    return this._run('get_block_count');
  }
  

  /**
   * Look up a block's hash by its height
   *
   * @function on_getblockhash
   * @param {array} height - Height of block to look up 
   *
   * @return string  Example: '4aff3d3f2a939ddf7c971b57b428841bccde6dc937404346398c4133ba37359b'
   */
  on_getblockhash(height) {
    if (typeof height == 'undefined') {
      throw new Error('Error: Height required');
    }

    let params = [+height];

    return this._run('on_getblockhash', params);
  }
  
  /**
   * Alias of on_getblockhash
   */
  on_get_block_hash(height) {
    return this.on_getblockhash(height);
  }

  /**
   * Retrieve a block template that can be mined upon
   *
   * @function getblocktemplate
   * @param {string} wallet_address - Address of wallet to receive coinbase transactions if block is successfully mined
   * @param {int} reserve_size - Reserve size 
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   blocktemplate_blob: '01029af88cb70568b84a11dc9406ace9e635918ca03b008f7728b9726b327c1b482a98d81ed83000000000018bd03c01ffcfcf3c0493d7cec7020278dfc296544f139394e5e045fcda1ba2cca5b69b39c9ddc90b7e0de859fdebdc80e8eda1ba01029c5d518ce3cc4de26364059eadc8220a3f52edabdaf025a9bff4eec8b6b50e3d8080dd9da417021e642d07a8c33fbe497054cfea9c760ab4068d31532ff0fbb543a7856a9b78ee80c0f9decfae01023ef3a7182cb0c260732e7828606052a0645d3686d7a03ce3da091dbb2b75e5955f01ad2af83bce0d823bf3dbbed01ab219250eb36098c62cbb6aa2976936848bae53023c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f12d7c87346d6b84e17680082d9b4a1d84e36dd01bd2c7f3b3893478a8d88fb3',
   *   difficulty: 982540729,
   *   height: 993231,
   *   prev_hash: '68b84a11dc9406ace9e635918ca03b008f7728b9726b327c1b482a98d81ed830',
   *   reserved_offset: 246,
   *   status: 'OK'
   * }
   */
  getblocktemplate(wallet_address, reserve_size) {
    if (typeof wallet_address == 'undefined') {
      throw new Error('Error: Wallet address required');
    }
    if (typeof reserve_size == 'undefined') {
      throw new Error('Error: Reserve size required');
    }
    
    let params = {
      wallet_address: wallet_address,
      reserve_size: reserve_size,
      decode_as_json: true
    };

    return this._run('getblocktemplate', params);
  }
  
  /**
   * Alias of getblocktemplate
   */
  get_block_template(wallet_address, reserve_size) {
    return this.getblocktemplate(wallet_address, reserve_size);
  }

  /**
   * Submit a mined block to the network
   *
   * @function submitblock
   * @param {array} block - Array of block blob data strings
   *
   * @return object - Example: // TODO: example
   */
  submitblock(block) {
    if (typeof block == 'undefined') {
      throw new Error('Error: Block blob required');
    }

    return this._run('submitblock', block);
  }
  
  /**
   * Alias of submitblock
   */
  submit_block(block) {
    return this.submitblock([block]);
  }

  /**
   * Generate blocks (not available on mainnet)
   *
   * @function generateblocks
   * @param {string} wallet_address - Address of wallet to receive coinbase transactions if block is successfully mined
   * @param {number} reserve_size - Reserve size 
   * @param {number} amount_of_blocks - Number of blocks to generate (default: 1)
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   blocktemplate_blob: '01029af88cb70568b84a11dc9406ace9e635918ca03b008f7728b9726b327c1b482a98d81ed83000000000018bd03c01ffcfcf3c0493d7cec7020278dfc296544f139394e5e045fcda1ba2cca5b69b39c9ddc90b7e0de859fdebdc80e8eda1ba01029c5d518ce3cc4de26364059eadc8220a3f52edabdaf025a9bff4eec8b6b50e3d8080dd9da417021e642d07a8c33fbe497054cfea9c760ab4068d31532ff0fbb543a7856a9b78ee80c0f9decfae01023ef3a7182cb0c260732e7828606052a0645d3686d7a03ce3da091dbb2b75e5955f01ad2af83bce0d823bf3dbbed01ab219250eb36098c62cbb6aa2976936848bae53023c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f12d7c87346d6b84e17680082d9b4a1d84e36dd01bd2c7f3b3893478a8d88fb3',
   *   difficulty: 982540729,
   *   height: 993231,
   *   prev_hash: '68b84a11dc9406ace9e635918ca03b008f7728b9726b327c1b482a98d81ed830',
   *   reserved_offset: 130,
   *   status: 'OK'
   * }
   */
  generateblocks(wallet_address, reserve_size, amount_of_blocks = 1) {
    if (typeof wallet_address == 'undefined') {
      throw new Error('Error: Wallet address required');
    }
    if (typeof reserve_size == 'undefined') {
      throw new Error('Error: Reserve size required');
    }
    
    let params = {
      wallet_address: wallet_address,
      reserve_size: reserve_size,
      amount_of_blocks: amount_of_blocks,
      decode_as_json: true
    };

    return this._run('getblocktemplate', params);
  }

  /**
   * Block header information for the most recent block is easily retrieved with this method
   *
   * @function getlastblockheader
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   block_header: {
   *     depth: 0,
   *     difficulty: 746963928,
   *     hash: 'ac0f1e226268d45c99a16202fdcb730d8f7b36ea5e5b4a565b1ba1a8fc252eb0',
   *     height: 990793,
   *     major_version: 1,
   *     minor_version: 1,
   *     nonce: 1550,
   *     orphan_status: false,
   *     prev_hash: '386575e3b0b004ed8d458dbd31bff0fe37b280339937f971e06df33f8589b75c',
   *     reward: 6856609225169,
   *     timestamp: 1457589942
   *   },
   *   status: 'OK'
   * }
   */
  getlastblockheader() {
    return this._run('getlastblockheader');
  }
  
  /**
   * Alias of get_last_block_header
   */
  getlastblockheader() {
    return this._run('getlastblockheader');
  }

  /**
   * Block header information can be retrieved using either a block's hash or height
   *
   * @function getblockheaderbyhash
   * @param {string} hash - The block's SHA256 hash
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   block_header: {
   *     depth: 78376,
   *     difficulty: 815625611,
   *     hash: 'e22cf75f39ae720e8b71b3d120a5ac03f0db50bba6379e2850975b4859190bc6',
   *     height: 912345,
   *     major_version: 1,
   *     minor_version: 2,
   *     nonce: 1646,
   *     orphan_status: false,
   *     prev_hash: 'b61c58b2e0be53fad5ef9d9731a55e8a81d972b8d90ed07c04fd37ca6403ff78',
   *     reward: 7388968946286,
   *     timestamp: 1452793716
   *   },
   *   status: 'OK'
   * }
   */
  getblockheaderbyhash(hash) {
    if (typeof hash == 'undefined') {
      throw new Error('Error: Block hash required');
    }
    
    let params = { hash: hash };

    return this._run('getblockheaderbyhash', params);
  }
  
  /**
   * Alias of getblockheaderbyhash
   */
  get_block_header_by_hash(hash) {
    return this.getblockheaderbyhash(hash);
  }

  /**
   * Similar to getblockheaderbyhash() above, this method includes a block's height as an input parameter to retrieve basic information about the block
   *
   * @function getblockheaderbyheight
   * @param {int} height - The block's height
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   block_header: {
   *     depth: 78376,
   *     difficulty: 815625611,
   *     hash: 'e22cf75f39ae720e8b71b3d120a5ac03f0db50bba6379e2850975b4859190bc6',
   *     height: 912345,
   *     major_version: 1,
   *     minor_version: 2,
   *     nonce: 1646,
   *     orphan_status: false,
   *     prev_hash: 'b61c58b2e0be53fad5ef9d9731a55e8a81d972b8d90ed07c04fd37ca6403ff78',
   *     reward: 7388968946286,
   *     timestamp: 1452793716
   *   },
   *   status: 'OK'
   * }
   */
  getblockheaderbyheight(height) {
    if (typeof height == 'undefined') {
      throw new Error('Error: Block height required');
    }
    
    let params = { height: +height };

    return this._run('getblockheaderbyheight', params);
  }
  
  /**
   * Alias of getblockheaderbyheight
   */
  get_block_header_by_height(height) {
    return this.getblockheaderbyheight(height);
  }

  /**
   * Similar to getblockheaderbyheight() above, this method includes a range of block heights as input parameters to retrieve basic information about the block
   *
   * @function getblockheaderbyheight
   * @param {int} start_height - The starting block's height
   * @param {int} end_height - The ending block's height
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   headers: [
   *     {
   *       block_size: 237,
   *       depth: 142814,
   *       difficulty: 1330,
   *       hash: 'c0cf8bbff7bf84f1efa448394bd64b52a36f9f30ff56efb2f6c0302f7680ee3e',
   *       height: 102,
   *       major_version: 1,
   *       minor_version: 8,
   *       nonce: 183264739,
   *       num_txes: 0,
   *       orphan_status: false,
   *       prev_hash: 'c14cde51b4c70627895946d6dad04442e608a3de026b863209fa47cca74638b9',
   *       reward: 17590474850797,
   *       timestamp: 1518938397
   *     },
   *     ...
   *   ],
   *   status: 'OK'
   * }
   */
  getblockheadersrange(start_height, end_height) {
    if (typeof start_height == 'undefined') {
      throw new Error('Error: Start block height required');
    }
    if (typeof end_height == 'undefined') {
      throw new Error('Error: End block height required');
    }
    
    let params = {
      start_height: +start_height,
      end_height: +end_height,
      decode_as_json: true
    };

    return this._run('getblockheadersrange', params);
  }
  
  /**
   * Alias of getblockheadersrange
   */
  get_block_headers_range(start_height, end_height) {
    return this.get_block_headers_range(start_height, end_height);
  }

  /**
   * Get block information by its SHA256 hash
   *
   * @function getblock_by_hash
   * @param {string} hash - The block's SHA256 hash
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   blob: '..."'
   *   block_header: {
   *     depth: 12,
   *     difficulty: 964985344,
   *     hash: '510ee3c4e14330a7b96e883c323a60ebd1b5556ac1262d0bc03c24a3b785516f',
   *     height: 993056,
   *     major_version: 1,
   *     minor_version: 2,
   *     nonce: 2036,
   *     orphan_status: false,
   *     prev_hash: '0ea4af6547c05c965afc8df6d31509ff3105dc7ae6b10172521d77e09711fd6d',
   *     reward: 6932043647005,
   *     timestamp: 1457720227
   *   },
   *   json: '..."'
   *   status: 'OK'
   * }
   */
  getblock_by_hash(hash) {
    let params = { hash: hash };

    return this._run('getblock', params);
  }

  /**
   * Get block information by its height
   *
   * @function getblock_by_height
   * @param {int} height - The block's height
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   blob: '..."'
   *   block_header: {
   *     depth: 80694,
   *     difficulty: 815625611,
   *     hash: 'e22cf75f39ae720e8b71b3d120a5ac03f0db50bba6379e2850975b4859190bc6',
   *     height: 912345,
   *     major_version: 1,
   *     minor_version: 2,
   *     nonce: 1646,
   *     orphan_status: false,
   *     prev_hash: 'b61c58b2e0be53fad5ef9d9731a55e8a81d972b8d90ed07c04fd37ca6403ff78',
   *     reward: 7388968946286,
   *     timestamp: 1452793716
   *   },
   *   json: '..."'
   *   status: 'OK'
   * }
   */
  getblock_by_height(height) {
    let params = { height: +height };
    return this._run('getblock', params);
  }

  /**
   * Retrieve information about incoming and outgoing connections to your node
   *
   * @function get_connections
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   connections: [{
   *     avg_download: 0,
   *     avg_upload: 0,
   *     current_download: 0,
   *     current_upload: 0,
   *     incoming: false,
   *     ip: '76'173.170.133",
   *     live_time: 1865,
   *     local_ip: false,
   *     localhost: false,
   *     peer_id: '3bfe29d6b1aa7c4c',
   *     port: '18080',
   *     recv_count: 116396,
   *     recv_idle_time: 23,
   *     send_count: 176893,
   *     send_idle_time: 1457726610,
   *     state: 'state_normal'
   *   },{
   *   ...
   *   }],
   *   status: 'OK'
   * }
   */
  get_connections() {
    return this._run('get_connections');
  }

  /**
   * Look up general information about the state of your node and the network
   *
   * @function get_info
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK' // TODO add example result
   * }
   */
  get_info() {
    return this._run('get_info');
  }
  
  /**
   * Alias of get_info
   */
  getinfo() {
    return this._run('get_info');
  }

  /**
   * Look up information regarding hard fork voting and readiness
   *
   * @function hard_fork_info
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   earliest_height: 1546000,
   *   enabled: true,
   *   state: 2,
   *   status: 'OK',
   *   threshold: 0,
   *   untrusted: false,
   *   version: 7,
   *   votes: 10080,
   *   voting: 7,
   *   window: 10080
   * }
   */
  hard_fork_info() {
    return this._run('hard_fork_info');
  }

  /**
   * Ban or unban a peer
   *
   * @function set_bans
   * @param {array} bans - Array of hosts objects to ban with the following parameters:
   *   @param {string} host - Host to ban in 'A.B.C.D' form
   *   @param {boolean} ban - True to ban node, false to unban
   *   @param {number} seconds - Duration of ban in seconds
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  set_bans(bans) {
    let params = { bans: bans };
    return this._run('set_bans', params);
  }

  /**
   * Look up list of banned peers
   *
   * @function get_bans
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  get_bans() {
    return this._run('get_bans');
  }

  /**
   * Flush (empty) transaction pool ("mempool")
   *
   * @function flush_txpool
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  flush_txpool() {
    return this._run('flush_txpool');
  }
  
  /**
   * Look up histogram of output amounts. For all amounts (possibly filtered by parameters,) gives the number of outputs on the chain for that amount. RingCT outputs counts as 0 amount.
   *
   * @function get_output_histogram
   * @param {array} amounts - Look up output amounts under this amount
   * @param {number} min_count - The minimum outputs to return
   * @param {number} max_count - The maximum outputs to return
   * @param {boolean} unlocked - Only return unlocked outputs
   * @param {number} recent_cutoff - Do not include outputs from this number of blocks
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *
   * }
   */
  get_output_histogram(amounts, min_count, max_count, unlocked, recent_cutoff) {
    let params = {
      amounts: amounts,
      min_count: min_count,
      max_count: max_count,
      unlocked: unlocked,
      recent_cutoff: recent_cutoff
    };

    return this._run('get_output_histogram');
  }

  /**
   * Look up node's version
   *
   * @function get_version
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK',
   *   untrusted: false,
   *   version: 65557
   * } 
   */
  get_version() {
    return this._run('get_version');
  }

  /**
   * Look up coinbase reward sum from a certain start height
   *
   * @function get_version
   * @param {number} height - Block height at which to start summing
   * @param {number} count - Number of blocks' coinbase rewards to sum (starting from the height specified above)
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   emission_amount: 175921105471352, 
   *   fee_amount: 0,
   *   status: 'OK'
   * } 
   */
  get_coinbase_tx_sum(height, count) {
    let params = {
      height: height,
      count: count
    };

    return this._run('get_coinbase_tx_sum', params);
  }

  /**
   * Look up fee estimate in atomic units per kilobyte
   *
   * @function get_fee_estimate
   * @param {number} grace_blocks - Number of blocks to include in fee estimation window (for how many blocks should this fee be valid?)
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   fee: 268950000,
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  get_fee_estimate(grace_blocks) {
    let params = { grace_blocks: grace_blocks };
    return this._run('get_fee_estimate', params);
  }

  /**
   * Look up alternate chains
   *
   * @function get_alternate_chains
   * 
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * } // TODO expand example by showing alternate change
   */
  get_alternate_chains() {
    return this._run('get_alternate_chains');
  }

  /**
   * Look up synchronization information
   *
   * @function sync_info
   * 
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   height: 1180052,
   *   peers: [
   *     info: {
   *       address: '212.83.172.165:28080',
   *       avg_download: 0,
   *       avg_upload: 0,
   *       connection_id: 'c94564f7a27795b888ec08c8e004beae',
   *       current_download: 0,
   *       current_upload: 0,
   *       height: 0,
   *       host: '212.83.172.165',
   *       incoming: false,
   *       ip: '212.83.172.165',
   *       live_time: 1,
   *       local_ip: false,
   *       localhost: false,
   *       peer_id: '0',
   *       port: '28080',
   *       recv_count: 0,
   *       recv_idle_time: 1,
   *       send_count: 259,
   *       send_idle_time: 1,
   *       state: 'before_handshake',
   *       support_flags: 0
   *    }...],
   *    status: 'OK',
   *    target_height: 1179850
   * }
   */
  sync_info() {
    return this._run('sync_info');
  }

  /**
   * Look up transaction pool ("mempool") backlog
   *
   * @function get_txpool_backlog
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK',
   *   untrusted: false
   * } // TODO expand example by showing backlog
   */
  get_txpool_backlog() {
    return this._run('get_txpool_backlog');
  }

  /**
   * Look up output distribution within a range of blocks
   *
   * @function getheight
   * @param {array} amounts - Array of amounts to look for
   * @param {boolean} cumulative - Should result be cumulative?   (default: false)
   * @param {number} from_height - Block height to start analysis (default: 0)
   * @param {number} to_height - Block height to end analysis     (default: 0)
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   height: 1637538,
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  get_output_distribution(amounts, cumulative = false, from_height = 0, to_height = 0) {
    let params = {
      amounts: amounts,
      cumulative: cumulative,
      from_height: from_height,
      to_height: to_height
    };

    return this._run('get_output_distribution', params);
  }

  /**
   * Look up node's current height
   *
   * @function getheight
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   height: 1637538,
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  getheight() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'getheight');
  }
  
  /**
   * Alias of getheight
   */
  get_height(height) {
    return this.getheight();
  }

  /**
   * Look up transaction information
   *
   * @function gettransactions
   * @param {array} txs_hashes - An array of tranasction hashes to look up
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK',
   *   txs: [
   *     {
   *       as_hex: '...',
   *       as_json: '...',
   *       block_height: 1071370,
   *       block_timestamp: 1522449191,
   *       double_spend_seen: false,
   *       in_pool: false,
   *       output_indices: [Array],
   *       tx_hash: '...'
   *     }, {...}
   *   ],
   *   txs_as_hex: [...],
   *   txs_as_json: [...],
   *   untrusted: false
   * }
   * 
   */
  gettransactions(txs_hashes) {
    let params = {
      txs_hashes: txs_hashes,
      decode_as_json: true
    };

    return this._run(null, params, 'gettransactions');
  }
  
  /**
   * Alias of gettransactions
   */
  get_transactions(txs_hashes) {
    return this.gettransactions(txs_hashes);
  }

  /**
   * Look up hashes of all orphaned blocks
   *
   * @function get_alt_blocks_hashes
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   blks_hashes: [
   *     "b3b72c9affb658ac673eab4eec145a2fa0f7991a4937a27ad8fda87fdccc09d0",
   *     "3d1f9736b6c559b766edac61b7d2da7717a0d76555b307d9d0f9d11070c422f0",
   *     "b1c51d7e224aabb30a03764f0faca5386e6566fc7463612048f7676e6af077fe",
   *     ...
   *   ],
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  get_alt_blocks_hashes() {
    let params = { decode_as_json: true };

    return this._run(null, params, 'get_alt_blocks_hashes');
  }

  /**
   * Check if outputs have been spent using the key image associated with the output.
   *
   * @function is_key_image_spent
   * @param {array} key_images - Array of key image hex strings to check
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   spent_status: [ 1 ],
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  is_key_image_spent(key_images) {
    let params = {
      key_images: key_images,
      decode_as_json: true
    };

    return this._run(null, params, 'is_key_image_spent');
  }

  /**
   * Stop the daemon
   *
   * @function stop_daemon
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  stop_daemon() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'stop_daemon');
  }

  /**
   * Look up daemon bandwidth limits in kilobytes per second
   *
   * @function get_limit
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   limit_down: 8192,
   *   limit_up: 2048,
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  get_limit() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'get_limit');
  }

  /**
   * Set daemon bandwidth limits in kilobytes per second
   *
   * @function set_limit
   * @param {number} limit_down - Download limit in kilobytes per second (-1 to reset to default, 0 to leave unchanged)
   * @param {number} limit_up - Upload limit in kilobytes per second (-1 to reset to default, 0 to leave unchanged)
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   limit_down: 8192,
   *   limit_up: 2048,
   *   status: 'OK'
   * }
   */
  set_limit(limit_down = 0, limit_up = 0) {
    let params = {
      limit_down: limit_down,
      limit_up: limit_up,
      decode_as_json: true
    };

    return this._run(null, params, 'set_limit');
  }

  /**
   * Set the maximum number of outgoing peers
   *
   * @function out_peers
   * @param {number} out_peers - Maximum number of outgoing peers
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  out_peers(out_peers) {
    let params = {
      out_peers: out_peers,
      decode_as_json: true
    };

    return this._run(null, params, 'out_peers');
  }

  /**
   * Set the maximum number of incoming peers
   *
   * @function in_peers
   * @param {number} in_peers - Maximum number of incoming peers
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  in_peers(in_peers) {
    let params = {
      in_peers: in_peers,
      decode_as_json: true
    };

    return this._run(null, params, 'in_peers');
  }

  /**
   * Broadcast a raw transaction to the network.
   *
   * @function send_raw_transaction
   * @param {string} tx_as_hex - Transaction as hexadecimal string
   * @param {boolean} do_not_relay - Request node to not relay transaction to other nodes
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   double_spend: false,
   *   fee_too_low: false,
   *   invalid_input: false,
   *   low_mixin: false,
   *   not_rct: false,
   *   not_relayed: false,
   *   overspend: false,
   *   reason: '"'
   *   status: 'OK'
   *   too_big: false,
   *   untrusted: false
   * }
   */
  send_raw_transaction(tx_as_hex, do_not_relay) {
    let params = {
      tx_as_hex: tx_as_hex,
      do_not_relay: do_not_relay,
      decode_as_json: true
    };

    return this._run(null, params, 'send_raw_transaction');
  }
  
  /**
   * Alias of send_raw_transaction
   */
  sendrawtransaction(tx_as_hex, do_not_relay) {
    return this.send_raw_transaction(tx_as_hex, do_not_relay);
  }

  /**
   * Start mining
   *
   * @function start_mining
   * @param {boolean} do_background_mining - Mine in the background or foreground
   * @param {boolean} ignore_battery - Ignore battery status
   * @param {string} miner_address - Wallet address to mine to
   * @param {number} threads_count - Number of threads with which to mine
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  start_mining(do_background_mining, ignore_battery, miner_address, threads_count) {
    let params = {
      do_background_mining: do_background_mining,
      ignore_battery: ignore_battery,
      miner_address: miner_address,
      threads_count: threads_count,
      decode_as_json: true
    };

    return this._run(null, params, 'start_mining');
  }

  /**
   * Stop mining
   *
   * @function stop_mining
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  stop_mining() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'stop_mining');
  }

  /**
   * Look up mining status
   *
   * @function mining_status
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   active: true,
   *   address: '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A',
   *   is_background_mining_enabled: false,
   *   speed: 20,
   *   status: 'OK',
   *   threads_count: 1
   * }
   */
  mining_status() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'mining_status');
  }

  /**
   * Save the blockchain to disk
   *
   * @function save_bc
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  save_bc() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'save_bc');
  }

  /**
   * Look up peers
   *
   * @function get_peer_list
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  get_peer_list() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'get_peer_list');
  }

  /**
   * Set hash rate log visibility
   *
   * @function set_log_hash_rate
   * @param {boolean} visible - Set hash rate log visibility
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  set_log_hash_rate(visible) {
    let params = {
      visible: visible,
      decode_as_json: true
    };

    return this._run(null, params, 'set_log_hash_rate');
  }

  /**
   * Set log verbosity
   *
   * @function set_log_level
   * @param {number} visible - Set log verbosity from 0 (less verbose) to 4 (most verbose)
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  set_log_level(level) {
    let params = {
      level: level,
      decode_as_json: true
    };

    return this._run(null, params, 'set_log_level');
  }

  /**
   * Set log verbosity per category
   *
   * Categories are represented as a comma separated list of <Category>:<Level> (similarly to syslog standard <Facility>:<Severity-level>), where category is one of the following:
   *
   *   * - All facilities
   *   default
   *   net
   *   net.http
   *   net.p2p
   *   logging
   *   net.throttle
   *   blockchain.db
   *   blockchain.db.lmdb
   *   bcutil
   *   checkpoints
   *   net.dns
   *   net.dl
   *   i18n
   *   perf
   *   stacktrace
   *   updates
   *   account
   *   cn
   *   difficulty
   *   hardfork
   *   miner
   *   blockchain
   *   txpool
   *   cn.block_queue
   *   net.cn
   *   daemon
   *   debugtools.deserialize
   *   debugtools.objectsizes
   *   device.ledger
   *   wallet.gen_multisig
   *   multisig
   *   bulletproofs
   *   ringct
   *   daemon.rpc
   *   wallet.simplewallet
   *   WalletAPI
   *   wallet.ringdb
   *   wallet.wallet2
   *   wallet.rpc
   *   tests.core
   *   
   * and level is one of the following:
   *   
   *   FATAL - higher level
   *   ERROR
   *   WARNING
   *   INFO
   *   DEBUG
   *   TRACE - lower level A level automatically includes higher level. By default, categories are set to *:WARNING,net:FATAL,net.p2p:FATAL,net.cn:FATAL,global:INFO,verify:FATAL,stacktrace:INFO,logging:INFO,msgwriter:INFO. Setting the categories to "" prevent all log output.
   *
   * @function set_log_categories
   * @param {string} categories - Comma-separated list of log level categories and levels
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK'
   * }
   */
  set_log_categories(categories) {
    let params = {
      categories: categories,
      decode_as_json: true
    };

    return this._run(null, params, 'set_log_categories');
  }

  /**
   * Look up transaction pool ("mempool") information
   *
   * @function get_transaction_pool
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK' // TODO add more exhaustive example
   * }
   */
  get_transaction_pool() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'get_transaction_pool');
  }

  /**
   * Look up hashes of transactions in pool ("mempool") 
   *
   * @function get_transaction_pool_hashes
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   status: 'OK' // TODO add more exhaustive example
   * }
   */
  get_transaction_pool_hashes() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'get_transaction_pool');
  }

  /**
   * Look up transaction pool ("mempool") statistics
   *
   * @function get_transaction_pool_stats
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   pool_stats": {
   *     bytes_max: 13823,
   *     bytes_med: 13247,
   *     bytes_min: 13092,
   *     bytes_total: 107390,
   *     fee_total: 47380940000,
   *     histo: '\\b�K���7�N䏑�B��'\n0$3}�\\\"���kX��",
   *     histo_98pc: 0,
   *     num_10m: 4,
   *     num_double_spends: 0,
   *     num_failing: 0,
   *     num_not_relayed: 0,
   *     oldest: 1534112886,
   *     txs_total: 8
   *   },
   *   status: 'OK',
   *   untrusted: false
   * }
   */
  get_transaction_pool_stats() {
    let params = { decode_as_json: true };
    return this._run(null, params, 'get_transaction_pool_stats');
  }

  /**
   * Look up output information
   *
   * @function getouts
   * @param {array} outputs - An array of output indexes to look up.  Example: [{ index: 586696 }, { index: 1394504 }]
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   outs: 
   *     [ { height: 1286190,
   *         key: '0f01d1b040a2489b168c252ec19e6c7eb9a4d4e10a37245b82bf8df63454d7b1',
   *         mask: 'a537f783ca0cbe460d3fee6da9b33d3dabd7df1e212ec46e5bfce97124b489a4',
   *         txid: 'd45df623c03d86809229a87755fc323de4dd3db59365323ba6c972d02f7a7a04',
   *         unlocked: true } ],
   *    status: 'OK',
   *    untrusted: false }
   * }
   */
  get_outs(outputs) {
    let params = {
      outputs: outputs,
      decode_as_json: true
    };

    return this._run(null, params, 'get_outs');
  }

  /**
   * Check for and/or download daemon update
   *
   * @function update
   * @param {string} command - Command to use.  Either 'check' or 'download'
   * @param {string} path - Path into which to download the update
   *
   * @returns {promise} resolve, reject
   * @resolves {object} - Example: {
   *   auto_uri: '',
   *   hash: '',
   *   path: '',
   *   status: 'OK',
   *   update: false,
   *   user_uri: '',
   *   version: ''
   * }
   */
  update(command, path) {
    let params = {
      command: command,
      path: path
    };

    return this._run(null, params, 'update');
  }
}

module.exports = daemonRPC;
