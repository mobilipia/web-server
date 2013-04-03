// Generated by CoffeeScript 1.4.0
(function() {
  var assert, async, baseUri, cleanup, clients, cookies, createKeys, crypto, dcrypt, fs, generateKey, io, jars, jsonMessage, localid, login, makeKeys, port, rc, redis, request, sendMessages, should, sign, signup, util;

  request = require("request");

  assert = require("assert");

  should = require("should");

  redis = require("redis");

  util = require("util");

  fs = require("fs");

  io = require('socket.io-client');

  crypto = require('crypto');

  dcrypt = require('dcrypt');

  async = require('async');

  rc = redis.createClient();

  port = 443;

  baseUri = "https://localhost:" + port;

  jars = [];

  cookies = [];

  clients = [];

  jsonMessage = {
    type: "message",
    to: "test0",
    toVersion: "1",
    from: "test1",
    fromVersion: "1",
    iv: 1,
    data: "message data",
    mimeType: "text/plain"
  };

  localid = 0;

  cleanup = function(done) {
    var buildKeys, i, multi, _i;
    multi = rc.multi();
    buildKeys = function(i) {
      multi.del("users:test" + i);
      multi.del("keys:test" + i);
      multi.del("keyversion:test" + i);
      multi.del("control:user:test" + i);
      multi.del("control:user:test" + i + ":id");
      multi.del("users:deleted:test" + i);
      multi.del("friends:test" + i);
      multi.del("friends:test" + i);
      multi.del("invites:test" + i);
      multi.del("invited:test" + i);
      return multi.del("conversations:test" + i);
    };
    for (i = _i = 0; _i <= 2; i = ++_i) {
      buildKeys(i);
    }
    multi.del("users");
    multi.del("deleted");
    multi.del("deleted:test0");
    multi.del("test0:test1:id");
    multi.del("test0:test2:id");
    multi.del("messages:test0:test1");
    multi.del("messages:test0:test2");
    multi.del("control:message:test0:test1");
    multi.del("control:message:test0:test2");
    return multi.exec(function(err, blah) {
      if (err != null) {
        return done(err);
      }
      return done();
    });
  };

  login = function(username, password, jar, authSig, done, callback) {
    return request.post({
      url: baseUri + "/login",
      jar: jar,
      json: {
        username: username,
        password: password,
        authSig: authSig
      }
    }, function(err, res, body) {
      var cookie;
      if (err) {
        return done(err);
      } else {
        cookie = jar.get({
          url: baseUri
        }).map(function(c) {
          return c.name + "=" + c.value;
        }).join("; ");
        return callback(res, body, cookie);
      }
    });
  };

  signup = function(username, password, jar, dhPub, dsaPub, authSig, done, callback) {
    return request.post({
      url: baseUri + "/users",
      jar: jar,
      json: {
        username: username,
        password: password,
        dhPub: dhPub,
        dsaPub: dsaPub,
        authSig: authSig
      }
    }, function(err, res, body) {
      var cookie;
      if (err) {
        return done(err);
      } else {
        cookie = jar.get({
          url: baseUri
        }).map(function(c) {
          return c.name + "=" + c.value;
        }).join("; ");
        return callback(res, body, cookie);
      }
    });
  };

  generateKey = function(i, callback) {
    var dsaPubSig, ecdh, ecdsa, random, sig;
    ecdsa = new dcrypt.keypair.newECDSA('secp521r1');
    ecdh = new dcrypt.keypair.newECDSA('secp521r1');
    random = crypto.randomBytes(16);
    dsaPubSig = crypto.createSign('sha256').update(new Buffer("test" + i)).update(new Buffer("test" + i)).update(random).sign(ecdsa.pem_priv, 'base64');
    sig = Buffer.concat([random, new Buffer(dsaPubSig, 'base64')]).toString('base64');
    return callback(null, {
      ecdsa: ecdsa,
      ecdh: ecdh,
      sig: sig
    });
  };

  sign = function(priv, b1, b2) {
    var dsaPubSig, random;
    random = crypto.randomBytes(16);
    dsaPubSig = crypto.createSign('sha256').update(b1).update(b2).update(random).sign(priv, 'base64');
    return Buffer.concat([random, new Buffer(dsaPubSig, 'base64')]).toString('base64');
  };

  makeKeys = function(i) {
    return function(callback) {
      return generateKey(i, callback);
    };
  };

  createKeys = function(number, done) {
    var i, keys, _i;
    keys = [];
    for (i = _i = 0; 0 <= number ? _i <= number : _i >= number; i = 0 <= number ? ++_i : --_i) {
      keys.push(makeKeys(i));
    }
    return async.parallel(keys, function(err, results) {
      if (err != null) {
        return done(err);
      } else {
        return done(null, results);
      }
    });
  };

  sendMessages = function(clientNum, to, number, callback) {
    var _i, _results;
    return async.each((function() {
      _results = [];
      for (var _i = 1; 1 <= number ? _i <= number : _i >= number; 1 <= number ? _i++ : _i--){ _results.push(_i); }
      return _results;
    }).apply(this), function(item, callback) {
      jsonMessage.from = "test" + clientNum;
      jsonMessage.to = to;
      jsonMessage.iv = localid++;
      clients[clientNum].once('message', function() {
        return callback();
      });
      return clients[clientNum].send(JSON.stringify(jsonMessage));
    }, function(err) {
      return callback(null);
    });
  };

  describe("surespot delete identity test", function() {
    var keys;
    keys = void 0;
    before(function(done) {
      return createKeys(3, function(err, keyss) {
        keys = keyss;
        return cleanup(done);
      });
    });
    it('connect clients', function(done) {
      return async.each([0, 1, 2], function(i, callback) {
        jars[i] = request.jar();
        return signup("test" + i, "test" + i, jars[i], keys[i].ecdh.pem_pub, keys[i].ecdsa.pem_pub, keys[i].sig, done, function(res, body, cookie) {
          clients[i] = io.connect(baseUri, {
            'force new connection': true
          }, cookie);
          cookies[i] = cookie;
          return clients[i].once('connect', function() {
            return callback();
          });
        });
      }, function(err) {
        if (err != null) {
          return done(err);
        }
        return done();
      });
    });
    it('become friends', function(done) {
      return request.post({
        jar: jars[0],
        url: baseUri + "/invite/test1"
      }, function(err, res, body) {
        if (err) {
          return done(err);
        } else {
          return request.post({
            jar: jars[0],
            url: baseUri + "/invite/test2"
          }, function(err, res, body) {
            if (err) {
              return done(err);
            } else {
              return request.post({
                jar: jars[1],
                url: baseUri + "/invites/test0/accept"
              }, function(err, res, body) {
                if (err) {
                  return done(err);
                } else {
                  return request.post({
                    jar: jars[2],
                    url: baseUri + "/invites/test0/accept"
                  }, function(err, res, body) {
                    if (err) {
                      return done(err);
                    } else {
                      return done();
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
    it('send 3 messages for each friend pair', function(done) {
      var tasks;
      tasks = [];
      tasks.push(function(callback) {
        return sendMessages(0, 'test1', 3, callback);
      });
      tasks.push(function(callback) {
        return sendMessages(1, 'test0', 3, callback);
      });
      tasks.push(function(callback) {
        return sendMessages(0, 'test2', 3, callback);
      });
      tasks.push(function(callback) {
        return sendMessages(2, 'test0', 3, callback);
      });
      return async.parallel(tasks, function(err, results) {
        return done();
      });
    });
    it('can delete identity successfully', function(done) {
      return request.post({
        url: baseUri + "/deletetoken",
        jar: jars[0],
        json: {
          username: "test0",
          password: "test0",
          authSig: keys[0].sig
        }
      }, function(err, res, body) {
        var tokenSig;
        if (err) {
          return done(err);
        } else {
          res.statusCode.should.equal(200);
          body.should.exist;
          tokenSig = sign(keys[0].ecdsa.pem_priv, new Buffer(body, 'base64'), "test0");
          return request.post({
            url: baseUri + "/users/delete",
            jar: jars[0],
            json: {
              username: "test0",
              password: "test0",
              authSig: keys[0].sig,
              dhPub: keys[0].ecdh.pem_pub,
              dsaPub: keys[0].ecdsa.pem_pub,
              keyVersion: 1,
              tokenSig: tokenSig
            }
          }, function(err, res, body) {
            if (err) {
              return done(err);
            } else {
              res.statusCode.should.equal(204);
              return done();
            }
          });
        }
      });
    });
    it('each remaining user should have 3 of his messages left', function(done) {
      return request.get({
        jar: jars[1],
        url: baseUri + "/messages/test0/before/13"
      }, function(err, res, body) {
        var data;
        if (err) {
          return done(err);
        } else {
          res.statusCode.should.equal(200);
          data = JSON.parse(body);
          data.length.should.equal(3);
          JSON.parse(data[0]).from.should.equal("test1");
          JSON.parse(data[1]).from.should.equal("test1");
          JSON.parse(data[2]).from.should.equal("test1");
          return request.get({
            jar: jars[1],
            url: baseUri + "/messagedata/test0/0/-1"
          }, function(err, res, body) {
            if (err) {
              return done(err);
            } else {
              res.statusCode.should.equal(200);
              data = JSON.parse(body);
              data.messages.length.should.equal(3);
              JSON.parse(data.messages[0]).from.should.equal("test1");
              JSON.parse(data.messages[1]).from.should.equal("test1");
              JSON.parse(data.messages[2]).from.should.equal("test1");
              return request.get({
                jar: jars[2],
                url: baseUri + "/messages/test0/before/13"
              }, function(err, res, body) {
                if (err) {
                  return done(err);
                } else {
                  res.statusCode.should.equal(200);
                  data = JSON.parse(body);
                  data.length.should.equal(3);
                  JSON.parse(data[0]).from.should.equal("test2");
                  JSON.parse(data[1]).from.should.equal("test2");
                  JSON.parse(data[2]).from.should.equal("test2");
                  return request.get({
                    jar: jars[2],
                    url: baseUri + "/messagedata/test0/0/-1"
                  }, function(err, res, body) {
                    if (err) {
                      return done(err);
                    } else {
                      res.statusCode.should.equal(200);
                      data = JSON.parse(body);
                      data.messages.length.should.equal(3);
                      JSON.parse(data.messages[0]).from.should.equal("test2");
                      JSON.parse(data.messages[1]).from.should.equal("test2");
                      JSON.parse(data.messages[2]).from.should.equal("test2");
                      return done();
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
    it('the delete flag should be set on the deleting user for the deleted user', function(done) {
      return request.get({
        jar: jars[1],
        url: baseUri + "/friends"
      }, function(err, res, body) {
        var data, flags;
        if (err) {
          return done(err);
        } else {
          res.statusCode.should.equal(200);
          data = JSON.parse(body);
          flags = parseInt(data.friends["test0"]);
          flags & 1..should.equal(1);
          return done();
        }
      });
    });
    it('should not be able to send message to someone who has deleted you', function(done) {
      clients[1].once('messageError', function(data) {
        data.id.should.equal(jsonMessage.iv);
        data.status.should.equal(404);
        return done();
      });
      jsonMessage.from = "test1";
      jsonMessage.to = "test0";
      jsonMessage.iv = localid++;
      return clients[1].send(JSON.stringify(jsonMessage));
    });
    describe('delete deleted users friends', function() {
      it('should not allow creating of deleted user when friends remain that had the deleted user as a friend', function(done) {
        return request.del({
          jar: jars[1],
          url: baseUri + "/friends/test0"
        }, function(err, res, body) {
          if (err) {
            return done(err);
          } else {
            res.statusCode.should.equal(204);
            return signup("test0", "test0", jars[0], keys[0].ecdh.pem_pub, keys[0].ecdsa.pem_pub, keys[0].sig, done, function(res, body, cookie) {
              res.statusCode.should.equal(409);
              return done();
            });
          }
        });
      });
      return it('should allow creating of deleted user when no friends remain that had the deleted user as a friend', function(done) {
        return request.del({
          jar: jars[2],
          url: baseUri + "/friends/test0"
        }, function(err, res, body) {
          if (err) {
            return done(err);
          } else {
            res.statusCode.should.equal(204);
            return signup("test0", "test0", jars[0], keys[0].ecdh.pem_pub, keys[0].ecdsa.pem_pub, keys[0].sig, done, function(res, body, cookie) {
              res.statusCode.should.equal(201);
              return done();
            });
          }
        });
      });
    });
    describe('can delete all the identities', function() {
      it('can delete test0', function(done) {
        return request.post({
          url: baseUri + "/deletetoken",
          jar: jars[0],
          json: {
            username: "test0",
            password: "test0",
            authSig: keys[0].sig
          }
        }, function(err, res, body) {
          var tokenSig;
          if (err) {
            return done(err);
          } else {
            res.statusCode.should.equal(200);
            body.should.exist;
            tokenSig = sign(keys[0].ecdsa.pem_priv, new Buffer(body, 'base64'), "test0");
            return request.post({
              url: baseUri + "/users/delete",
              jar: jars[0],
              json: {
                username: "test0",
                password: "test0",
                authSig: keys[0].sig,
                dhPub: keys[0].ecdh.pem_pub,
                dsaPub: keys[0].ecdsa.pem_pub,
                keyVersion: 1,
                tokenSig: tokenSig
              }
            }, function(err, res, body) {
              if (err) {
                return done(err);
              } else {
                res.statusCode.should.equal(204);
                return done();
              }
            });
          }
        });
      });
      it('can delete test1', function(done) {
        return request.post({
          url: baseUri + "/deletetoken",
          jar: jars[1],
          json: {
            username: "test1",
            password: "test1",
            authSig: keys[1].sig
          }
        }, function(err, res, body) {
          var tokenSig;
          if (err) {
            return done(err);
          } else {
            res.statusCode.should.equal(200);
            body.should.exist;
            tokenSig = sign(keys[1].ecdsa.pem_priv, new Buffer(body, 'base64'), "test1");
            return request.post({
              url: baseUri + "/users/delete",
              jar: jars[1],
              json: {
                username: "test1",
                password: "test1",
                authSig: keys[1].sig,
                dhPub: keys[1].ecdh.pem_pub,
                dsaPub: keys[1].ecdsa.pem_pub,
                keyVersion: 1,
                tokenSig: tokenSig
              }
            }, function(err, res, body) {
              if (err) {
                return done(err);
              } else {
                res.statusCode.should.equal(204);
                return done();
              }
            });
          }
        });
      });
      return it('can delete test2', function(done) {
        return request.post({
          url: baseUri + "/deletetoken",
          jar: jars[2],
          json: {
            username: "test2",
            password: "test2",
            authSig: keys[2].sig
          }
        }, function(err, res, body) {
          var tokenSig;
          if (err) {
            return done(err);
          } else {
            res.statusCode.should.equal(200);
            body.should.exist;
            tokenSig = sign(keys[2].ecdsa.pem_priv, new Buffer(body, 'base64'), "test2");
            return request.post({
              url: baseUri + "/users/delete",
              jar: jars[2],
              json: {
                username: "test2",
                password: "test2",
                authSig: keys[2].sig,
                dhPub: keys[2].ecdh.pem_pub,
                dsaPub: keys[2].ecdsa.pem_pub,
                keyVersion: 1,
                tokenSig: tokenSig
              }
            }, function(err, res, body) {
              if (err) {
                return done(err);
              } else {
                res.statusCode.should.equal(204);
                return done();
              }
            });
          }
        });
      });
    });
    return after(function(done) {
      clients[0].disconnect();
      clients[1].disconnect();
      clients[2].disconnect();
      return done();
    });
  });

}).call(this);