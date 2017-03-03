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
const SPEEDPUP3 = 3;
const SPEEDPUP1 = 3;


//global variables that define variant quantities in our program
var numOfClients = 0; //initially zero

// type 1 and type 2 power up variables that track time intervals through timestamps
//basically new power ups are created every some interval (depending on the type of the power up)
//and these power ups are only spawned again that interval is gone by. 
var Type1Pup = 0;
var Type2Pup = 0;
var Type3Pup = 0;



//this is a constructor to create a car object. 
car = function(x, y, orientation){
	var self = {
	x:x,
	y:y,
	nickname: null,
	prev_x:0, 
	prev_y:0,
	curCollisionStamp:0,
	prevCollisionStamp:0,
	orientation: orientation, //orientatin in degrees
	id: -1,
	rotateUnit: 5,
	collided:0,
	speed: speed, //default speed
	score:0,
	pUp1TimerStart:-1,
	pUp3TimerStart:-1,
	alive:1,
	tipx:0,
	tipy:0,
	powerUp:0, //no power ups initially
	balloonx:0,
	balloony:0,
	prevPUPStamp:0,
	curPUPStamp:0,
	};
		
	return self;
} 

//this is a constructor to create a power up object
powerUp = function(x, y, type){
	var self = {
	x:x,
	y:y,
	type:type,
	consumed:0, //0 means not consumed / 1 means consumed and ready to be removed
	};	
	return self;
} 

//a list that holds all powerUp objects on the map
powerUps = [];


//a list that holds all cars on the map
cars = [];


