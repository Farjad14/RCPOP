//Server
var socket = io();
var firstPowerUpPush = 0; //initial power up batch marker flag

//kill id
var kid = 0;

//UI
$('#enter_link').click(function() {
    if (gameState != 0) return;
    var nickname = $("#u").val();
    console.log(nickname);
    socket.emit('new client', nickname);
});

document.body.addEventListener("keydown", function(e) {
    if (!e) {
        var e = window.event;
    }
    // sometimes useful

    // Enter is pressed
    if (e.keyCode == 13) {
        if (gameState != 0) return;
        var nickname = $("#u").val();
        console.log(nickname);
        socket.emit('new client', nickname);
    }
}, false);
// End of UI




//define and initialize sprites here
var lastLoop = new Date;; //global fps tracking var
var real_fps = 1; //current running fps
var fps_barrier = 5; //stop rendering if drops below this number till becomes better
var fps = 30; //ideal game fps
var start_fps = 60;
var gameState = 0; //0 - game inactive; 1 - game active
var mouse_x = 0;
var mouse_y = 0;

//init end

//define constants		
const MAX_FEED_LENGTH = 10;


//utility functions
function toRadians(angle) {
    return angle * (Math.PI / 180);
}


function toDegrees(angle) {
    return angle * (180 / Math.PI);
}


//determine current actual running fps
function trackFps() {
    thisLoop = new Date;
    real_fps = 1000 / (thisLoop - lastLoop);
    lastLoop = thisLoop;
}

//normalizes unit according to current fps
function normalize_unit(unit) {
    return (unit * (fps / real_fps));
}




//sprite camera object
function SpriteCamera(sprite, map, x_bound, y_bound, camera_speed) {
    c = this;
    c.targetSprite = sprite;
    c.xBound = x_bound;
    c.yBound = y_bound;
    //start with camera centered on sprite
    c.x = c.targetSprite.x - (c.xBound / 2);
    c.y = c.targetSprite.y - (c.yBound / 2);

    c.speed = camera_speed;

    c.map = map; //map element
    c.map.css({
        left: "50%",
        top: "50%"
    });
    c.mapX = c.map.position().left;
    c.mapY = c.map.position().top;

    map_w = c.map.width();
    map_h = c.map.height();

    center_c_x = (map_w / 2) - c.targetSprite.x;
    center_c_y = (map_h / 2) - c.targetSprite.y;
    new_map_x = c.mapX + center_c_x;
    new_map_y = c.mapY + center_c_y;

    c.map.css({
        left: new_map_x,
        top: new_map_y
    });

    c.mapX = new_map_x;
    c.mapY = new_map_y;


    c.follow = 1;
}

SpriteCamera.prototype = {

    FollowSprite: function() {
        c = this;

        if ((c.follow == false)) {
            return;
        }

        pathX = 0;
        pathY = 0;

        dx = c.targetSprite.x - c.x;
        dy = c.targetSprite.y - c.y;

        if (dx < 0) {
            pathX = dx;
        }
        if (dx > c.xBound) {
            pathX = dx - c.xBound;
        }
        if (dy < 0) {
            pathY = dy;
        }
        if (dy > c.yBound) {
            pathY = dy - c.yBound;
        }

        //no movement required
        if (pathX == 0 && pathY == 0) {
            return;
        }

        moveUnitX = pathX;
        moveUnitY = pathY;


        //deprecated, in case need to have a camera move at a different speed
        speed = normalize_unit(c.speed);

        distance = Math.sqrt(pathX * pathX + pathY * pathY);
        directionX = pathX / distance;
        directionY = pathY / distance;

        moveUnitX = directionX * speed;
        moveUnitY = directionY * speed;

        //check overshoot
        if (Math.abs(moveUnitX) > Math.abs(pathX)) {
            moveUnitX = pathX;
        }
        if (Math.abs(moveUnitY) > Math.abs(pathY)) {
            moveUnitY = pathY;
        }


        new_cam_x = c.x + moveUnitX;
        new_cam_y = c.y + moveUnitY;

        new_map_x = c.mapX - moveUnitX;
        new_map_y = c.mapY - moveUnitY;

        c.map.css({
            left: new_map_x,
            top: new_map_y
        });

        c.x = new_cam_x;
        c.y = new_cam_y;

        c.mapX = new_map_x;
        c.mapY = new_map_y;


    }, //FollowSprite end

    setSpeed: function(speed) {
        c = this;
        c.speed = speed;
    },

    toggleFollow: function() {
        c = this;
        c.follow = 1 - c.follow; //toggle camera follow
    }

};




