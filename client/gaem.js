'use strict';
var socket = io();
var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('signDiv-username');
var signDivSignIn = document.getElementById('signDiv-signIn');
var signDivSignUp = document.getElementById('signDiv-signUp');
var signDivPassword = document.getElementById('signDiv-password');
var signDivMap = document.getElementById('signDiv-map');
var playerType = document.getElementById('playerType');
document.addEventListener('click', onClick);
var innerButtons = [];
var inventory = [];
var dooDads = [0, 0, 0, 0, 0, 0, 0, 0, 0];
var menuButtons = [
new Button(500,550,0,20,openMap),
new Button(550,600,0,20,drawInventory),
//new Button(600, 650, 0, 20, drawInventory)
];
var images = [
  { image: "img/CharacterKnight.png", size: 32, inverse: 1 },
  { image: "img/CharacterWizard.png", size: 32, inverse: 1 },
  { image: "img/CharacterThief.png", size: 32, inverse: 1 },
  { image: "img/CharacterShaman.png", size: 32, inverse: 1 },
  { image: "img/mob9.png", size: 32, inverse: 1 },
  { image: "img/mob8.png", size: 48, inverse: -1 },
  { image: "img/mob7.png", size: 32, inverse: 1 },
  { image: "img/mob6.png", size: 32, inverse: 1 },
  { image: "img/mob5.png", size: 32, inverse: 1 },
  { image: "img/mob4.png", size: 32, inverse: 1 },
  { image: "img/mob3.png", size: 32, inverse: 1 },
  { image: "img/mob2.png", size: 32, inverse: -1 },
  { image: "img/mob1.png", size: 32, inverse: -1 }
];
var itemImages = [
  { image: "img/items.png", size: 32, rowLength: 16, total: 150 }
];
Sprite.list = {};
Item.list = {};
var itemHash = {
  mob1: [
    { item: 13, image: 0 },
    { item: 0, image: 0 },
    { item: 1, image: 0 },
    { item: 2, image: 0 },
    { item: 2, image: 0 }
  ],
  mob2: [
    { item: 29, image: 0 }
  ],
  mob3: [
    { item: 45, image: 0 }
  ],
  mob4: [
    { item: 57, image: 0 }
  ],
  mob5: [
    { item: 93, image: 0 }
  ],
  mob6: [
    { item: 109, image: 0 }
  ],
  mob7: [
    { item: 60, image: 0 }
  ],
  mob8: [
    { item: 76, image: 0 }
  ],
  mob9: [
    { item: 92, image: 0 }
  ]
};
var imageLoader = function(i) {
  var imageItem = new Image();
  imageItem.src = itemImages[i].image;
  imageItem.addEventListener('load', function() {
    if (i < itemImages.length - 1)
      imageLoader(i + 1);
  });
}
var itemLoader = function() {
  for (var i in itemHash) {
    for (var j = 0; j < itemHash[i].length; j++) {
      var curr = itemHash[i][j];
      var currImage = new Image()
      currImage.src = itemImages[curr.image].image;
      var currSize = itemImages[curr.image].size;
      var currRowSize = itemImages[curr.image].rowLength;
      Item.list[i + "item" + j] = new Item(currImage,curr.item % currRowSize * currSize,Math.floor(curr.item / currRowSize) * currSize,currSize,currSize);
    }
  }
}
var spriteLoader = function(i) {
  var image = new Image();
  image.src = images[i].image;
  console.log(image.src);
  image.addEventListener('load', function() {
    Sprite.list[image.src.substring(image.src.indexOf("img") + 4, image.src.length - 4)] = new Sprite(image,images[i].size,images[i].size,10,images[i].inverse);
    if (i < images.length - 1)
      spriteLoader(i + 1);
  });
}
imageLoader(0);
itemLoader();
spriteLoader(0);

signDivSignIn.onclick = function() {
  if (playerType.elements["playerTypes"].value)
    socket.emit('signIn', {
      username: signDivUsername.value,
      password: signDivPassword.value
    });
}
signDivSignUp.onclick = function() {
  socket.emit('signUp', {
    username: signDivUsername.value,
    password: signDivPassword.value
  });
}
socket.on('signInResponse', function(data) {
  if (data.success) {
    signDiv.style.display = 'none';
    gameDiv.style.display = 'inline-block';
    ctx.fillStyle = "rgba(206,255,255,1)";
    ctx.fillRect(500, 0, 200, 500);
    drawButtons();
    var last = new Image();
    last.src = "img/mob1.png";
    last.addEventListener('load', function() {
      socket.emit('loaded', {
        playerType: playerType.elements["playerTypes"].value,
        map: signDivMap.value
      });
    });
  }
  else
    alert("Sign in failed");
});
socket.on('signUpResponse', function(data) {
  if (data.success) {
    alert("Sign up successful");
  }
  else
    alert("Sign up failed");
});

