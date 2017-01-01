// Global trackers
var movecount = 0;
var xScore = 0;
var oScore = 0;
var playerX;
var playerO;
var roomID;
var oMoveCount = 0;
var currentPlayer = -1; // Machine player is 1, human player is -1
var vsAI = false; // find out if we're playing the computer or not
var difficultyLevel = "normal";
var nextMove; // For the AI to store the board index of its next move
var maxDepth = 5;
var actions = {}; // Obj to hold potential AI actions

// Keep track of whose turn it is (global)
var turn = "X";

// Initialize an empty board (global)
var board = ["E", "E", "E",
             "E", "E", "E",
             "E", "E", "E"];

// Keep track of the game's status (global)
var status = "running";
var result = '';

// Execute when the DOM has finished loading
$(function() {

    // Connect to (and initialize) the io global
    var socket = io();

    // When a user connects, create a new game room
    var roomID = createNewGame();
    socket.on('connect', function() {
        socket.emit('create room', roomID);

        // Set both players to be the current user
        playerX = socket.id;
        playerO = socket.id;
    });

    // Listen for AI mode selections
    $('.difficulty a').on('click', function(event) {

        vsAI = true;
        updateStatusBar('AI opponent selected! Restarting game...');

        // Set player O to blank so we can't play as O anymore, set X to us in case we were O in a previous multiplayer game
        playerO = '';
        playerX = socket.id;

        // Reset the game scores
        xScore = 0;
        oScore = 0;
        $('.x-board').text('X : ' + xScore);
        $('.o-board').text('O : ' + oScore);

        if (event.target.id === 'easy') {
            difficultyLevel = 'easy';
        }
        else if (event.target.id === 'normal') {
            difficultyLevel = 'normal';
        }
        else if (event.target.id === 'hard') {
            difficultyLevel = 'hard';
        }

        // Restart the game
        socket.emit('restart', roomID);
    });

    // When a room is created
    socket.on('room created', function(roomID) {

        // Update the "invite" tab with the game ID
        $('p.gameid').text(roomID);

        // Update the mailto link with the game ID
        $('#invite a').attr('href', 'mailto:?Subject=Play%20tic%20tac%20toe%20with%20me%21&Body=Yo%2C%0A%0ALet%27s%20play%20tic%20tac%20toe%21%20Go%20to%20xo.kjswalls.com%2C%20click%20%22Join%2C%22%20and%20enter%20my%20game%20ID%3A%20' + roomID + '%0A%0ASee%20you%20there.')
    });

    // When the join button is clicked
    $('.join').on('click', function(event) {

        var $input = $('.gameid');
        var $gameid = $('p.gameid');

        // Store the requesting player's ID as Player O
        playerO = socket.id;

        // If the input ID wasn't blank, or wasn't the user's own room ID
        if ($input.val() !== '' && $input.val() !== $gameid.text()) {

            // Emit the 'join request' event to the server
            socket.emit('join request', $input.val());
        }

        else if ($input.val() === '') {
            updateStatusBar('Please enter a game ID');
        }

        else if ($input.val() === $gameid.text()) {
            updateStatusBar("You're already in this game");
        }
    });

    // When you receive the 'game joined' event
    socket.on('game joined', function(gameID) {

        // Update the status bar
        updateStatusBar('Opponent connected! Restarting...');

        // Set player X to blank so we can't play as X anymore
        playerX = '';

        // If my game was joined (old roomID is the same as new gameID)
        if (roomID == gameID) {

            // Set me to player X
            playerO = '';
            playerX = socket.id;

            // Start the game (clear the board one second later)
            setTimeout(function() {
                socket.emit('restart', roomID);
            }, 2000);
        }

        // Clear the chat
        $('.chatbox').remove();

        // Update the roomID
        roomID = gameID;

        // Reset the game scores
        xScore = 0;
        oScore = 0;
        $('.x-board').text('X : ' + xScore);
        $('.o-board').text('O : ' + oScore);
    });

    // When a move is made
    $('.grid td').on('click', function(event) {

        // Play the game normally if it's running
        if (status === "running") {
            playGame(event);
        }

        // Or reset the board if the game is over
        else {
            socket.emit('restart', roomID);
        }

        function playGame(event) {

            // Otherwise, we're playing locally or online

            // If target doesn't have an ID, or isn't blank, ignore
            if ((event.target.id.length === 0) || $(event.target).children().length > 0) {
                return true;
            }

            // If it's your turn, or you're playing alone
            if ((turn === 'X' && playerX === socket.id) || (turn ==='O' && playerX === socket.id && playerO === socket.id) || (turn === 'O' && playerO === socket.id && playerX === '')) {

                // Find out the ID of the target
                var td_hash = '#' + event.target.id;

                // Emit the 'move played' event
                socket.emit('move played', td_hash, event.target.id, roomID);
            }

            else {
                updateStatusBar("It's not your turn");
                return true;
            }
        }
    });

    // When you receive the 'move played' event
    socket.on('move played', function(td_hash, tdid) {

        // Store the tile that was clicked
        var $td = $(td_hash);

        // Update the board
        update($td, tdid);

        movePlayed($td, socket); // advance turn, check for gameover

        // If we're playing the computer, make an AI move
        if (vsAI === true && currentPlayer === 1) {

            nextMove = -1;
            var moveScore = minimaxValue(oMoveCount, turn, board, status, 0);

            // Find out the ID of the target
            var td_hash = '#' + nextMove;
            var $td = $(td_hash);
            update($td, nextMove);

            movePlayed($td, socket); // advance turn, check for gameover
        }
    });

    // When you receive the 'gameover' event
    socket.on('gameover', function() {
        // Update the status bar
        endGameStatus();
    });

    // When you receive the 'restart' event
    socket.on('restart', function() {
        restartGame();
    });

    // When you receive the 'error' event
    socket.on('error', function(msg) {
        switch(msg) {
            case 'noroom' : updateStatusBar('Error: room not found');
            break;

            case 'roomfull' : updateStatusBar('Error: game already has 2 players');
            break;

            case 'ingame' : updateStatusBar('Error: you or the player you are trying to join is already in a game. Refresh the page if you want to leave your current game.', 'slow');
            break;
        }
    });

    // // When you disconnect
    // socket.on('disconnect', function(roomID) {
    //     socket.emit('leave', roomID);
    // });

    // When you receive the 'user disconnected' event
    socket.on('user disconnected', function() {
        updateStatusBar("Opponent disconnected");

        // Clear the chat
        $('.chatbox').remove();

        // Reset the scores
        xScore = 0;
        oScore = 0;
        $('.x-board').text('X : ' + xScore);
        $('.o-board').text('O : ' + oScore);

        // Set both players to me again, so I can play by myself
        playerX = socket.id;
        playerO = socket.id;

        setTimeout(function() {
            restartGame();
        }, 2000);
    });

    // Listen for chat messages to be submitted
    $('form').submit(function() {

        var $input = $('.chatinput');

        // Fire the chat message event, and send the data from the input

        if ($input.val() !== '') {
            socket.emit('chat message',
            $input.val(), roomID, socket.id);

            // Erase the input to get ready for more input
            $input.val('');
        }

        // Don't reload the page
        return false;
    });

    // When chat message events are received (as emitted to all users from the index.js server)
    socket.on('chat message', function(msg, fromSocketID) {

        // Keep track of whether I'm X or O, and who sent the message
        var whoAmI;
        var whoAreThey;
        var source;

        // If I'm playerX, then set whoAmI to X. If not, set whoAmI to O.
        playerX === socket.id ? whoAmI = 'X' : whoAmI = 'O';

        // If I received this chat message event from myself, then whoAreThey IS me. If not, whoAreThey is the opposite of me.
        fromSocketID === socket.id ? whoAreThey = whoAmI : (whoAmI === 'X' ? whoAreThey = 'O' : whoAreThey = 'X');

        // If I received this message from myself, source is me. Else, source is them
        whoAmI === whoAreThey ? source = whoAmI : source = whoAreThey;

        // Create variables to store the elements we need to create a chat bubble
        var $chat = $('.chat');

        var $wrapper = $('<div/>',
        { class: "chatbox" });

        // Align the chatboxes correctly
        // If I'm X, and I receive a msg from myself, or if I'm O and I receive it from someone else
        if ((whoAmI === 'X' && (whoAmI === whoAreThey)) || (whoAmI === 'O' && (whoAmI !== whoAreThey))) {
            $wrapper.attr('class', 'chatbox chatbox-right');
        }
        else {
            $wrapper.attr('class', 'chatbox chatbox-left');
        }

        // Style the player names
        var $name = $('<span/>',
        { class: "player" });

        if ((whoAmI === 'X' && (whoAmI === whoAreThey)) || (whoAmI === 'O' && (whoAmI !== whoAreThey))) {
            $name.attr('class', 'player X');
        }
        else {
            $name.attr('class', 'player O');
        }

        var $bubble = $('<div/>',
        { class: "bubble" });

        // Style the bubbles correctly
        if ((whoAmI === 'X' && (whoAmI === whoAreThey)) || (whoAmI === 'O' && (whoAmI !== whoAreThey))) {
            $bubble.attr('class', 'bubble bubble-x');
        }
        else {
            $bubble.attr('class', 'bubble bubble-o');
        }

        var $text = $('<span/>',
        { class: "chattext" });

        var $timestamp = $('<span/>',
        { class: "timestamp" });

        // Get the current time, format: HH:MM
        var date = new Date;
        var time = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });

        // Append the chat bubble elements
        $chat.append(
            $wrapper.append(
                $name.text('Player ' + source),
                $bubble.append(
                    $text.text(msg)),
                $timestamp.text(time)));

        // Scroll to the bottom of the chat
        $chat.get(0).scrollTop = $chat.get(0).scrollHeight;
    });

    // Listen for clicks on tabs
    $('.menu span a').on('click', function(event) {
        openTab(event.target.firstChild.nodeValue, event.target.parentNode.id);
    });

    // Listen for clicks on Restart link
    $('.restart').click(function() {
        socket.emit('restart', roomID);
    });
});