//movement sprite object
function MoveSprite(elem) {
    s = this;
    s.sprite = elem;
    s.speed = 0; // px per second
    s.x = $(s.sprite).position().left;
    s.y = $(s.sprite).position().top;
    s.targetX = s.x;
    s.targetY = s.y;
    s.rotateUnit = 5;
    s.orientation = 0;
    s.targetOrientation = 0;
    score = 0;
}


MoveSprite.prototype = {

    setPos: function(x, y) {
        s = this;
        s.x = x;
        s.y = y;
        s.sprite.css({
            left: x + "px",
            top: y + "px"
        });
    },

    setScore: function(score) {
        c = this;
        c.score = score;
        $("#score").html("Score: " + score);
    },

    setSpeed: function(speed) {

        s = this;
        s.speed = speed;

    }, //SetSpeed end

    setRotateUnit: function(rotateUnit) {

        s = this;
        s.rotateUnit = rotateUnit;

    }, //setRotateUnit end

    moveTo: function() {

        s = this;
        //s.sprite.css({'transform':'rotate(0deg)'});//prevent buggy position
        target_x = s.targetX;
        target_y = s.targetY;
        //return;//remove this
        if (s.x == target_x && s.y == target_y) {
            return;
        }

        speed = normalize_unit(s.speed);

        pathX = target_x - s.x;
        pathY = target_y - s.y;

        distance = Math.sqrt(pathX * pathX + pathY * pathY);
        directionX = pathX / distance;
        directionY = pathY / distance;

        new_x = s.x + directionX * speed;
        new_y = s.y + directionY * speed;

        //check overshoot
        if (Math.abs(target_x - s.x) <= Math.abs(target_x - new_x)) {
            new_x = target_x;
        }
        if (Math.abs(target_y - s.y) <= Math.abs(target_y - new_y)) {
            new_y = target_y;
        }


        s.sprite.css({
            left: new_x,
            top: new_y
        });

        s.x = new_x; //$(s.sprite).position().left;
        s.y = new_y; //$(s.sprite).position().top;

        return;
    }, //MoveTo end

    //rotate towards given element
    orientSprite: function(obj) {
        s = this;
        s.sprite.css({
            'transform': 'rotate(' + s.orientation + 'deg)'
        });

    }, //rotateTo end

    moveInDirection: function(simulate) {
        s = this;

        angle = s.orientation;
        speed = s.speed;

        if (s.x == s.targetX && s.y == s.targetY) {
            return;
        }

        speed = normalize_unit(speed);


        move_x_unit = (speed * Math.sin(toRadians(angle)));
        move_y_unit = (speed * Math.cos(toRadians(angle)));

        new_x = s.x + move_x_unit;
        new_y = s.y - move_y_unit;

        if (Math.abs(s.targetX - new_x) < speed && Math.abs(s.targetY - new_y) < speed) {
            s.x = s.targetX;
            s.y = s.targetY;
            return;
        }

        s.sprite.css({
            left: new_x,
            top: new_y
        });
        $("#my_name").css({
            left: new_x,
            top: new_y+100
        });

        s.x = new_x; //$(s.sprite).position().left;
        s.y = new_y; //$(s.sprite).position().top;



    }, //moveInDirection end

    moveMap: function(map, target_x, target_y) {

        s.targetX = target_x;
        s.targetY = target_y;
        //return;//remove this


        speed = normalize_unit(s.speed);


        pathX = target_x - s.x;
        pathY = target_y - s.y;

        distance = Math.sqrt(pathX * pathX + pathY * pathY);
        directionX = pathX / distance;
        directionY = pathY / distance;

        new_x = map.position().left + ((directionX * speed) * -1);
        new_y = map.position().top + ((directionY * speed) * -1);

        map.css({
            left: new_x + 'px',
            top: new_y + 'px'
        });


    }, //moveMap end

    setTargetPos: function(target_x, target_y) {

        s = this;
        s.targetX = target_x;
        s.targetY = target_y;

    }, //setTargetPos end

    updateOrientation: function() {

        s = this;
        if (s.orientation == s.targetOrientation) {
            return;
        }

        rotate_unit = normalize_unit(s.rotateUnit);

        if (Math.abs(s.orientation - s.targetOrientation) < rotate_unit) {
            s.orientation = s.targetOrientation;
            return;
        }


        if ((360 - s.targetOrientation + s.orientation < 180) || (s.targetOrientation < s.orientation && s.orientation - s.targetOrientation < 180)) {
            rotate_unit = -1 * rotate_unit;
        }

        new_orientation = s.orientation + rotate_unit;

        if (new_orientation < 0) {
            new_orientation += 360;
        }


        new_orientation = new_orientation % 360;

        s.orientation = Math.min(new_orientation);

    },

    setTargetOrientation: function() {

        s = this;

        px = s.targetX; //for test
        py = s.targetY; //for test

        if (py == s.y && px == s.x) {
            return;
        }

        angle = Math.atan2(py - (s.y), px - s.x); //+50 is center origin y
        angle = (angle * (180 / Math.PI)) + 90;
        if (angle < 0) {
            angle += 360;
        }


        s.targetOrientation = angle;


    }


};




