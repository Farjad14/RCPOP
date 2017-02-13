function toRadians (angle) {
  return angle * (Math.PI / 180);
}


function toDegrees (angle) {
  return angle * (180 / Math.PI);
}





/*
This is our server app. It's both a web server and a socket.io server. 
The server listens on port 3000, so you have to mention the port number 
when you request pages from the server i.i. http://localhost:3000 for example if the server
is running on your machine.

This server sends updates to all clients once every 50ms. 
The server recieves updates from connected clients asynchronously. Meaning, at any time, 
a client can send updates to this server in the form of socket.io tagged messages. 
The messages from the client can contain position information and other types of information. 
*/


// constants that define fixed quantities in our program
const carWidth = 100;
const carHeight = 100;
const speed = 10; // 10 pixels per milliseconds.
const map_width = 5000;
const map_height = 5000;
const PERC_GAIN = 1/4;
const BASE_GAIN = 1;
const MAX_SPEED = 18;

//this is a constructor to create a car object. 
car = function(x, y, orientation){
	var self = {
	x:x,
	y:y,
	nickname: null,
	prev_x:0, 
	prev_y:0,
	cur_stamp:0,
	prev_stamp:0,
	orientation: orientation, //orientatin in degrees
	id: -1,
	speed: speed, //default speed
  score:0,
	alive:1,
	tipx:0,
	tipy:0,
	balloonx:0,
	balloony:0,
	};
		
	return self;
} 

//this is a constructor to create a power up object
powerUp = function(x, y, type){
	var self = {
	x:x,
	y:y,
	type:type,
	};
		
	return self;
} 

//a list that holds all powerUp objects on the map
powerUps = [];


//a list that holds all cars on the map
cars = [];


//instantiate the express module and use it to build an http server. 
//var app = require('express')();
//var http = require('http').Server(app);


var express = require('express');
var app = express();
var http = require('http').Server(app);


//mount a socket.io server on top of the http server. 
var io = require('socket.io')(http);

//response to http requests
app.get('/', function(req, res){
  res.sendFile(__dirname + '/page.html');
});
app.use('/', express.static(__dirname + '/client'));

//connection event from a socket.io client. This event is triggered when 
//a socket.io client first connects to this server - so once per connection request
io.on('connection', function(socket){
	console.log('a user connected');
	
	//disconnect event -  a client disconnected
	socket.on('disconnect', function(){
		console.log('user disconnected');
		//remove from the cars list the car that disconnected
		for(i = 0; i < cars.length; i++){
			if(cars[i].id == socket.id){
				cars.splice(i,1);
          }
        }
		
	});

	/*
	a new client request - this is a joing request from a connected client
	*/
	socket.on('new client', function(nickname){
		if(nickname.length > 12){
console.log(nickname.length);
			socket.emit("id", null);
			return;
		}

		//is the nickname already taken? 
		for(i = 0; i < cars.length; i++){
			if(cars[i].nickname == nickname){
			socket.emit("id", null);
			return;	
			}
		}
  	//generate random location for the new player
  	var randposition = generateSpawnLoc();

	/* create a new car with position and orientation data from client*/
  	newCar = car(randposition.x, randposition.y, randposition.orientation);
  	newCar.id = socket.id;
  	newCar.nickname = nickname;
	cars.push(newCar);
    console.log('car created and added to cars list. Car id: '+socket.id);
    socket.emit("id", {id:newCar.id, x:newCar.x, y:newCar.y, orientation:newCar.orientation, 
    		nickname:newCar.nickname});
	});

	
	/*
	When receiving position + orientation updates from cleints, update the corresponding car
	object in the cars list with the new positio and orientation information
	*/
	socket.on('position', function(data){
		for(i = 0; i < cars.length; i++){
			if(cars[i].id == socket.id){
				cars[i].prev_x = cars[i].x;
				cars[i].prev_y = cars[i].y;
				//cars[i].prev_stamp = cars[i].cur_stamp;

				cars[i].x = data.x;
				cars[i].y = data.y;
				cars[i].orientation = data.orientation;

				if(data.x > map_width || data.x < 0 || data.y > map_height || data.y < 0){//out of bounds, dead
					cars[i].alive = 0;
				}
				//console.log("cars[i].x:  "+cars[i].x+ ", cars[i].y: "+cars[i].y+ 
				//	", "+cars[i].orientation+"cars[i].orientation");
					break;
			}
		}
		//console.log("*******************************");
		//console.log("client: "+data.id+ " position updated: ("+data.x +", "+data.y+")");
		//socket.emit('position', "no clash"); 	
	});
	
function detectPop(sprite){
	for(i = 0; i < cars.length; i++){
			//compute the locatoin of the tip of the needle and the center of the balloon for the two cars
			//the tip of the needle is 50 pixels left of the center and the center of the balloon is 50 pixels right of
			//the car center. Do this for each car: 
			
			balloonx = cars[i].x - (Math.sin(toRadians(cars[i].orientation))*100);
			balloony = cars[i].y + (Math.cos(toRadians(cars[i].orientation))*100);

			tipx = sprite.x + (Math.sin(toRadians(sprite.orientation))*100);
			tipy = sprite.y - (Math.cos(toRadians(sprite.orientation))*100);
			
			//if the distance between the ballon of cars[i] and the tip of cars[j] is less than radius = 50
			if( (Math.pow( balloonx - tipx, 2) + Math.pow( balloony - tipy, 2))  < Math.pow(50,2)  ){
					return cars[i];
			}
			
	}
	return null;
}
	
	/*
	srcCar sends a collision message to server. 
	srcCarData contains the car x and y positions as well as the car id
	*/
	/* socket.on('collision', function(srcCarData){
		console.log('collision event');
		//find the car object for the car the sent the collision event
		var srcCar = findCarById(srcCarData.id);
		
		//next find the target car the collided with srcCar
		var trgtCar = detectCollision(srcCar);
		
	}); */
	socket.on('pop', function(srcCarData){
		//console.log('collision event');
		//find the car object for the car the sent the collision event
		var srcCar = findCarById(srcCarData.id);
		if((srcCar) && (srcCar.alive == 1)) {
			var deadCar = detectPop(srcCar);
      if ((deadCar) && (deadCar.alive == 1)) {
        deadCar.alive = 0;
        //increase car's speed by a percent of the killed cars speed plus base amount
        srcCar.speed += (deadCar.speed - 10)*PERC_GAIN + BASE_GAIN;
        if (srcCar.speed > MAX_SPEED) srcCar.speed = MAX_SPEED;
        srcCar.score++;
      }
		}
		
	});

});


