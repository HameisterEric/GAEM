'use strict';
var mongojs = require("mongojs");
//var db = mongojs('mongodb://gaem:gaem@ds011943.mlab.com:11943/gaem', ['account','progress']);
var db = mongojs('localhost:27017/myGame', ['account', 'progress']);
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get("/", function(req, res) {
  res.sendFile(__dirname + '/client');
});
//app.use('/client', express.static(__dirname + '/client'));
app.use(express.static('client'));
var port = Number(process.env.PORT || 6969);
serv.listen(port);

var socketlist = {};
var playerlist = {};
var Entity = function(playerId) {
  var self = {
    x: 250,
    y: 250,
    xSpeed: 0,

    ySpeed: 0,
    id: playerId,
    attacking: false,
    attackingTicks: 0,
    target: "",
    being: ""
  }
  self.update = function() {
    self.updatePosition();
  }
  self.updatePosition = function() {
    self.x += self.xSpeed;
    self.y += self.ySpeed;
  }
  return self;
}
var Map = function(mapId) {
  var self = {
    id: mapId,
    mobList: [],
    playerList: [],
    initPack: {
      players: [],
      mobs: []
    },
    removePack: {
      players: [],
      mobs: []
    },
    changeRowPack: {
      players: [],
      mobs: []
    },
    mobCount: 0,
    playerCount: 0,
    toDelete: false,
    difficulty: 1
  }
  self.addMob = function(mob) {
    Map.list[mob.id].mobList.push(mob);
  }
  self.addPlayer = function(player, mapId) {
    player.updateMapId(mapId);
    socketlist[player.id].emit('init', Map.list[player.mapId].onStart(mapId));
    Map.list[player.mapId].playerList.push(player);
    Map.list[player.mapId].initPack.players.push({
      being: player.being,
      number: player.arrayPosition,
      x: player.x,
      y: player.y
    });
  }
  self.onStart = function(mapId) {
    var playerPack = []
    for (var i in Map.list[mapId].playerList) {
      playerPack.push({
        being: Map.list[mapId].playerList[i].being,
        number: Map.list[mapId].playerList[i].arrayPosition,
        x: Map.list[mapId].playerList[i].x,
        y: Map.list[mapId].playerList[i].y
      });
    }
    var mobPack = []
    for (var i in Map.list[mapId].mobList) {
      mobPack.push({
        being: Map.list[mapId].mobList[i].being,
        number: Map.list[mapId].mobList[i].arrayPosition,
        x: Map.list[mapId].mobList[i].x,
        y: Map.list[mapId].mobList[i].y
      });
    }
    return {
      players: playerPack,
      mobs: mobPack
    }
  }
  Map.list[self.id] = self;
  return self;
}
Map.list = {};
var Mob = function(id, difficulty) {
  var self = Entity(id);
  self.x = Math.random() * 450;
  self.y = Math.random() * 450;
  self.range = 60;
  self.being = "mob" + difficulty;
  self.speed = 2;
  self.damage = 10 * Math.pow(1.5, difficulty);
  self.health = 50 * Math.pow(1.5, difficulty);
  self.xpGiven = 10 * Math.pow(1.5, difficulty);
  self.arrayPosition = Map.list[self.id].mobCount;
  Map.list[self.id].mobCount++;
  var super_update = self.update;
  Map.list[self.id].initPack.mobs.push({
    being: self.being,
    number: self.arrayPosition,
    x: self.x,
    y: self.y
  });

  self.update = function() {
    var a = self.tick();
    super_update();
    return a;
  }
  self.tick = function() {
    if (this.health <= 0) {
      Map.list[self.id].removePack.mobs.push({
        number: self.arrayPosition
      });
      delete Map.list[self.id].mobList[self.arrayPosition];
      self.giveXP();
      return false;
    } else {
      if (!self.target) {
        var closest = 9999999999;
        var position = -1;
        for (var i in Map.list[self.id].playerList) {
          var player = Map.list[self.id].playerList[i];
          var distance = Math.pow(player.x - self.x, 2) + Math.pow(player.y - 20 - self.y, 2);
          if (distance < closest) {
            closest = distance;
            position = i;
          }
        }
        if (position > -1) {
          self.target = Map.list[self.id].playerList[position];
          Map.list[self.id].changeRowPack.mobs.push({
            number: self.arrayPosition,
            row: 2,
            reverse: self.target.x > self.x ? 1 : -1
          });
        }
      }
      if (!self.attacking) {
        if (Math.pow(self.target.x - self.x, 2) + Math.pow(self.target.y - 20 - self.y, 2) < self.range * self.range) {
          self.attacking = true;
          Map.list[self.id].changeRowPack.mobs.push({
            number: self.arrayPosition,
            row: 3,
            reverse: self.target.x > self.x ? 1 : -1
          });
        }
        else {
          var angle = Math.atan2(self.target.y - self.y, self.target.x - self.x);
          self.xSpeed = Math.cos(angle) * self.speed;
          self.ySpeed = Math.sin(angle) * self.speed;
        }
      }
      if (self.attacking) {
        self.xSpeed = 0;
        self.ySpeed = 0;
        self.attackingTicks++;
        if (self.attackingTicks >= 60) {
          Map.list[self.id].changeRowPack.mobs.push({
            number: self.arrayPosition,
            row: 0
          });
          self.attack(self.target);
          self.attacking = false;
          self.attackingTicks = 0;
        }
      }
      return true;
    }
  }
  self.attack = function(target) {
    target.health -= self.damage;
  }
  self.giveXP = function() {
    var numberOfPlayers = Map.list[self.id].playerList.length;
    for (var i in Map.list[self.id].playerList) {
      Map.list[self.id].playerList[i].xp += self.xpGiven / numberOfPlayers;
    }
    for (var i in Map.list[self.id].playerList) {
      if (Math.random() < 1 / 10 / numberOfPlayers)
        socketlist[Map.list[self.id].playerList[i].id].emit('addItem', {
          being: self.being,
          item: 0
        });
    }
  }
  return self;
}