// Find out whether the game has ended
function isTerminal(currentBoard, currentTurn) {

    var availablePositions = findEmptyCells(currentBoard);
    for (var i = 0; i < currentBoard.length; i++) {

        // Find out if the current player has won horizontally
        if (currentBoard[i] === currentTurn && currentBoard[i + 1] === currentTurn && currentBoard[i + 2] === currentTurn && (i === 0 || i === 3 || i === 6)) {

            result = 'victory';
            return true;
        }

        // Find out if the player has won vertically
        else if (currentBoard[i] === currentTurn && currentBoard[i + 3] === currentTurn && currentBoard[i + 6] === currentTurn) {

            result = 'victory';
            return true;
        }

        // Find out if the player has won diagonally from 0
        else if (currentBoard[i] === currentTurn && currentBoard[i + 4] === currentTurn && currentBoard[i + 8] === currentTurn && i === 0) {

            result = 'victory';
            return true;
        }

        // Find out if the player has won diagonally from 2
        else if (currentBoard[i] === currentTurn && currentBoard[i + 2] === currentTurn && currentBoard[i + 4] === currentTurn && i === 2) {

            result = 'victory';
            return true;
        }

        // Find out if the board is full
        else if (i === 8 && availablePositions.length === 0) {

            result = 'draw';
            return true;
        }
    }
};