//define and initialize sprites/objects here

var moveObj = $("#moveObj");
var sprite = new MoveSprite(moveObj);
var mini_sprite = $("#mini_sprite");
var mini_otherCars = [];
var map = $("#map");
sprite.setSpeed(10);
//SpriteCamera(sprite,map,x_bound,y_bound,camera_speed)
var spriteCam = null; //new SpriteCamera(sprite,map,200,200,25);
var gameState = 0; //0 - game inactive; 1 - game active

//init end



// Create varaibles for init
var id;
var otherCars = [];
var powerUps = [];
var powerUpImages = [];
//init end




//game mechanic functions
function detectPop() {
    //first detect car-car collsions
    for (i = 0; i < otherCars.length; i++) {
        //compute the locatoin of the tip of the needle and the center of the balloon for the two cars
        //the tip of the needle is 50 pixels left of the center and the center of the balloon is 50 pixels right of
        //the car center. Do this for each car: 

        balloonx = otherCars[i].car.x - (Math.sin(toRadians(otherCars[i].car.orientation)) * 100);
        balloony = otherCars[i].car.y + (Math.cos(toRadians(otherCars[i].car.orientation)) * 100);

        tipx = sprite.x + (Math.sin(toRadians(sprite.orientation)) * 100);
        tipy = sprite.y - (Math.cos(toRadians(sprite.orientation)) * 100);

        //if the distance between the ballon of cars[i] and the tip of cars[j] is less than radius = 50
        if (Math.sqrt(Math.pow(balloonx - tipx, 2) + Math.pow(balloony - tipy, 2)) < 45) {
            return otherCars[i].id;
        }

    }
    return null;
}


function detectpowerup(){
    
     for (j = 0; j < powerUps.length; j++) {
        if(powerUps[j].consumed == 1){
             continue;
        }
        //a power up is a square with 100 x 100 dimensions
        if ((Math.pow(sprite.x - (powerUps[j].x+50), 2) +
                Math.pow(sprite.y - (powerUps[j].y+50), 2)) < Math.pow(100, 2)) {
            console.log("power up event");
            return powerUps[j];
        }
            
    }
    
    return null;
}