var Player = function(id, playerType) {
  var self = Entity(id);
  self.being = playerType;
  if (self.being === "Knight") {
    self.speed = 2;
    self.health = 1000;
    self.damage = 25;
    self.range = 75;
  } else if (self.being === "Shaman") {
    self.speed = 1;
    self.health = 500;
    self.damage = 10;
    self.range = 9999999999;
  } else if (self.being === "Thief") {
    self.speed = 2;
    self.health = 750;
    self.damage = 20;
    self.range = 65;
  } else {
    self.speed = 2;
    self.health = 750;
    self.damage = 20;
    self.range = 300;
  }
  self.arrayPosition = 0;
  self.level = 0;
  self.xp = 0;
  self.mapId = id;
  var super_update = self.update;
  self.updateMapId = function(newId) {
    self.mapId = newId;
    self.arrayPosition = Map.list[self.mapId].playerCount;
    Map.list[self.mapId].playerCount++;
  }
  self.update = function() {
    self.tick();
    super_update();
  }
  self.tick = function() {
    if (!self.target) {
      var closest = 9999999999;
      var position = -1;
      for (var i in Map.list[self.mapId].mobList) {
        var mob = Map.list[self.mapId].mobList[i];
        var distance = Math.pow(mob.x - self.x, 2) + Math.pow(mob.y - self.y, 2);
        if (distance < closest) {
          closest = distance;
          position = i;
        }
      }
      if (position > -1) {
        self.target = Map.list[self.mapId].mobList[position]
        Map.list[self.mapId].changeRowPack.players.push({
          number: self.arrayPosition,
          row: 2,
          reverse: self.target.x > self.x ? 1 : -1
        });
      }
    }
    if (self.target && !self.attacking) {
      var angle = Math.atan2(self.target.y - self.y, self.target.x - self.x);
      self.xSpeed = Math.cos(angle) * self.speed;
      self.ySpeed = Math.sin(angle) * self.speed;
      if (Math.pow(self.target.x - self.x, 2) + Math.pow(self.target.y - self.y, 2) < self.range * self.range) {
        self.attacking = true;
        Map.list[self.mapId].changeRowPack.players.push({
          number: self.arrayPosition,
          row: 3,
          reverse: self.target.x > self.x ? 1 : -1
        });
      }
    }
    if (self.attacking) {
      self.xSpeed = 0;
      self.ySpeed = 0;
      self.attackingTicks++;
      if (!Map.list[self.mapId].mobList[self.target.arrayPosition]) {
        self.target = undefined;
        self.attacking = false;
        self.attackingTicks = 0;
        Map.list[self.mapId].changeRowPack.players.push({
          number: self.arrayPosition,
          row: 0,
        });
      }
      if (self.attackingTicks >= 60) {
        if (self.being === "Shaman") {
          for (var i in Map.list[self.mapId].mobList)
            self.attack(Map.list[self.mapId].mobList[i]);
        } else
          self.attack(self.target);
        self.attacking = false;
        self.attackingTicks = 0;
      }
    }
  }
  self.attack = function(target) {
    self.levelUp();
    var damageAfterModifyers = self.damage * Math.pow(1.1, self.level);
    target.health -= damageAfterModifyers;
  }
  self.levelUp = function() {
    while (600 * Math.pow(6 / 5, self.level) - 500 <= self.xp) {
      self.level++;
      console.log("level " + self.level);
    }
  }
  return self;
}
Player.onConnect = function(socket, playerType, mapId) {
  if (!mapId)
    mapId = Math.random();
  var map = Map.list[mapId] || new Map(mapId);
  var player = new Player(socket.id,playerType);
  playerlist[socketlist[socket.id].id] = player;
  map.addPlayer(player, map.id);
}

