'use strict';
var Monero = require('../index.js');

describe('Monero', () => {
  var daemonRPC = new Monero.daemonRPC();

  describe('daemonRPC', () => {
    describe('getblockcount()', () => {
      it('should return the node\'s block height', (done) => {
        daemonRPC.getblockcount('monero_wallet').then(result => {
          if (result.hasOwnProperty('error')) {
            if (result.hasOwnProperty('error')) {
              if (result.error.code == -21) {
                result.error.code.should.be.equal(-21)
              }
            }
          } else {
            result.should.be.a.Object();
          }
          done();
        })
      })
    })
  });
  var walletRPC = new Monero.walletRPC();

  describe('walletRPC', () => {
    describe('create_wallet()', () => {
      it('should create a new wallet monero_wallet (if monero_wallet doesn\'t exist))', (done) => {
        walletRPC.create_wallet('monero_wallet').then(result => {
          if (result.hasOwnProperty('error')) {
            if (result.hasOwnProperty('error')) {
              if (result.error.code == -21) {
                result.error.code.should.be.equal(-21)
              }
            }
          } else {
            result.should.be.a.Object();
          }
          done();
        })
      })
    })

    describe('open_wallet()', () => {
      it('should open monero_wallet', (done) => {
        walletRPC.open_wallet('monero_wallet').then(result => {
          result.should.be.a.Object();
          done();
        })
      })
    })

    describe('getbalance()', () => {
      it('should retrieve the account balance', (done) => {
        walletRPC.getbalance().then(result => {
          result.balance.should.be.a.Number();
          done();
        })
      })
    })

    describe('getaddress()', () => {
      it('should return the account address', (done) => {
        walletRPC.getaddress().then(result => {
          result.address.should.be.a.String();
          done();
        })
      })
    })
  })
})