function detectCollision() {
    for (i = 0; i < otherCars.length; i++) {
        if (otherCars[i].id != id) {

            //compute coordinates of tips of both cars
            tipx = sprite.x + (Math.sin(toRadians(sprite.orientation)) * 100);
            tipy = sprite.y - (Math.cos(toRadians(sprite.orientation)) * 100);

            //check distance between tip and center of cars pairwise for collisions
            if ((Math.pow(tipx - otherCars[i].car.x, 2) + Math.pow(tipy - otherCars[i].car.y, 2)) < Math.pow(50, 2)) {
                return otherCars[i].id;

            }

            //check distance between the centers of the two cars for collisions
            if ((Math.pow(otherCars[i].car.x - sprite.x, 2) + Math.pow(otherCars[i].car.y - sprite.y, 2)) < Math.pow(100, 2)) {
                return otherCars[i].id;

            }

            // we can do another check here to see if the two needles intersect
            //to do this we need to use the parametric equations of both line segments and find common
            //solution for the parametric equations. Not doable / too much work using javascript
            //so for now ignore needle collision        
        }
    }

    return null;
}



function setKillHud(){
    f =  "<h1> +1 Kill</h>"; 
    $("#killHud").html(f);
    $("#killHud").fadeIn(500);
    setTimeout(function(){
            $("#killHud").fadeOut(1000);		
        }, 2000);
}

//game loop
/////////////////////
function gameLoop(fps) {

    //stop if game is not active
    if (gameState == 0) {
        return;
    }
    trackFps();
    time_ms = 1000 / fps;
    setTimeout((function() {

        //do game logic here:
        ////////////////////

        //show fps
        //$("#fps_log").html(normalize_unit(5)+" ================ "+real_fps+" =========== "+sprite.orientation+" ============= "+sprite.targetOrientation);
        //
        //fps barrier
        if (real_fps > fps_barrier) {

            try {


                //interpret user input
                offset = map.offset();
                target_x = mouse_x - offset.left;
                target_y = mouse_y - offset.top;
                sprite.setTargetPos(target_x, target_y);
                //interpret user input end


                sprite.setTargetOrientation();
                sprite.updateOrientation();
                sprite.orientSprite();
                sprite.moveInDirection();
                spriteCam.FollowSprite();

                //mini map mini sprite
                mini_sprite.css({
                    left: (sprite.x / (5000 / 150)) + "px",
                    top: (sprite.y / (5000 / 150)) + "px"
                });



                boost_percent = 0.2;
                slow_percent = 0.8;

                for (i = 0; i < otherCars.length; i++) {

                    temp_speed_hold = otherCars[i].car.speed;
                    temp_rotate_hold = otherCars[i].car.rotateUnit;

                    target_cur_pos_diff = Math.pow(otherCars[i].car.targetX - otherCars[i].car.x, 2) + Math.pow(otherCars[i].car.targetY - otherCars[i].car.y, 2);



                    if (target_cur_pos_diff > Math.pow((temp_speed_hold * 2.5), 2)) {

                        boost_speed = temp_speed_hold + (temp_speed_hold * boost_percent);

                        boost_rotate = temp_rotate_hold + (temp_rotate_hold * boost_percent);
                        otherCars[i].car.setSpeed(boost_speed);
                        otherCars[i].car.setRotateUnit(boost_rotate);
                    }


                    if (target_cur_pos_diff < Math.pow(temp_speed_hold, 2)) {

                        boost_speed = temp_speed_hold - (temp_speed_hold * slow_percent);

                        otherCars[i].car.setSpeed(boost_speed);
                    }


                    otherCars[i].car.setTargetOrientation();
                    otherCars[i].car.updateOrientation();
                    otherCars[i].car.orientSprite();
                    otherCars[i].car.moveInDirection();

                    otherCars[i].car.setSpeed(temp_speed_hold);
                    otherCars[i].car.setRotateUnit(temp_rotate_hold);

                    //if cars are too much out of sync
                    if (target_cur_pos_diff > Math.pow(temp_speed_hold * 5, 2)) {
                        otherCars[i].car.setPos(otherCars[i].car.targetX, otherCars[i].car.targetY);
                        otherCars[i].car.orientation = otherCars[i].car.targetOrientation;
                    }

                    mini_otherCars[i].css({
                        left: (otherCars[i].car.x / (5000 / 150)) + "px",
                        top: (otherCars[i].car.y / (5000 / 150)) + "px"
                    });
                }

                socket.emit("position", {
                    x: sprite.x,
                    y: sprite.y,
                    id: id,
                    orientation: sprite.orientation
                });

                //check collision
                var othercr = detectCollision();
                if (othercr) { //if not null
                    socket.emit("collision", {
                        id: id,
                        trgetid: othercr
                    });
                }
                
                  //check powerup
                var powerupEvent = detectpowerup();
                if (powerupEvent) { //if not null
                    socket.emit("powerUp", {
                        id:id,
                        x:powerupEvent.x,
                        y:powerupEvent.y,
                        type:powerupEvent.type
                    });
                }
                

                //check pop
                var otherId = detectPop();
                if (otherId) { //not null
                    socket.emit("pop", {
                        id: id,
                        trgtid: otherId
                    });
                }



            } catch (e) {
                alert(e);
            }


        } //fps barrier end
        //controls------------------



        //controls end-------------

        ////////////////////
        //recursive call
        gameLoop(fps);

    }), time_ms);

    return;
} //game loop end
////////////////////




