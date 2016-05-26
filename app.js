var mongojs = require("mongojs");
var db = mongojs('mongodb://gaem:gaem@ds011943.mlab.com:11943/gaem', ['account','progress']);
//var db = mongojs('localhost:27017/myGame', ['account','progress']);
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get("/", function(req, res){
	res.sendFile(__dirname + '/client');
});
//app.use('/client', express.static(__dirname + '/client'));
app.use(express.static('client'));
var port = Number(process.env.PORT || 6969);
serv.listen(port);

var socketlist = {};
var playerlist = {};
var Entity = function(playerId){
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
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.xSpeed;
		self.y += self.ySpeed;
	}
	return self;
}
var Map = function(mapId){
	self = {
		id: mapId,
		mobList: [],
		playerList: [],
		initPack: {players:[],mobs:[]},
		removePack: {players:[],mobs:[]},
		changeRowPack: {players:[], mobs:[]},
		mobCount: 0,
		playerCount: 0,
		toDelete: false
	}
	self.addMob = function(mob){
		Map.list[mob.id].mobList.push(mob);
	}	
	self.addPlayer = function(player, mapId){
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
	self.onStart = function(mapId){
		var playerPack = []
		for(var i in Map.list[mapId].playerList){
			playerPack.push({
				being: Map.list[mapId].playerList[i].being,
				number: Map.list[mapId].playerList[i].arrayPosition,
				x: Map.list[mapId].playerList[i].x,
				y: Map.list[mapId].playerList[i].y
			});
		}
		var mobPack = []
		for(var i in Map.list[mapId].mobList){
			mobPack.push({
				being: Map.list[mapId].mobList[i].being,
				number: Map.list[mapId].mobList[i].arrayPosition,
				x: Map.list[mapId].mobList[i].x,
				y: Map.list[mapId].mobList[i].y
			});
		}
		return {players: playerPack, mobs: mobPack}
	}
	Map.list[self.id] = self;
	return self;
}
Map.list = {};
var Mob = function(id, difficulty){
	var self = Entity(id);
	self.x = Math.random()*500;
	self.y = Math.random()*500;
	self.range = 60;
	self.being = "mob" + difficulty;
	self.speed = 2;
	self.damage = 10;
	self.health = 50;
	self.xpGiven = 10;
	self.arrayPosition = Map.list[self.id].mobCount;
	Map.list[self.id].mobCount++;
	var super_update = self.update;
	Map.list[self.id].initPack.mobs.push({
		being: self.being,
		number: self.arrayPosition,
		x: self.x,
		y: self.y
	});
	
	self.update = function(){
		var a = self.tick();
		super_update();
		return a;
	}
	self.tick = function(){
		if(this.health <= 0){
			Map.list[self.id].removePack.mobs.push({number: self.arrayPosition});
			delete Map.list[self.id].mobList[self.arrayPosition];
			self.giveXP();
			return false;
		} else {
			if (!self.target){
				var closest = 9999999999;
				var position = -1;
				for(var i in Map.list[self.id].playerList){
					var player = Map.list[self.id].playerList[i];
					var distance = Math.pow(player.x-self.x,2) +Math.pow(player.y-self.y,2);
					if(distance < closest){
						closest = distance;
						position = i;
					}
				}
				if(position > -1){
					self.target = Map.list[self.id].playerList[position];
					Map.list[self.id].changeRowPack.mobs.push({
						number: self.arrayPosition,
						row: 2,
						reverse:self.target.x > self.x ? 1:-1
					});
				}
			}
			if(!self.attacking){
				if(Math.pow(self.target.x-self.x,2) +Math.pow(self.target.y-self.y,2)<self.range*self.range){
					self.attacking = true;
					Map.list[self.id].changeRowPack.mobs.push({
						number: self.arrayPosition,
						row: 3,
						reverse: self.target.x > self.x ? 1:-1
					});
				}
				else{
					var angle = Math.atan2(self.target.y - self.y,self.target.x - self.x);
					self.xSpeed = Math.cos(angle)*self.speed;
					self.ySpeed = Math.sin(angle)*self.speed;
				}
			}
			if(self.attacking){
				self.xSpeed = 0;
				self.ySpeed = 0;
				self.attackingTicks++;
				if(self.attackingTicks >= 60){
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
	self.attack = function(target){
		target.health -= self.damage;
	}
	self.giveXP = function(){
		var numberOfPlayers = Map.list[self.id].playerList.length;
		for(var i in Map.list[self.id].playerList){
			Map.list[self.id].playerList[i].xp += self.xpGiven/numberOfPlayers;
		}
	}
	return self;
}

var Player = function(id, playerType){
	var self = Entity(id);
	self.being = playerType;
	if(self.being === "Knight"){
		self.speed = 2;
		self.health = 1000;
		self.damage = 25;
		self.range = 60;
	} else if(self.being === "Shaman"){
		self.speed = 1;
		self.health = 500;
		self.damage = 10;
		self.range = 9999999999;
	} else if(self.being === "Thief"){
		self.speed = 2;
		self.health = 750;
		self.damage = 20;
		self.range = 60;
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
	self.updateMapId = function(newId){
		self.mapId = newId;
		self.arrayPosition = Map.list[self.mapId].playerCount;
		Map.list[self.mapId].playerCount++;
	}
	self.update = function(){
		self.tick();
		super_update();
	}
	self.tick = function(){
		if (!self.target){
			var closest = 9999999999;
			var position = -1;
			for(var i in Map.list[self.mapId].mobList){
				var mob = Map.list[self.mapId].mobList[i];
				var distance = Math.pow(mob.x-self.x,2) +Math.pow(mob.y-self.y,2);
				if(distance < closest){
					closest = distance;
					position = i;
				}
			}
			if(position > -1){
				self.target = Map.list[self.mapId].mobList[position]
				Map.list[self.mapId].changeRowPack.players.push({
					number: self.arrayPosition,
					row: 2,
					reverse: self.target.x > self.x ? 1:-1
				});
			}
		}
		if(self.target && !self.attacking){
			var angle = Math.atan2(self.target.y - self.y,self.target.x - self.x);
			self.xSpeed = Math.cos(angle)*self.speed;
			self.ySpeed = Math.sin(angle)*self.speed;
			if(Math.pow(self.target.x-self.x,2) +Math.pow(self.target.y-self.y,2)<self.range*self.range){
				self.attacking = true;
				Map.list[self.mapId].changeRowPack.players.push({
					number: self.arrayPosition,
					row: 3,
					reverse: self.target.x > self.x ? 1:-1
			});
			}
		}
		if(self.attacking){
			self.xSpeed = 0;
			self.ySpeed = 0;
			self.attackingTicks++;
			if(!Map.list[self.mapId].mobList[self.target.arrayPosition]){
			self.target = undefined;
			self.attacking = false;
			self.attackingTicks = 0;
				Map.list[self.mapId].changeRowPack.players.push({
					number: self.arrayPosition,
					row: 0,
				});
			}
			if(self.attackingTicks >= 60){
				if(self.being === "Shaman") {
					for(var i in Map.list[self.mapId].mobList) 
						self.attack(Map.list[self.mapId].mobList[i]);
				} else self.attack(self.target);
				self.attacking = false;
				self.attackingTicks = 0;
			}
		}
	}
	self.attack = function(target){
		self.levelUp();
		var damageAfterModifyers = self.damage*Math.pow(1.1,self.level);
		target.health -= damageAfterModifyers;
	}
	self.levelUp = function(){
		while (600 * Math.pow(6/5, self.level) - 500 <= self.xp) {
      self.level++;
		}
	}
	playerlist[socketlist[self.id]] = self;
	return self;
}
Player.onConnect = function(socket, playerType, mapId){
	if(!mapId) mapId = Math.random();
	var map = Map.list[mapId] || new Map(mapId);
	var player = new Player(socket.id, playerType);
	console.log(map.id);
	map.addPlayer(player,map.id);
}

Player.onDisconnect = function(socket){
	if(playerlist[socket]){
		Map.list[playerlist[socket].mapId].removePack.players.push({number: playerlist[socket].arrayPosition});
		delete Map.list[playerlist[socket].mapId].playerList[playerlist[socket].arrayPosition];
	//if(Map.list[playerlist[socket].mapId].playerList.length === 0) delete Map.list[playerlist[socket].mapId];
	}
}

Map.update = function(map){
	var mobPack = [];
	for(var i in Map.list[map].mobList){
		mob = Map.list[map].mobList[i];
		if(mob.update()){
			mobPack.push({
				number: mob.arrayPosition,
				being: mob.being,
				x: mob.x,
				y: mob.y
			});
		}
	}
	var playerPack = [];
	for(var i in Map.list[map].playerList){
		player = Map.list[map].playerList[i];
		player.update();
		playerPack.push({
			number: player.arrayPosition,
			being: player.being,
			x: player.x,
			y: player.y
		});
	}
	var pack = {
		players:playerPack,
		mobs:mobPack
	}
	return pack;
}

var isValidPassword = function(data,cb){
	db.account.find({username:data.username,password:data.password},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});
}

var isUsernameTaken = function(data,cb){
	db.account.find({username:data.username},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});
}

var addUser = function(data,cb){
	db.account.insert({username:data.username,password:data.password},function(err,res){
		cb();
	});
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	socketlist[socket.id] = socket;
	
	socket.on('signIn',function(data){
		isValidPassword(data, function(res){
			if(res){
				socket.emit('signInResponse',{success:true});
			}	else {
				socket.emit('signInResponse',{sucess:false});
			}
		});
	});
	socket.on('loaded',function(data){
		Player.onConnect(socket, data.playerType, data.map);
	});
	socket.on('signUp',function(data){
		isUsernameTaken(data, function(res){
			if(res){
				socket.emit('signUpResponse',{success:false});
			} else {
				addUser(data, function(){
					socket.emit('signUpResponse',{success:true});
				});	
			}
		});
	});
	socket.on('disconnect',function(){
		Player.onDisconnect(socket);
		//delete socketlist[socket.id];
	});
	
	socket.on('sendText',function(data){
		var playerName = "" + socket.id;
		for(var i in socketlist){
			socketlist[i].emit('addToChat', playerName +': ' + data);
		}
	});
});

setInterval(function(){
	for(var i in Map.list){
		var pack = Map.update(i);
		for(var j in Map.list[i].playerList){
			var socket = socketlist[Map.list[i].playerList[j].id];
			if(socket){
				socket.emit('remove',Map.list[i].removePack);
				socket.emit('init',Map.list[i].initPack);
				socket.emit('changeRow',Map.list[i].changeRowPack);
				socket.emit('update',pack);
			}
		}
		Map.list[i].initPack.players = [];
		Map.list[i].initPack.mobs = [];
		Map.list[i].removePack.players = [];
		Map.list[i].removePack.mobs = [];
		Map.list[i].changeRowPack.players = [];
		Map.list[i].changeRowPack.mobs = [];
		if(Math.random()<.005){ 
			Map.list[i].addMob(new Mob(i, 1));
		}
	}
},1000/60);