// Update the board
// Expects the board array, td ID to update, and whose turn it is
// Returns false if tile is blank
function update($td, tdid) {

    // // Find out the ID of the target
    // var td_hash = '#' + td;
    //
    // // Store the tile that was clicked
    // var $td = $(td_hash);

    // If the tile isn't blank
    if ($td.children().length !== 0) {

        //Do nothing
        return false;
    }

    // Iterate through the board
    for (var i = 0; i < board.length; i++) {

        // If the current element is empty
        if (board[i] === "E") {

            // Check to see if the index matches the td's ID
            if (i == tdid) {

                // Create the span to hold the appropriate marker
                var $span = $('<span />');

                // Find out what marker to place in the div
                if (turn === 'X') {
                    $span.text('X').attr('class', 'X');
                }
                else if (turn === 'O') {
                    $span.text('O').attr('class', 'O');
                }

                // Update array element
                board[i] = turn;

                // Append span to TD
                $span.appendTo($td);
                if (turn === 'O') {
                    oMoveCount++;
                }
                movecount++;
                // playClick();

                break;
            }
        }
    }
};

// function playClick() {
//     var sound = document.getElementById('clickSound');
//     sound.play();
// };

function openTab(tabID, menuLink) {
    var $tabs = $('.tabcontent');

    /* Hide all tab content divs */
    $tabs.hide();

    /* Show the tab that was clicked */
    var currentTab = '#' + tabID.toLowerCase();
    $(currentTab).show();

    /* Remove selected class from all menu links */
    $('.menulink').removeClass('selected');

    /* Add selected class to the span that was clicked */
    var span = '#' + menuLink;
    var $span = $(span);
    $span.addClass('selected');
};



// Function for creating a new game
function createNewGame() {

    /* Create a unique room ID between 99,999 and 900k, as per http://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript */
    var thisGameID = Math.floor(Math.random() * 899999) + 100000;
    roomID = thisGameID;
    return thisGameID;
};

function updateStatusBar(status, speed) {

    var $status = $('.status')
    $status.text(status);
    $status.fadeIn(500);

    if (speed === 'fast' || speed === undefined) {
        setTimeout(function() {
            $status.fadeOut(1000);
        }, 2000);
    }
    else if (speed === 'slow') {
        setTimeout(function() {
            $status.fadeOut(1000);
        }, 4000);
    }
};

// Function for updating the game UI at gameover
function endGameStatus() {

    if (result === "victory") {

        // Update the page
        $('.premove').text('');
        $('.whosemove').text(turn);
        $('.postmove').text(' wins!');
        $('.restart').css('visibility', 'visible');

        /* Update score */
        if (turn === 'X') {
            xScore++;
            $('.x-board').text('X : ' + xScore);
        }
        else {
            oScore++;
            $('.o-board').text('O : ' + oScore);
        }
    }

    else if (result === "draw") {

        // Update the page
        $('.premove').text("It's a");
        $('.whosemove').text('draw!');
        $('.postmove').text('');
        $('.restart').css('visibility', 'visible');
    }
};