var ctx = document.getElementById("ctx").getContext("2d");
ctx.imageSmoothingEnabled = false;
var chatText = document.getElementById('chat-text');
var chatInput = document.getElementById('chat-input');
var chatForm = document.getElementById('chat-form');
ctx.font = "30px Ariel";
var positions;
socket.on('newPosition', function(data) {
  positions = data;
});

socket.on('addToChat', function(data) {
  chatText.innerHTML += '<div>' + data + '</div>';
});

chatForm.onsubmit = function(e) {
  e.preventDefault();
  socket.emit('sendText', chatInput.value);
  chatInput.value = '';
}

var Player = function(pack) {
  var self = {};
  self.number = pack.number;
  self.x = pack.x;
  self.y = pack.y;
  self.sprite = Sprite.list["Character" + pack.being];
  self.sprite = new Sprite(self.sprite.image,self.sprite.width,self.sprite.height,self.sprite.rowLength,self.sprite.inverse);
  Player.list[self.number] = self;
  return self;
}
Player.list = {};
var Mob = function(pack) {
  var self = {}
  self.number = pack.number;
  self.x = pack.x;
  self.y = pack.y;
  self.sprite = Sprite.list[pack.being];
  self.sprite = new Sprite(self.sprite.image,self.sprite.width,self.sprite.height,self.sprite.rowLength,self.sprite.inverse);
  Mob.list[self.number] = self;
  return self;
}
Mob.list = {};
socket.on('init', function(data) {
  for (var i in data.players) {
    new Player(data.players[i]);
  }
  for (var i in data.mobs) {
    new Mob(data.mobs[i]);
  }
});
socket.on('update', function(data) {
  for (var i in data.players) {
    Player.list[data.players[i].number].x = data.players[i].x;
    Player.list[data.players[i].number].y = data.players[i].y;
  }
  for (var i in data.mobs) {
    Mob.list[data.mobs[i].number].x = data.mobs[i].x;
    Mob.list[data.mobs[i].number].y = data.mobs[i].y;
  }
});
socket.on('remove', function(data) {
  for (var i in data.players) {
    delete Player.list[data.players[i].number];
  }
  for (var i in data.mobs) {
    delete Mob.list[data.mobs[i].number];
  }
});
socket.on('changeRow', function(data) {
  for (var i in data.players) {
    Player.list[data.players[i].number].sprite.index = 0;
    Player.list[data.players[i].number].sprite.framesOn = 0;
    Player.list[data.players[i].number].sprite.row = data.players[i].row;
    if (data.players[i].reverse)
      Player.list[data.players[i].number].sprite.reverse = data.players[i].reverse;
  }
  for (var i in data.mobs) {
    Mob.list[data.mobs[i].number].sprite.index = 0;
    Mob.list[data.mobs[i].number].sprite.framesOn = 0;
    Mob.list[data.mobs[i].number].sprite.row = data.mobs[i].row;
    if (data.mobs[i].reverse)
      Mob.list[data.mobs[i].number].sprite.reverse = data.mobs[i].reverse;
  }
});
function Button(xStart, xEnd, yStart, yEnd, funct) {
  this.xStart = xStart;
  this.xEnd = xEnd;
  this.yStart = yStart;
  this.yEnd = yEnd;
  this.funct = funct;
  this.isClicked = function(xPosition, yPosition) {
    if (xPosition > this.xStart && xPosition < this.xEnd && yPosition > this.yStart && yPosition < this.yEnd) {
      innerButtons = [];
      ctx.fillStyle = "rgba(206,255,255,1)";
      ctx.fillRect(500, 0, 200, 500);
      this.funct();
      drawButtons();
    }
  }
  this.draw = function() {
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(this.xStart, this.yStart, this.xEnd - this.xStart, this.yEnd - this.yStart);
  }
}
function drawButtons() {
  for (var i = 0; i < menuButtons.length; i++) {
    menuButtons[i].draw();
  }
  for (var i = 0; i < innerButtons.length; i++) {
    innerButtons[i].draw();
  }
}
function onClick(e) {
  var xPosition = e.pageX - gameDiv.offsetLeft;
  var yPosition = e.pageY - gameDiv.offsetTop;
  for (var i = 0; i < menuButtons.length; i++) {
    menuButtons[i].isClicked(xPosition, yPosition);
  }
  for (var i = 0; i < innerButtons.length; i++) {
    innerButtons[i].isClicked(xPosition, yPosition);
  }
}
function openMap() {
  innerButtons.push(new Button(550,650,30,60,function() {
    socket.emit('changeDifficulty', {
      difficulty: 1
    })
  }
  ));
  innerButtons.push(new Button(550,650,80,110,function() {
    socket.emit('changeDifficulty', {
      difficulty: 2
    })
  }
  ));
  innerButtons.push(new Button(550,650,130,160,function() {
    socket.emit('changeDifficulty', {
      difficulty: 3
    })
  }
  ));
  innerButtons.push(new Button(550,650,180,210,function() {
    socket.emit('changeDifficulty', {
      difficulty: 4
    })
  }
  ));
  innerButtons.push(new Button(550,650,230,260,function() {
    socket.emit('changeDifficulty', {
      difficulty: 5
    })
  }
  ));
  innerButtons.push(new Button(550,650,280,310,function() {
    socket.emit('changeDifficulty', {
      difficulty: 6
    })
  }
  ));
  innerButtons.push(new Button(550,650,330,360,function() {
    socket.emit('changeDifficulty', {
      difficulty: 7
    })
  }
  ));
  innerButtons.push(new Button(550,650,380,410,function() {
    socket.emit('changeDifficulty', {
      difficulty: 8
    })
  }
  ));
  innerButtons.push(new Button(550,650,430,460,function() {
    socket.emit('changeDifficulty', {
      difficulty: 9
    })
  }
  ));
}
function Item(image, xImage, yImage, width, height) {
  this.image = image;
  this.xImage = xImage;
  this.yImage = yImage;
  this.width = width;
  this.height = height;
  this.draw = function(xPosition, yPosition) {
    ctx.drawImage(this.image, this.xImage, this.yImage, width, height, xPosition, yPosition, 32, 32);
  }
}
function drawInventory() {
  for (var i = 0; i < inventory.length; i++) {
    inventory[i].draw(500 + i % 6 * 32, Math.floor(i / 6) * 32 + 20);
  }
}
function drawDooDads() {
  yValue = 0;
  for (var i in itemHash) {
    itemHash[i][0].draw(500, yValue * 32 + 20);
    ctx.fillText(dooDads[yValue], 532, yValue * 32 + 20);
    yValue++;
  }
}
socket.on('addItem', function(data) {
  var rand = Math.floor(Math.random() * itemHash[data.being].length);
  //rand < 1 ? dooDads[data.being.substring(data.being.length - 1)]++:
  inventory.push(Item.list[data.being + "item" + rand]);
});
function Sprite(image, width, height, rowLength, inverse) {
  this.image = image;
  this.width = width;
  this.height = height;
  this.index = 0;
  this.row = 0;
  this.rowLength = rowLength;
  this.framesOn = 0;
  this.inverse = inverse;
  this.reverse = 1;
  this.draw = function(xPosition, yPosition) {
    ctx.save();
    if (this.reverse * this.inverse === -1)
      ctx.scale(-1, 1);
    ctx.drawImage(this.image, this.width * this.index, this.height * this.row, this.width, this.height, this.reverse * this.inverse * (xPosition - this.width * 3 / 2), yPosition - this.height * 3 / 2, this.reverse * this.inverse * this.width * 3, this.height * 3);
    ctx.restore();
    if (this.framesOn >= 60 / rowLength) {
      this.index++;
      this.framesOn = 0;
    }
    this.framesOn++;
    if (this.index > this.rowLength - 1)
      this.index = 0;
  }
}
setInterval(function() {
  ctx.clearRect(0, 0, 500, 500);
  for (var i in Player.list) {
    Player.list[i].sprite.draw(Player.list[i].x, Player.list[i].y);
  }
  for (var i in Mob.list) {
    Mob.list[i].sprite.draw(Mob.list[i].x, Mob.list[i].y);
  }
}, 1000 / 60);