Player.onDisconnect = function(socket) {
  if (playerlist[socket.id]) {
    var toDelete = false;
    if (Map.list[playerlist[socket.id].mapId].playerList.length === 1)
      toDelete = true;
    Map.list[playerlist[socket.id].mapId].removePack.players.push({
      number: playerlist[socket.id].arrayPosition
    });
    delete Map.list[playerlist[socket.id].mapId].playerList[playerlist[socket.id].arrayPosition];
    if (toDelete)
      delete Map.list[playerlist[socket.id].mapId];
  }
}

Map.update = function(map) {
  var mobPack = [];
  for (var i in Map.list[map].mobList) {
    var mob = Map.list[map].mobList[i];
    if (mob.update()) {
      mobPack.push({
        number: mob.arrayPosition,
        being: mob.being,
        x: mob.x,
        y: mob.y
      });
    }
  }
  var playerPack = [];
  for (var i in Map.list[map].playerList) {
    var player = Map.list[map].playerList[i];
    player.update();
    playerPack.push({
      number: player.arrayPosition,
      being: player.being,
      x: player.x,
      y: player.y
    });
  }
  var pack = {
    players: playerPack,
    mobs: mobPack
  }
  return pack;
}

var isValidPassword = function(data, cb) {
  db.account.find({
    username: data.username,
    password: data.password
  }, function(err, res) {
    if (res.length > 0)
      cb(true);
    else
      cb(false);
  });
}

var isUsernameTaken = function(data, cb) {
  db.account.find({
    username: data.username
  }, function(err, res) {
    if (res.length > 0)
      cb(true);
    else
      cb(false);
  });
}

var addUser = function(data, cb) {
  db.account.insert({
    username: data.username,
    password: data.password
  }, function(err, res) {
    cb();
  });
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
  socket.id = Math.random();
  socketlist[socket.id] = socket;

  socket.on('signIn', function(data) {
    isValidPassword(data, function(res) {
      if (res) {
        socket.emit('signInResponse', {
          success: true
        });
      } else {
        socket.emit('signInResponse', {
          sucess: false
        });
      }
    });
  });
  socket.on('loaded', function(data) {
    Player.onConnect(socket, data.playerType, data.map);
  });
  socket.on('signUp', function(data) {
    isUsernameTaken(data, function(res) {
      if (res) {
        socket.emit('signUpResponse', {
          success: false
        });
      } else {
        addUser(data, function() {
          socket.emit('signUpResponse', {
            success: true
          });
        });
      }
    });
  });
  socket.on('changeDifficulty', function(data) {
    Map.list[playerlist[socket.id].mapId].difficulty = data.difficulty;
  });
  socket.on('disconnect', function() {
    Player.onDisconnect(socket);
    delete socketlist[socket.id];
  });

  socket.on('sendText', function(data) {
    var playerName = "" + socket.id;
    for (var i in socketlist) {
      socketlist[i].emit('addToChat', playerName + ': ' + data);
    }
  });
});

setInterval(function() {
  for (var i in Map.list) {
    var map = Map.list[i];
    var pack = Map.update(i);
    for (var j in map.playerList) {
      var socket = socketlist[map.playerList[j].id];
      if (socket && map) {
        socket.emit('remove', map.removePack);
        socket.emit('init', map.initPack);
        socket.emit('changeRow', map.changeRowPack);
        socket.emit('update', pack);
      }
    }
    map.initPack.players = [];
    map.initPack.mobs = [];
    map.removePack.players = [];
    map.removePack.mobs = [];
    map.changeRowPack.players = [];
    map.changeRowPack.mobs = [];
    if (Math.random() < .005) {
      map.addMob(new Mob(i,map.difficulty));
    }
  }
}, 1000 / 60);