$(document).ready(function() {




    $("#go_animation").click(function() {

        gameState = 1 - gameState;
        gameLoop(start_fps);


    });

    /*
    $("#gameView").click(function(e){
    spriteCam.toggleFollow();
    });
    */



    $("#gameView").mousemove(function(e) {
        try {
            mouse_x = e.pageX;
            mouse_y = e.pageY;
        } catch (e) {
            alert(e);
        }

    });




});




// Create varaibles for init
var id;
var otherCars = [];
var powerUPS = [];


socket.on('id', function(newCar) {

    //console.log(newCar);
    if (newCar == null) {
        alert("------------------\nINVALID USERNAME\n------------------\n\n User names must be;\n - Between 1 to 11 characters long\n - Contain only alphanumeric characters\n - Not contain any offensive language");
        return;
    }
    // Set our players id
    id = newCar.id;
    // Update our cars position

    $("#my_name").html(newCar.nickname);

    sprite.setPos(newCar.x, newCar.y);

    sprite.orientation = newCar.orientation;
    sprite.targetOrientation = newCar.orientation;
    sprite.orientSprite();

    // Upadate our camera's position
    spriteCam = null;
    spriteCam = new SpriteCamera(sprite, map, 200, 200, 20);
    //Reset Score
    sprite.setScore(0);
    $("#splashscreen").fadeOut(500);


    gameState = 1 - gameState;
    gameLoop(start_fps);

});

socket.on('killfeed', function(list) {
    kid++;
    var feed = "";
    if(list.cars[0] != null){
        
        feed = "<p id='"+kid+"'>" + list.cars[0].nickname + "   popped   " + list.cars[1].nickname + "</p>";
    }
    else{
        feed = "<p id='"+kid+"'>" + list.cars[1].nickname + " took the easy way out</p>";
    }
        $("#killfeed").prepend(feed);
    
        $("#"+kid).fadeIn(500);
        setTimeout(function(){
            $("#"+kid).fadeOut(1000);		
              if ($("#"+kid-MAX_FEED_LENGTH-1)) {		
                $("#"+kid-MAX_FEED_LENGTH-1).remove();		
            }		
        }, 2000);
        
});