//instantiate the express module and use it to build an http server. 
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
		
		numOfClients -=1;
	});

	/*
	a new client request - this is a join game request from a connected client
	Make sure the nickname is valid - if not, return to client with an 'id' taggged message
	*/
	socket.on('new client', function(nickname){
		if(nickname.length > 12|| nickname.length < 1){
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
		
		//at this point, the nickname of the new client is valid - proceed
		
		//the game just started - player #1 wants to join
		if (numOfClients == 0){
			
			//record current time for all three types of power ups
			//We will use timestamps to know when to refill all power ups of some time
			Type1Pup = Math.floor(Date.now() / 1000); //in seconds
			Type2Pup = Math.floor(Date.now() / 1000);
			Type3Pup = Math.floor(Date.now() / 1000);
			//generate a whole bunch of power ups - each with location and type
			//the maximum number of power ups are created of all three types of power ups when
			//the game starts
			generatePowerUps();
		}
		
		numOfClients+=1; //increment number of players
		
		//generate random location for the new player
		var randposition = generateSpawnLoc();

		/* create a new car with random position and orientation */
		newCar = car(randposition.x, randposition.y, randposition.orientation);
		newCar.id = socket.id;
		//newCar.socket = socket;
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
				
				break;
			}
		}
		//console.log("*******************************");
		//console.log("client: "+data.id+ " position updated: ("+data.x +", "+data.y+")");
		//socket.emit('position', "no clash"); 	
	});
	
	
	/*
	Upon the receit of a power up notification, this handler is invoced to process it
	It confirms whether the power up was indeed consumed by srcCar and applies power up effects 
	accroding to the type of power up consumed by srcCar
	*/
	socket.on('powerUp', function(srcCarData){
		console.log('potential powerup event');
		
		//find the car object for the car the sent the collision event
		var srcCar = findCarById(srcCarData.id);
		
		//save current power up time stamp to previous
		srcCar.prevPUPStamp = srcCar.curPUPStamp;
			
		//record time stamp of this power up notification
		srcCar.curPUPStamp = Date.now();
		
		//if the two collision are too close - within 50ms, ignore the second one
		if(srcCar.curPUPStamp - srcCar.prevPUPStamp > 50){ //proceed to process the power up request
			
			//check to see if the car has indeed consumed a power and if it has, set the powerUp field
			//to the type of the power - a number - and mark the powerUP object as consumed
			detectCarPowerupCollisions(srcCar); //this function does all of the above
			
			if(srcCar.powerUp == 1){
				//this is a power down
				srcCar.rotateUnit -= SPEEDPUP1; //-3
				//set start timer for power up
				src.pUp1TimerStart = Math.floor(Date.now() / 1000); //lasts for 10 seconds	
			}
			
			else if(srcCar.powerUp == 2){
				//we have 4 of this power up - once consumed, your car destroys all cars within radius
				//all cars within 300 piecels of range/radius die
				//loop:
				for(i = 0; i < cars.length; i++){
					if( (Math.pow( cars[i].x - srcCar.x, 2) + Math.pow( cars[i].y - srcCar.y, 2))  <  
						Math.pow(300, 2) && (srcCar.id != cars[i].id)){
						cars[i].alive = 0;	
						deadCar = cars[i];
						//increase car's speed by a percent of the killed cars speed plus base amount
						//srcCar.speed += (deadCar.speed - 10)*PERC_GAIN + BASE_GAIN;
						srcCar.speed +=1;
						if (srcCar.speed > MAX_SPEED){
							srcCar.speed = MAX_SPEED;
						}
							srcCar.score++;
					}
				}
			}
			
			else if(srcCar.powerUp == 3){
				//we have only 1 of this power ups -  so this gotta be the special power up 
				srcCar.speed += SPEEDPUP3; //+3
				if (srcCar.speed > MAX_SPEED){ 
					srcCar.speed = MAX_SPEED;
				}
				//this power up lasts for 6 seconds ******* set start timer
				srcCar.pUp3TimerStart = Math.floor(Date.now() / 1000); 
			}

		}
	}); 
	
		/*
	srcCar sends a collision message to server. 
	srcCarData contains the car x and y positions as well as the car id
	*/
	 socket.on('collision', function(srcCarData){
		console.log('potential collision event');
			
		//find the car object for the car the sent the collision event
		var srcCar = findCarById(srcCarData.id);
		
		//save previous collision time stamp
		srcCar.prevCollisionStamp = srcCar.curCollisionStamp;
			
		//record time stamp of this collision
		srcCar.curCollisionStamp = Date.now();
		
		//if the two collision are too close - within 50ms, ignore the second one
		if(srcCar.curCollisionStamp - srcCar.prevCollisionStamp > 50){ //proceed to process collision
			
			//next find the target car the collided with srcCar
			var trgtCar = detectCollision(srcCar);
			
			if (trgtCar) { //if collision confirmed - trgtCar isn't null
				
				srcCar.collided = 1;
				trgtCar.collided = 1;
				
				//handle collision event - update orientation and lcoation of both collided cars:
				newTrgtCarOrientation = srcCar.orientation;
				newSrcCarOrientation = trgtCar.orientation;
				var diffInOrientation = Math.abs(srcCar.orientation - trgtCar.orientation);
				if(diffInOrientation > 90){ //too radical the difference in orientation`
					newSrcCarOrientation = trgtCar.orientation+((srcCar.orientation - trgtCar.orientation) % 90);
					newTrgtCarOrientation = srcCar.orientation+((trgtCar.orientation - srcCar.orientation) % 90);
					
				}
				
				//updated orientation and position of srcCar - position is 100 pixels ahead along the new orientation
				srcCar.orientation = newSrcCarOrientation;
				srcCar.x = srcCar.x + (Math.sin(toRadians(srcCar.orientation))*100);
				srcCar.y = srcCar.y - (Math.cos(toRadians(srcCar.orientation))*100);
				
				//updated orientation and position of trgCar - position is 100 pixels ahead along the new orientation
				trgtCar.orientation = newTrgtCarOrientation;	
				trgtCar.x= trgtCar.x + (Math.sin(toRadians(trgtCar.orientation))*100);
				trgtCar.y= trgtCar.y - (Math.cos(toRadians(trgtCar.orientation))*100);
			}
		
		}
	}); 
		
	
		
	/*
	car pop event comes from client. Verify pop and update parameters accordingly.
	*/
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
					
					//Update leaderboard
					updateLeaderboard();
			}
		}
		
	});

});

