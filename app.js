'use strict';
var mongojs = require('mongojs');
var db = mongojs(process.env.DB, ['account', 'progress']);
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/client');
});
//app.use('/client', express.static(__dirname + '/client'));
app.use(express.static('client'));
var port = Number(process.env.PORT || 6969);
serv.listen(port);

var socketlist = {};
var playerlist = {};

class Map {
  constructor(mapId) {
    this.id = mapId;
    this.mobList = [];
    this.playerList = [];
    this.initPack = {
      players: [],
      mobs: []
    };
    this.removePack = {
      players: [],
      mobs: []
    };
    this.changeRowPack = {
      players: [],
      mobs: []
    };
    this.mobCount = 0;
    this.playerCount = 0;
    this.toDelete = false;
    this.difficulty = 1;
    Map.list[this.id] = this;
  }
  addMob(mob) {
    Map.list[mob.id].mobList.push(mob);
  }
  addPlayer(player, mapId) {
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
  onStart(mapId) {
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
}
Map.list = {};

class Entity {
  constructor(playerId) {
    this.x = 250;
    this.y = 250;
    this.xSpeed = 0;
    this.ySpeed = 0;
    this.id = playerId;
    this.attacking = false;
    this.attackingTicks = 0;
    this.target = '';
    this.being = '';
  }
  update() {
    this.updatePosition();
  }
  updatePosition() {
    this.x += this.xSpeed;
    this.y += this.ySpeed;
  }
}

class Mob extends Entity {
  constructor(id, difficulty) {
    super(id);
    this.x = Math.random() * 450;
    this.y = Math.random() * 450;
    this.range = 60;
    this.being = 'mob' + difficulty;
    this.speed = 2;
    this.damage = 10 * Math.pow(1.5, difficulty);
    this.health = 50 * Math.pow(1.5, difficulty);
    this.xpGiven = 10 * Math.pow(1.5, difficulty);
    this.arrayPosition = Map.list[this.id].mobCount;
    Map.list[this.id].mobCount++;
    Map.list[this.id].initPack.mobs.push({
      being: this.being,
      number: this.arrayPosition,
      x: this.x,
      y: this.y
    });
  }
  update() {
    var a = this.tick();
    super.update();
    return a;
  }
  tick() {
    if (this.health <= 0) {
      Map.list[this.id].removePack.mobs.push({
        number: this.arrayPosition
      });
      delete Map.list[this.id].mobList[this.arrayPosition];
      this.giveXP();
      return false;
    } else {
      if (!this.target) {
        var closest = 9999999999;
        var position = -1;
        for (var i in Map.list[this.id].playerList) {
          var player = Map.list[this.id].playerList[i];
          var distance = Math.pow(player.x - this.x, 2) + Math.pow(player.y - 20 - this.y, 2);
          if (distance < closest) {
            closest = distance;
            position = i;
          }
        }
        if (position > -1) {
          this.target = Map.list[this.id].playerList[position];
          Map.list[this.id].changeRowPack.mobs.push({
            number: this.arrayPosition,
            row: 2,
            reverse: this.target.x > this.x ? 1 : -1
          });
        }
      }
      if (!this.attacking) {
        if (Math.pow(this.target.x - this.x, 2) + Math.pow(this.target.y - 20 - this.y, 2) < this.range * this.range) {
          this.attacking = true;
          Map.list[this.id].changeRowPack.mobs.push({
            number: this.arrayPosition,
            row: 3,
            reverse: this.target.x > this.x ? 1 : -1
          });
        }
        else {
          var angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
          this.xSpeed = Math.cos(angle) * this.speed;
          this.ySpeed = Math.sin(angle) * this.speed;
        }
      }
      if (this.attacking) {
        this.xSpeed = 0;
        this.ySpeed = 0;
        this.attackingTicks++;
        if (this.attackingTicks >= 60) {
          Map.list[this.id].changeRowPack.mobs.push({
            number: this.arrayPosition,
            row: 0
          });
          this.attack(this.target);
          this.attacking = false;
          this.attackingTicks = 0;
        }
      }
      return true;
    }
  }
  attack(target) {
    target.health -= this.damage;
  }
  giveXP() {
    var numberOfPlayers = Map.list[this.id].playerList.length;
    for (var i in Map.list[this.id].playerList) {
      Map.list[this.id].playerList[i].xp += this.xpGiven / numberOfPlayers;
    }
    for (var i in Map.list[this.id].playerList) {
      if (Math.random() < 1 / 10 / numberOfPlayers){
        socketlist[Map.list[this.id].playerList[i].id].emit('addItem', {
          being: this.being
        });
			}
    }
  }
}

class Player extends Entity {
  constructor(id, playerType) {
    super(id);
    this.being = playerType;
    if (this.being === 'Knight') {
      this.speed = 2;
      this.health = 1000;
      this.damage = 25;
      this.range = 75;
    } else if (this.being === 'Shaman') {
      this.speed = 1;
      this.health = 500;
      this.damage = 10;
      this.range = 9999999999;
    } else if (this.being === 'Thief') {
      this.speed = 2;
      this.health = 750;
      this.damage = 20;
      this.range = 65;
    } else {
      this.speed = 2;
      this.health = 750;
      this.damage = 20;
      this.range = 300;
    }
    this.arrayPosition = 0;
    this.level = 0;
    this.xp = 0;
    this.mapId = id;
  }
  updateMapId(newId) {
    this.mapId = newId;
    this.arrayPosition = Map.list[this.mapId].playerCount;
    Map.list[this.mapId].playerCount++;
  }
  update() {
    this.tick();
    super.update();
  }
  tick() {
    if (!this.target) {
      var closest = 9999999999;
      var position = -1;
      for (var i in Map.list[this.mapId].mobList) {
        var mob = Map.list[this.mapId].mobList[i];
        var distance = Math.pow(mob.x - this.x, 2) + Math.pow(mob.y - this.y, 2);
        if (distance < closest) {
          closest = distance;
          position = i;
        }
      }
      if (position > -1) {
        this.target = Map.list[this.mapId].mobList[position]
        Map.list[this.mapId].changeRowPack.players.push({
          number: this.arrayPosition,
          row: 2,
          reverse: this.target.x > this.x ? 1 : -1
        });
      }
    }
    if (this.target && !this.attacking) {
      var angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      this.xSpeed = Math.cos(angle) * this.speed;
      this.ySpeed = Math.sin(angle) * this.speed;
      if (Math.pow(this.target.x - this.x, 2) + Math.pow(this.target.y - this.y, 2) < this.range * this.range) {
        this.attacking = true;
        Map.list[this.mapId].changeRowPack.players.push({
          number: this.arrayPosition,
          row: 3,
          reverse: this.target.x > this.x ? 1 : -1
        });
      }
    }
    if (this.attacking) {
      this.xSpeed = 0;
      this.ySpeed = 0;
      this.attackingTicks++;
      if (!Map.list[this.mapId].mobList[this.target.arrayPosition]) {
        this.target = undefined;
        this.attacking = false;
        this.attackingTicks = 0;
        Map.list[this.mapId].changeRowPack.players.push({
          number: this.arrayPosition,
          row: 0,
        });
      }
      if (this.attackingTicks >= 60) {
        if (this.being === 'Shaman') {
          for (var i in Map.list[this.mapId].mobList)
            this.attack(Map.list[this.mapId].mobList[i]);
        } else
          this.attack(this.target);
        this.attacking = false;
        this.attackingTicks = 0;
      }
    }
  }
  attack(target) {
    this.levelUp();
    var damageAfterModifyers = this.damage * Math.pow(1.1, this.level);
    target.health -= damageAfterModifyers;
  }
  levelUp() {
    while (600 * Math.pow(6 / 5, this.level) - 500 <= this.xp) {
      this.level++;
      console.log('level ' + this.level);
    }
  }
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
    var playerName = '' + socket.id;
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