socket.on('update', function(lists) {
    if (gameState == 0) {
        return;
    }

    lboard = "<h2>Scoreboard</h2>";

    //Update Leaderboard
    for (i = 0; i < lists.cars.length; i++) {
        num = i + 1;
        lboard += lists.cars[i].nickname + " " + lists.cars[i].score + "<br/>";
        if (i == 10) {
            break;
        }
    }
    $("#leaderboard").html(lboard);
    //console.log("recieved update from the server.\n List of cars: ");
    try {
        var still_alive = 0;
        // Upadate our list of other players
        for (i = 0; i < lists.cars.length; i++) {
            updatingCar = lists.cars[i];

            if (updatingCar.id == id) {
                //console.log(id);
                //sprite.setPos(updatingCar.x, updatingCar.y);


                //check collision adjustment
                if (updatingCar.collided == 1) {

                    sprite.setPos(updatingCar.x, updatingCar.y);
                    sprite.orientation = updatingCar.orientation;

                }
                if(sprite.score < updatingCar.score){
                    setKillHud();
                }
                sprite.setScore(updatingCar.score);
                sprite.setSpeed(updatingCar.speed);
                still_alive = 1;
                continue;
            }

            //Check if this player is already in our array
            var found = false;
            for (j = 0; j < otherCars.length; j++) {
                //console.log("listCar: "+updatingCar.id + " CarID:" + otherCars[j].id);
                // update it's values if it is
                if (updatingCar.id == otherCars[j].id) {

                    //check collision adjustment
                    if (updatingCar.collided == 1) {
                        otherCars[j].car.setPos(updatingCar.x, updatingCar.y);
                        otherCars[j].car.orientation = updatingCar.orientation;
                    }

                    otherCars[j].car.setTargetPos(updatingCar.x, updatingCar.y);
                    otherCars[j].car.setSpeed(updatingCar.speed);
                    //$("#fps_log").html("X:"+otherCars[j].car.x+" ======== Y:"+otherCars[j].car.y);
                    found = true;
                    break;
                }
            }
            // If it wasn't found add the new player to our array
            if (!found) {
                otherCar = $('<div class="opponentCar"><div class="pin"></div><div class="balloon"></div><div class="player_name">' + updatingCar.nickname + '</div></div>').appendTo("#map");
                var newCar = new MoveSprite(otherCar);
                newCar.setSpeed(10);
                newCar.setPos(updatingCar.x, updatingCar.y);
                newCar.orientation = updatingCar.orientation;
                newCar.targetOrientation = updatingCar.orientation;
                otherCars.push({
                    id: updatingCar.id,
                    car: newCar
                });

                mini_otherCar = $('<div class="mini_otherCars"></div>').appendTo("#miniMap");
                mini_otherCars.push(mini_otherCar);
            }
        }

        // render power ups
        if(firstPowerUpPush == 0){ 
            //set powerUps list to the new batch and create all power up divs
            powerUps = lists.powerUps;
            for (i = 0; i < powerUps.length; i++) {
                console.log("first power up batch");
                if (powerUps[i].type == 1) {
                    powerUpImages.push($('<div class="powerUp1"></div>'));
                    powerUpImages[i].appendTo("#map");
                    powerUpImages[i].css("left", powerUps[i].x + "px");
                    powerUpImages[i].css("top", powerUps[i].y + "px");


                } else if (powerUps[i].type == 2) {
                    powerUpImages.push($('<div class="powerUp2"></div>'));
                    powerUpImages[i].appendTo("#map");
                    powerUpImages[i].css("left", powerUps[i].x + "px");
                    powerUpImages[i].css("top", powerUps[i].y + "px");

                } else if (powerUps[i].type == 3) {
                    powerUpImages.push($('<div class="powerUp3"></div>'));
                    powerUpImages[i].appendTo("#map");
                    powerUpImages[i].css("left", powerUps[i].x + "px");
                    powerUpImages[i].css("top", powerUps[i].y + "px");
                }
            }
            
            firstPowerUpPush = 1;
        }
        
        //not first batch of power ups - display only availabe ones - consumed = 0
        else if(firstPowerUpPush == 1){
            
            for (i = 0; i < powerUps.length; i++) {
                 powerUpImages[i].css("display", "none"); // hide all current power ups
            }
            
            //update powerUps list to latest batch = lists.powerUps
            powerUps = lists.powerUps;
            
            
            // show only available powerups
            for (i = 0; i < powerUps.length; i++) {
                 if(powerUps[i].consumed == 0){
                    powerUpImages[i].css("display", "block");
                 }     
            }
        }
        
        // The correct version to render but the server isn't giving the 
        // power up lists properly so it's being commented out rn
        /*
        for (i = 0; i < lists.powerUps.length; i++) {
            if (lists.powerUps[i].consumed == 1) { // since it's not removed manually remove it
                lists.powerUps.splice(i, 1);
                i--;
                continue;
            }
            
            if (powerUps.length <= i) { // if the list doesn't include that power up add it
                console.log("Appending power up");
                powerUps.push(lists.powerUps[i]);
                if (powerUps[i].type == 1) {
                    powerUpImages.push($('<div class="powerUp1"></div>'));
                    powerUpImages[i].appendTo("#map");
                    powerUpImages[i].css("left", powerUps[i].x + "px");
                    powerUpImages[i].css("top", powerUps[i].y + "px");


                } else if (powerUps[i].type == 2) {
                    powerUpImages.push($('<div class="powerUp2"></div>'));
                    powerUpImages[i].appendTo("#map");
                    powerUpImages[i].css("left", powerUps[i].x + "px");
                    powerUpImages[i].css("top", powerUps[i].y + "px");

                } else if (powerUps[i].type == 3) {
                    powerUpImages.push($('<div class="powerUp3"></div>'));
                    powerUpImages[i].appendTo("#map");
                    powerUpImages[i].css("left", powerUps[i].x + "px");
                    powerUpImages[i].css("top", powerUps[i].y + "px");
                }
            } else if ((powerUps[i].x != lists.powerUps[i].x) || (powerUps[i].y != lists.powerUps[i].y)) {
                console.log("removing power up");
                // The power up position doesn't match so remove it
                powerUps.splice(i, 1);
                powerUpImages[i].remove();
                powerUpImages.splice(i, 1);
                i--;
            }
        } */
        //if (lists.powerUps.length != powerUps.length) console.log("Power up list length mismatch");
        
        if (still_alive == 0) {
            gameState = 0;
            $("#finalScore").html("You scored: " + sprite.score);
            setTimeout(function(){ 
                $("#splashscreen").fadeIn(500);
            }, 400);

        }

        //check dead by pop
        //for(i = 0; i < lists.deadCars.length; i++) {
        //
        for (i = 0; i < lists.deadCars.length; i++) {
            console.log('length of deadCars list: ' + lists.deadCars.length);
            var w = 700 // Get the actual width/2 $("#stage").get(0).width;
            var h = 400 // Get the actual height/2 $("#stage").get(0).hieght;
            if ((Math.abs(lists.deadCars[i].x - sprite.x) < w) && (Math.abs(lists.deadCars[i].y - sprite.y) < h)) {
                $("#popped").get(0).play();
                console.log("audio played");
            }

        }


        //check dead
        for (i = 0; i < otherCars.length; i++) {

            var found = false;
            for (j = 0; j < lists.cars.length; j++) {

                if (otherCars[i].id == lists.cars[j].id) {
                    found = true;
                    break;
                }
            }

            if (!found) { //if not found remove from dom
                otherCars[i].car.sprite.remove();
                otherCars.splice(i, 1);
                mini_otherCars[i].remove();
                mini_otherCars.splice(i, 1);
            }

        }


    } catch (e) {
        alert(e);
    }

});