function compare(a,b) {
  if (a.score > b.score)
    return -1;
  if (a.score < b.score)
    return 1;
  return 0;
}

function updateLeaderboard(){
	cars.sort(compare);
	for(i=0; i<cars.length; i++) console.log(cars[i].score);
    console.log("Done");
}


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
			if(cars[i].x + 350 > loc.x) continue;
      if(cars[i].x - 350 < loc.x) continue;
      if(cars[i].y + 350 > loc.y) continue;
      if(cars[i].y - 350 < loc.y) continue;  
			
      // Too close to a car, resart the loop with new location
      loc = generateRandomLoc();
      i = 0;  		
  	}
    
  var orientation = Math.floor(Math.random()*360);
	return {x:loc.x, y:loc.y, orientation:orientation};
}


//listen on port 3000 - can change the port later 
http.listen(2999, '0.0.0.0', function(){
  console.log('listening on *:2999');
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
	return null;
}



/*
function takes a car object and it determines whether the car object has popped another car
returns popped car by srcCar or null 
*/
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
This functin detects if a certain car has consumed a power up
goes through all available poewr ups in the game and find one if exists that's been consumed by
srcCar
*/
function detectCarPowerupCollisions(srcCar){
	
	for(j = 0; j < powerUps.length; j++){

		if(powerUps[j].consumed == 0){ //if the power up isn't consumed, proceed
			//check distance between center of power up and center of car 
			if(powerUps[j].type != 3){ // type one or type 2 power up
				//a power up is a square with 100 x 100 dimensions
				if( (Math.pow( srcCar.x - powerUps[j].x, 2) + 
				Math.pow( srcCar.y - powerUps[j].y, 2))  <  Math.pow(100, 2)){
					//a power up of type 1 or 2 has been eaten/collided with srcCar

					//removes effects of other power ups from scrCar
					//if srcCAr has power up of type 1, clear it before adding the effects
					//of the newly consumed power up
					if(srcCar.powerUp == 1){//the power down that should last for 10 seconds
						srcCar.powerUp = 0;
						srcCar.rotateUnit += SPEEDPUP1;
		
					}
					//if srcCAr has power up of type 2, clear it before adding the effects
					if(srcCar.powerUp == 2){
						srcCar.powerUp = 0;
					}
					//if srcCAr has power up of type 3, clear it before adding the effects
					if(srcCar.powerUp == 3){
					
						srcCar.powerUp = 0; //clear power up flag
						//reset speed 
						srcCar.speed = speed + srcCar.score;
						//clamp speed
						if (srcCar.speed > MAX_SPEED){ 
							srcCar.speed = MAX_SPEED;
						}
					}
					
					//set the power up flag of srcCar	
					if(powerUps[j].type == 1){
						cars[i].powerUp = 1; //car gets the power up
						
					}
					else if(powerUps[j].type == 2) {
						cars[i].powerUp = 2; //car gets the power up	
					}
					
					powerUps[j].consumed = 1; //power up is consumed
				}
			}
			
			//for power up type 3 - different distance check 
			else if(powerUps[j].type == 3){
				//if car is within 350 pixels of this power up - it consumed it
				if( (Math.pow( srcCar.x - powerUps[j].x, 2) + 
				Math.pow( srcCar.y - powerUps[j].y, 2))  <  Math.pow(350, 2)){
					
					//remove effects of other powerUPs from scrCar, if they exist
					//if srcCAr has power up of type 1, clear it
					if(srcCar.powerUp ==1){//the power down that should last for 10 seconds
						srcCar.powerUp = 0;
						srcCar.rotateUnit += SPEEDPUP1;
					}
					//if srcCAr has power up of type 2, clear it
					if(srcCar.powerUp == 2){
						srcCar.powerUp = 0;
					}
					//if srcCAr has power up of type 3, clear it
					if(srcCar.powerUp == 3){
					
						srcCar.powerUp = 0; //clear power up flag
						//reset speed 
						srcCar.speed = speed + srcCar.score;
						//clamp speed
						if (srcCar.speed > MAX_SPEED){ 
							srcCar.speed = MAX_SPEED;
						}
					}
					
					
					cars[i].powerUp = 3; //car gets the power up	
					powerUps[j].consumed = 1; //power up is consumed
				}	
			}
		}
	}
 	
}


/*
a function that runs every interval = 50ms - broadcasts all information on server 
to all connected clients 
*/
function updateClients(){
	//console.log("sending updates to clients");
	//determine all collisions and update both the cars list and the power ups list

	//detectCarPowerupCollisions(); //see what cars got what power ups
	
	removeDeadCars(); // popped cars get removed 
	
	removeConsumedPowerUps(); //consumed power ups get removed
	
	checkCarpUps(); //reset power ups - for expired power ups before broadcasting
	
	//time to refill all type 1 power ups? - 60 seconds have passed since last time? 
	if(Math.floor(Date.now() / 1000) - Type1Pup > 60){
		Type1Pup = Math.floor(Date.now() / 1000);
		//first remove all existing type 1 power ups from the powerUps list
		for(i = 0; i < powerUps.length; i++){
			if(powerUps[i].type == 1){
				powerUps.splice(i, 1);
			}
		}
	
		//refill the powerUps list with all type 1 power ups
		generateType1Pups();
	}	
		

	//time to refill all type 2 power ups? - 40 seconds have passed since last time? 
	if(Math.floor(Date.now() / 1000) - Type2Pup > 40){
		Type2Pup = Math.floor(Date.now() / 1000);
		//first remove all existing type 2 power ups from the powerUps list
		for(i = 0; i < powerUps.length; i++){
			if(powerUps[i].type == 2){
				powerUps.splice(i, 1);
			}
		}
		//refill the powerUps list with all type 2 power ups
		generateType2Pups();
	}	

	
	//time to refill all type 3 power ups? - 120 seconds have passed since last time? 
	if(Math.floor(Date.now() / 1000) - Type2Pup > 120){
		Type3Pup = Math.floor(Date.now() / 1000);
		//first remove all existing type 3 power ups from the powerUps list
		for(i = 0; i < powerUps.length; i++){
			if(powerUps[i].type == 3){
				powerUps.splice(i, 1);
			}
		}
		//refill the powerUps list with all type 3 power ups
		generateType3Pups();
	}	
		
	
	
	//broadcast all cars and power ups information to the clients
	io.emit('update', {cars:cars, powerUps:powerUps});
	
	//called after broadcast to reset collision flags of cars
	clearCollisionFlags(); 
	
	}
	

	
setInterval(updateClients, 30); //should be 50



/*
clear collision flags for next round of collision detection.
This function is called after a broadcast
*/
function clearCollisionFlags(){
	
	for(i = 0; i < cars.length; i++){
		cars[i].collided = 0;
	}	
}


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


/*
generates 8 type 1 power ups and pushes them the powerUps list
*/
function generateType1Pups(){
	// 8 powerups of type 1
	newPowerUp = powerUp(1000, 1000, 1);
		powerUps.push(newPowerUp);
	
	newPowerUp = powerUp(1000, 4000, 1);
		powerUps.push(newPowerUp);
		
	newPowerUp = powerUp(2000, 1000, 1);
		powerUps.push(newPowerUp);

	newPowerUp = powerUp(2000, 4000, 1);
		powerUps.push(newPowerUp);	
		
	newPowerUp = powerUp(3000, 1000, 1);
		powerUps.push(newPowerUp);
		
	newPowerUp = powerUp(3000, 4000, 1);
		powerUps.push(newPowerUp);
		
	newPowerUp = powerUp(4000, 1000, 1);
		powerUps.push(newPowerUp);	

	newPowerUp = powerUp(4000, 4000, 1);
		powerUps.push(newPowerUp);	
		
}

/*
generates 4 type 2 power ups and pushes them the powerUps list
*/
function generateType2Pups(){
	//4 power ups of type 2
	newPowerUp = powerUp(2000, 2000, 2);
		powerUps.push(newPowerUp);
		
	newPowerUp = powerUp(2000, 4000, 2);
		powerUps.push(newPowerUp);
	
	newPowerUp = powerUp(4000, 2000, 2);
		powerUps.push(newPowerUp);
		
	newPowerUp = powerUp(4000, 4000, 2);
		powerUps.push(newPowerUp);
}

/*
generate type 1 powerups - only one of these that's place in the center of the arena
*/
function generateType3Pups(){
	//1 power ups of type 3
	newPowerUp = powerUp(2500, 2500, 3);
		powerUps.push(newPowerUp);
		
}

/*
generate 8 type 1 power ups and 4 type 2 power ups at fixed locations on the map
then push these power ups to the powerUps list - this function is called when the game 
starts - the first player joings the game
*/
function generatePowerUps(){
	
	generateType1Pups();
	generateType2Pups();
	generateType3Pups();
}

/*
remove consumed power ups from the powerUps list
*/
function removeConsumedPowerUps(){
	
	for(i = 0; i < powerUps.length; i++){
		if(powerUps[i].consumed == 1){
			powerUps.splice(i, 1);
	  }
	}
	
}

/*
generate a random location on the map to place a new player. 
returns the lcoation as an object {x:x, y:y}
*/
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
      if(cars[i].x - 350 < loc.x) continue;
      if(cars[i].y + 350 > loc.y) continue;
      if(cars[i].y - 350 < loc.y) continue;   
			
      // Too close to a car, resart the loop with new location
      loc = generateRandomLoc();
      i = 0;  		
  	}
    
  var orientation = Math.floor(Math.random()*360);
	return {x:loc.x, y:loc.y, orientation:orientation};
}