/*
finds car by id
*/
function findCarById(carId){
	for(i = 0; i < cars.length; i++){
			if(cars[i].id == carId){
				return cars[i];
  		}
	}
}

/*
detect colliding cars and removes cars with popped balloons 
*/
function detectCarCollisionsb(){
	
	//first detect car-car collsions
	for(i = 0; i < cars.length; i++){
		for(j = 0; j < cars.length; j++ ){
			if(i==j){continue;}//collsion between the same cars - doesn't make sense
			//compute the locatoin of the tip of the needle and the center of the balloon for the two cars
			//the tip of the needle is 50 pixels left of the center and the center of the balloon is 50 pixels right of
			//the car center. Do this for each car: 
			
			cars[i].balloonx = cars[i].x - (Math.sin(cars[i].orientation)*100);
			cars[i].balloony = cars[i].y + (Math.cos(cars[i].orientation)*100);

			cars[j].tipx = cars[j].x + (Math.sin(cars[i].orientation)*100);
			cars[j].tipy = cars[j].y - (Math.cos(cars[i].orientation)*100);
			
			//if the distance between the ballon of cars[i] and the tip of cars[j] is less than radius = 50
			if( (Math.pow( cars[i].balloonx - cars[j].tipx, 2) +  
				Math.pow( cars[i].balloony - cars[j].tipy, 2))  < Math.pow(50,2)  ){
					//if we have a collision, cars[i] is dead
//console.log(cars[i].x+" "+cars[i].y+" ; "+cars[i].balloonx+" "+cars[j].tipx+" ; "+cars[i].balloony+" "+cars[j].tipy);
					cars[i].alive = 0;	
			} 	
			
			
		}
	}

}

/*
This functin detecs all power up - car collisions 
*/
function detectCarPowerupCollision(){
	//to be implemented!!!
	
}

/*
a function that runs every interval = 50ms - broadcasts all information on server 
to all connected clients 
*/
function updateClients(){
	//console.log("sending updates to clients");
	//determine all collisions and update both the cars list and the power ups list
	//detectCarCollisionsb();
	detectCarPowerupCollision();
	removeDeadCars();
	//broadcast all cars and power ups on the map - the two lists
	io.emit('update', {cars:cars, powerUps:powerUps});
	}
	
	
setInterval(updateClients, 30); //should be 50

/*
removes all cars in the cars list that marked dead, i.e car.alive = 0
*/
function removeDeadCars(){
	
	for(i = 0; i < cars.length; i++){
		if(cars[i].alive == 0){
			cars.splice(i, 1);
	  }
	}
	
}

function generateRandomLoc() {
  var x = Math.floor(Math.random()*4500)+250;
	var y = Math.floor(Math.random()*4500)+250;
  return {x:x, y:y};
}

//generate random position
function generateSpawnLoc(){
	var loc = generateRandomLoc();

  // check that all cars aren't to close to the new spawn point
  // This is a conditional loop not a counted loop
  for(i = 0; i < cars.length; i++){
			if(cars[i].x + 250 > loc.x) continue;
      if(cars[i].x - 250 < loc.x) continue;
      if(cars[i].y + 250 > loc.y) continue;
      if(cars[i].y - 250 < loc.y) continue;  
			
      // Too close to a car, resart the loop with new location
      loc = generateRandomLoc();
      i = 0;  		
  	}
    
  var orientation = Math.floor(Math.random()*360);
	return {x:loc.x, y:loc.y, orientation:orientation};
}


//listen on port 3000 - can change the port later 
http.listen(3000, '0.0.0.0', function(){
  console.log('listening on *:3000');
});







			