function restartGame() {

    board = ["E", "E", "E",
             "E", "E", "E",
             "E", "E", "E"];

    /* Blank all td's */
    $('.grid span').detach();

    /* Update turn status */
    $('.premove').text("It's ");
    $('.whosemove').text("X's");
    $('.postmove').text(' turn');
    $('.restart').css('visibility', 'hidden');

    // Update the status bar
    updateStatusBar("Game restarted");

    movecount = 0;
    oMoveCount = 0;
    currentPlayer = -1;
    turn = 'X';
    status = "running";
};

// This function creates an array of the INDICES of all empty cells left on the board, for the AI to make a move
function findEmptyCells(currentBoard) {
        var emptyCells = [];
        for (var i = 0; i < currentBoard.length; i++) {
            if (currentBoard[i] === 'E') {
                emptyCells.push(i);
            }
        }
        return emptyCells;
};

/* This function scores possible moves for the AI player by evluating each end game state and the moves it takes to get there. It takes in the result of the end game state and the number of moves the O player has made to get there. */
function score(aResult, aTurn, aOMoveCount) {

    function randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    // If X won
    if (aResult === 'victory' && aTurn === 'X') {

        // Return 10 (ideal score for X) - number of O moves, to incentivize the O player to prolong defeat as long as possible
        if (difficultyLevel === 'hard') {
            return 10 - aOMoveCount;
        }
        else if (difficultyLevel === 'normal') {
            var mod = randomIntFromInterval(3, 6);
            return 10 - mod - aOMoveCount;
        }
        else if (difficultyLevel === 'easy') {
            var mod = randomIntFromInterval(6, 10);
            return 10 - mod - aOMoveCount;
        }
    }

    // If O won
    else if (aResult === 'victory' && aTurn === 'O') {

        // Return -10 (ideal score for O) plus number of moves O made, to incentivize X to prolong defeat as long as possible
        return -10 + aOMoveCount;
    }
    else {

        // It's a draw
        return 0;
    }
};

/* This function calculates the minimax value of a board configuration, using the score function to evaluate board states */
function minimaxValue(aOMoveCount, aTurn, aBoard, aStatus) {

    // If we've gone too far, return
    if (aOMoveCount > maxDepth) {
        return 0;
    }

    // If the game is over, score this state
    if (isTerminal(aBoard, aTurn)) {
        var aResult = result;
        result = '';
        var myScore = score(aResult, aTurn, aOMoveCount);
        return myScore;
    }
    else {
        var stateScore; // Stores the minimax value that is computed
        var move = -1;

        if (aTurn === 'X') {
            stateScore = -1000; // Initialize to a value lower than any possible score (X maximizes)
        }
        else {
            stateScore = 1000; // Initialize to a value higher than any possible score (O minimizes)
        }

        // Find out what the empty cells are right now
        var availablePositions = findEmptyCells(aBoard);

        // Enumerate the next possible board configurations, using info from availablePositions
        availablePositions.forEach(function(nextPosition) {

            // Place the piece on the board
            aBoard[nextPosition] = aTurn;

            // If it's O's turn, update the oMoveCount
            var newOMoveCount = aTurn === 'O' ? aOMoveCount + 1 : aOMoveCount;

            // Advance the turn
            var nextTurn = aTurn === 'X' ? 'O' : 'X';

            var thisScore = minimaxValue(newOMoveCount, nextTurn, aBoard, aStatus); // recursive call

            if (aTurn === 'X') {
                if (thisScore > stateScore) {

                    // Update the state score if the nextScore is bigger, since X wants to maximize
                    stateScore = thisScore;
                    move = nextPosition;
                }
            }
            else {
                if (thisScore < stateScore) {

                    //Update the state score if the nextScore is smaller than the current score, since O wants to minimize
                    stateScore = thisScore;
                    move = nextPosition;
                }
            }
            aBoard[nextPosition] = 'E'; // Reset the board after trying the move
        });
        if (move === -1) {
            return 0; // no valid moves, so it's a tie
        }
        nextMove = move;
        actions[nextMove] = stateScore;
        return stateScore; // return the minimax value
     }
};

function movePlayed($td, socket) {
    // If the game is over, update the status
    if (isTerminal(board, turn)) {
        status = 'gameover';
        socket.emit('gameover', roomID);
        return true;
    }

    // Advance the turn, if tile wasn't blank
    else {
        if ($td.children().length !== 0) {
            turn === 'X' ? turn = 'O' : turn = 'X';
            $('.whosemove').text(turn + "'s");

            if (vsAI === true) {
                currentPlayer *= -1;
            }
        }
    }
};