/* checks if a a cars power up is expired and resets the corresponding car paramters*/
function checkCarpUps(){
	
	for(i=0; i<cars.length;i++){
		if(cars[i].powerUp ==1){//the ppower down that should last for 10 seconds
			if( Math.floor(Date.now() / 1000) - cars[i].pUp1TimerStart > 10 ){
				cars[i].powerUp = 0;
				cars[i].rotateUnit += SPEEDPUP1;
			}
		}
		
		if(cars[i].powerUp ==2){
			cars[i].powerUp = 0;
			
		}
		
		if(cars[i].powerUp ==3){
			
			if( Math.floor(Date.now() / 1000) - cars[i].pUp3TimerStart > 6 ){
				cars[i].powerUp = 0; //clear power up flag
				//reset speed 
				cars[i].speed = speed + cars[i].score;
				//clamp speed
				if (cars[i].speed > MAX_SPEED){ 
				cars[i].speed = MAX_SPEED;
				}
			}
			
		}
	}
	
}
/*
Three comparisons are done: 
if tip of car1 within radius of body of car2, 
if tip of car2 within radius of body of car1,
if the two needles intersect using equations of lines - not implemented. 

*/
function detectCollision(srcCar){
	for(i = 0; i < cars.length; i++){
			
				//compute coordinates of tips of both cars
				cars[i].tipx = cars[i].x + (Math.sin(toRadians(cars[i].orientation))*100);
				cars[i].tipy = cars[i].y - (Math.cos(toRadians(cars[i].orientation))*100);
				
				srcCar.tipx = srcCar.x + (Math.sin(toRadians(srcCar.orientation))*100);
				srcCar.tipy = srcCar.y - (Math.cos(toRadians(srcCar.orientation))*100);
				
				//check distance between tip and center of cars pairwise for collisions
				if( (Math.pow( srcCar.tipx - cars[i].x , 2) + Math.pow( srcCar.tipy - cars[i].y, 2))  
						<  Math.pow(50, 2) ){
						return cars[i];
					
				}
				
				//check distance between the centers of the two cars for collisions
				if( (Math.pow( cars[i].x - srcCar.x, 2) + Math.pow( cars[i].y - srcCar.y, 2))  <  Math.pow(100, 2) ){
						return cars[i];
					
				}
				
				// we can do another check here to see if the two needles intersect
				//to do this we need to use the parametric equations of both line segments and find common
				//solution for the parametric equations. Not doable / too much work using javascript
				//so for now ignore needle collision		
			
		}
		
		return null;	
}






			