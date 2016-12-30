// Express initializes app as a function handler, supplied to an HTTP server
var express = require('express');
var app = express();
var http = require('http').Server(app);

// Initialize a socket.io instance and pass it the HTTP server object
var io = require('socket.io')(http);

// Include the path module for safely resolving relative paths, for use with res.sendFile
var path = require('path');

/* Set public directory for serving static files from express, per:
http://expressjs.com/en/starter/static-files.html */
app.use(express.static(__dirname));

// Define a route handler to serve responses when the home page is requested
app.get('/', function(req, res) {

    // Send the index.html page
    res.sendFile(path.resolve(__dirname + '/../views/index.html'));
});

// Listen for connection events on the socket.io instance
io.on('connection', function(socket) {

    var currentRoomID;

    // When you receive the 'create room' event
    socket.on('create room', function(roomID) {

        //Join the socket to that room
        socket.join(roomID);

        // Broadcast 'room created' to the room
        io.to(roomID).emit('room created', roomID);
    });

    // When you receive the 'join request' event
    socket.on('join request', function(gameID) {

        // Keep track of the room and its clients
        var room = io.sockets.adapter.rooms[gameID];

        // If room doesn't exist
        if (!room) {

            // Error: room doesn't exist
            io.to(socket.id).emit('error', 'noroom');
        }

        else {
            var clients = io.sockets.adapter.rooms[gameID].sockets; //array of client IDs
            var isClientInGame = false;

            /* Check if any of the room's clients are in game currently, per: http://stackoverflow.com/questions/24154480/how-to-update-socket-object-for-all-clients-in-room-socket-io/25028902#25028902 */
            for (var clientID in clients) {
                var clientSocket = io.sockets.connected[clientID];

                if (clientSocket.inGame === 'yes' || socket.inGame === 'yes') {
                    isClientInGame = true;
                }
            }

            // Make sure that neither of the clients (either joining or being joined) are in an existing game
            if (isClientInGame) {
                io.to(socket.id).emit('error', 'ingame');
            }

            // // Make sure there's only one player in the room
            // else if (room.length > 2) {
            //
            //     // Else, error: game already has two players
            //     io.to(socket.id).emit('error', 'roomfull');
            // }
            else {

                // Add the player to the room
                socket.join(gameID);
                socket.inGame = 'yes';
                currentRoomID = gameID;

                // Emit the 'game joined' event
                io.to(gameID).emit('game joined', gameID);
            }
        }
    });

    // When you receive the 'move played' event, emit that move to all clients of the room
    socket.on('move played', function(td_hash, tdid, roomID) {
        io.to(roomID).emit('move played', td_hash, tdid);
    });

    // When you receive the 'gameover' event, emit that status to the socket that sent it (because both sockets emit gameover, we want to only send it to each of them once)
    socket.on('gameover', function(roomID) {
        io.to(socket.id).emit('gameover');
    });

    // When you receive the 'restart' event, emit that status to all clients of the room
    socket.on('restart', function(roomID) {
        io.to(roomID).emit('restart');
    });

    // When you receive a chat message from a single client (socket), emit that chat message to all clients
    socket.on('chat message', function(msg, roomID, socketID) {
        io.to(roomID).emit('chat message', msg, socketID);
    });

    // When a user disconnects
    socket.on('disconnect', function () {
        io.to(currentRoomID).emit('user disconnected');
    });
});

// Set the web server to listen on port 3000, or the environment port variable

var port = process.env.PORT || 3000;
http.listen(port, function() {
    console.log('listening on *:' + port);
});
