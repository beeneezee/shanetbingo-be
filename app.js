const presetCards = [
 
    [9,28,38,52,64,4,16,40,53,71,2,19,'*',56,63,6,23,33,55,70,1,27,42,57,75],
    [4,17,40,52,69,11,24,35,54,61,14,22,'*',55,70,15,28,41,53,73,13,16,43,60,67],
    [4,24,31,49,71,7,18,35,54,65,8,28,'*',51,66,1,29,36,53,75,5,26,40,59,61],
    [8,26,31,48,66,10,24,36,59,61,5,29,'*',54,65,2,30,44,50,72,14,21,43,46,67],
    [3,21,39,48,64,6,16,41,53,74,2,23,'*',51,67,10,27,42,50,73,14,26,33,60,70],
    [13,21,43,50,67,8,18,42,55,68,15,28,'*',48,63,9,16,45,49,64,4,20,35,56,70],
    [14,19,39,48,64,10,23,32,55,74,1,29,'*',49,61,3,22,45,60,72,15,21,43,54,63],
    [2,16,43,48,65,12,28,40,56,70,4,17,'*',50,75,5,20,36,47,74,9,21,44,60,62],
    [1,29,37,54,64,13,19,44,47,70,6,18,'*',56,61,5,21,39,55,68,8,23,35,52,75],
    [15,24,42,51,73,14,23,38,54,61,11,28,'*',55,71,4,26,33,53,66,8,21,39,59,63]
];
  
const WebSocket = require('ws');
const db = require('./db');
// Create a WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

console.log("WebSocket server is running on ws://172.20.10.11:8080");


// Initialize rooms and players
let rooms = {
    "play10": [
        { players: [], phase: "cardSelection" , calledNumbers: [64, 1, 23, 75, 9, 16, 55, 53], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 },
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 }
    ],

    "play20": [
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 },
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 }
    ],
    "play50": [
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 },
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 }
    ],
    "play100": [
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 },
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 }
    ],
    "play0": [
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 },
        { players: [], phase: "cardSelection" , calledNumbers: [], selectedCards: [],  countdownStarted: false, winningNumbers: [], gameId: '', commission: 0, win: 0 }
    ]
};

let players = {}; // Keeps track of players by their WebSocket connection ID
// Define a global object to store disconnected players
const disconnectedPlayers = {};

// Log when a new connection is made
wss.on('connection', ws => {
    console.log('New client connected');

    // Assign the player a unique ID based on their connection
    const playerId = ws._socket.remoteAddress + ':' + Date.now();
    players[playerId] = { ws, room: null, status: 'cardSelection', hasSelected: false, hasStarted: false }; // Initial status: cardSelection, track card selection and start game

    // Send a welcome message to the client
    ws?.send(JSON.stringify({ message: 'Welcome to Bingo! Select your room.' }));

    // When the client sends a message
    ws.on('message', message => {
        const msg = JSON.parse(message); // Assume all messages are JSON formatted
        
        
        console.log(msg);

        if (msg.type === 'joinRoom') {
            joinRoom(playerId, msg.playType, msg.roomNumber, msg.dbId);
        }

        if (msg.type === 'startGame') {
            startGame(msg.playerId, msg.playType, msg.roomNumber, msg.cardId, msg.dbId);
        }

        if (msg.type === 'unSelectCard') {
            handleCardUnSelection(msg.playerId, msg.playType, msg.roomNumber, msg.cardId, msg.dbId);
        }
        if (msg.type === 'bingoClaim') {
            handleBingoClaim(msg.playerId, msg.playType, msg.roomNumber, msg.cardId, msg.dbId);
        }

        if (msg.type === 'leaveRoom') {
            leaveRoom(msg.playerId, msg.playType, msg.roomNumber, msg.cardId, msg.dbId);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
    
        // Find the player based on WebSocket instance
        const disconnectedPlayerId = Object.keys(players).find(id => players[id].ws === ws);
    
        if (disconnectedPlayerId) {
            const player = players[disconnectedPlayerId];
            console.log(`Player ${disconnectedPlayerId} has disconnected`);
    
            // Use the stored playType and roomNumber directly
            const { playType, roomNumber } = player;
    
            // Store the disconnected player’s info for reconnection
            disconnectedPlayers[disconnectedPlayerId] = {
                playType,
                roomNumber,
                selectedCard: player.selectedCard,
                // Add additional properties as needed
            };
    
            // Remove the player from the room if the room exists
            const room = rooms[playType]?.[roomNumber];
            if (room) {
                const index = room.players.indexOf(disconnectedPlayerId);
                if (index !== -1) {
                    room.players.splice(index, 1);
                    console.log(`Removed player ${disconnectedPlayerId} from room ${roomNumber}`);
                }
                
                // Notify other players about the disconnection
                room.players.forEach(pid => {
                    players[pid]?.ws?.send(JSON.stringify({
                        type: 'playerDisconnected',
                        message: `Player ${disconnectedPlayerId} has disconnected.`
                    }));
                });
    
                // Reset room if no players are left
                if (room.players.length === 0) {
                    console.log(`No players left in room ${roomNumber}. Resetting room.`);
                    cleanUpRoom(playType, roomNumber);
                }
            } else {
                console.log(`Room not found for playType ${playType} and roomNumber ${roomNumber}.`);
            }
    
            // Clear the WebSocket reference for the disconnected player
            players[disconnectedPlayerId].ws = null;
            console.log(`Stored player ${disconnectedPlayerId} in disconnectedPlayers for reconnection.`);
        }
    });
    
    


    
});

// Function to handle players joining rooms
function joinRoom(playerId, playType, roomNumber, dbId) {
    let room = rooms[playType][roomNumber];

    // Check if the specified room is in the playing phase
    if (room.phase === 'playing') {
        // Attempt to redirect the player to Room 2 if Room 1 is in the playing phase
        if (roomNumber === 0 && rooms[playType][1].phase !== 'playing') {
            // Redirect player to Room 2
            players[playerId]?.ws?.send(JSON.stringify({ message: 'Room 1 is in the playing phase, you have been directed to Room 2.' }));
            roomNumber = 1;
            room = rooms[playType][roomNumber];
        } else if (roomNumber === 1 && rooms[playType][0].phase !== 'playing') {
            // Redirect to Room 1 if Room 2 is playing
            players[playerId]?.ws?.send(JSON.stringify({ message: 'Room 2 is in the playing phase, you have been directed to Room 1.' }));
            roomNumber = 0;
            room = rooms[playType][roomNumber];
        } else {
            // If both rooms are in the playing phase, notify the player to wait
            players[playerId]?.ws?.send(JSON.stringify({ message: 'Both rooms are in the playing phase. Please wait for the next game.' }));
            broadcastRoomStateChange(playType);
            return;
        }
    }

    // Check if the room is full
    if (room.players.length >= 100) {
        players[playerId]?.ws?.send(JSON.stringify({ message: 'Room is full, try again later.' }));
        return;
    }

    // Add the player to the room
    room.players.push(playerId);
    players[playerId].room = { playType, roomNumber };
    players[playerId].dbId = dbId;  // Add the dbId to the player
    players[playerId].playType = playType;
    players[playerId].roomNumber = roomNumber;

    // Notify the player that they’ve joined the room
    players[playerId]?.ws?.send(JSON.stringify({
        message: `You joined room ${roomNumber + 1} for ${playType}.`
    }));

    // Broadcast room state change
    broadcastRoomStateChange(playType);
    
    // Send initial data to the player, including already selected cards and player information
    players[playerId]?.ws?.send(JSON.stringify({
        type: 'initData',
        message: `You joined room ${roomNumber + 1} for ${playType}.`,
        playerId: playerId, 
        roomNumber: roomNumber,
        alreadySelectedCards: room.selectedCards || []
    }));
}



// Function to broadcast room state change for a specific playType
function broadcastRoomStateChange(playType) {
    if (!rooms[playType]) {
        console.log(`Invalid playType: ${playType}`);
        return;
    }

    // Count the active games in the specified playType
    const roomsPlaying = rooms[playType].filter(room => room.phase === 'playing').length;
    const message = JSON.stringify({
        type: 'roomsStateChange',
        activeGames: roomsPlaying
    });

    // Broadcast the message to all connected players
    Object.values(players).forEach(player => {
        player?.ws?.send(message);
    });
}


// Function to handle card selection
function handleCardSelection(playerId, playType, roomNumber, cardId, dbId) {
    // Ensure the player is valid and has not already selected a card
    if (!players[playerId]) {
        console.error(`Player ${playerId} does not exist.`);
        return;
    }
    
    // if (players[playerId].hasSelected) {
    //     console.log(`Player ${playerId} has already selected a card.`);
    //     return;
    // }

    // Store the cardId in the player's record
    players[playerId].selectedCard = cardId;
    players[playerId].hasSelected = true; // Mark the player as having selected a card

    // Notify the player that the card has been selected
    players[playerId]?.ws?.send(JSON.stringify({ message: `Card ${cardId} selected!` }));

    // Get the current room based on playType and roomNumber
    const room = rooms[playType]?.[roomNumber];

    if (!room) {
        console.error(`Room with playType ${playType} and roomNumber ${roomNumber} not found.`);
        return;
    }

    // Add the selected card to the room's selectedCards array
    room.selectedCards.push(cardId);

    // Notify all other players in the room about this card selection
    room.players.forEach(pid => {
        if (pid !== playerId) {
            players[pid]?.ws?.send(JSON.stringify({
                type: 'cardSelectedByOtherUser',  // Updated message type
                selectedCardNumber: cardId, // Including selected card number in the message
                message: `${playerId} has selected card number ${cardId}.`  // Message part with player and card number
            }));
        }
    });
}


//handle card unselection
function handleCardUnSelection(playerId, playType, roomNumber, cardId, dbId) {
    // cardId = cardId - 1;

    // Ensure the player exists and has selected a card
    if (!players[playerId]) {
        console.error(`Player ${playerId} does not exist.`);
        return;
    }

    // Store the unselected card
    const unselectedCard = players[playerId].selectedCard;

    // Reset the player's selected card and mark as unselected
    players[playerId].selectedCard = null;
    players[playerId].hasSelected = false; // Mark the player as having unselected the card


    // Get the current room based on playType and roomNumber
    const room = rooms[playType]?.[roomNumber];

    if (!room) {
        console.error(`Room with playType ${playType} and roomNumber ${roomNumber} not found.`);
        return;
    }

    // Remove the unselected card from the room's selectedCards array
    const cardIndex = room.selectedCards.indexOf(unselectedCard);
    if (cardIndex !== -1) {
        room.selectedCards.splice(cardIndex, 1);
    }

    // Notify all other players in the room about this unselection
    // room.players.forEach(pid => {
    //     // Skip the player who made the unselection
    //     if (pid !== playerId) {
    //         // Check if the player's WebSocket is available
    //         if (players[pid] && players[pid]?.ws) {
    //             players[pid]?.ws?.send(JSON.stringify({
    //                 type: 'cardUnselectedByOtherUser',  // Message type
    //                 message: `${playerId} has unselected their card.`,
    //                 unselectedCardNumber: unselectedCard // Send the unselected card number
    //             }));
    //         } else {
    //             console.error(`WebSocket for player ${pid} is not available or invalid.`);
    //         }
    //     }
    // });
}



// Function to start a single countdown for card selection per room
function startCardSelectionCountdown(playType, roomNumber) {
    const room = rooms[playType][roomNumber];
    let countdown = 30; // 30-second countdown

    room.countdownInterval = setInterval(() => {
        if (countdown <= 0) {
            clearInterval(room.countdownInterval);
            room.countdownInterval = null;

            // Check how many players in the room have `hasStarted: true`
            const startedPlayers = room.players.filter(playerId => players[playerId].hasStarted);

            if (startedPlayers.length < 2) {
                // Only one player has started, restart the countdown
                startedPlayers.forEach(playerId => {
                    players[playerId]?.ws?.send(JSON.stringify({
                        message: 'Not enough players have started. Restarting countdown...'
                    }));
                });

                // Restart the countdown
                startCardSelectionCountdown(playType, roomNumber);
            } else {
                // Enough players have started, proceed to game phase
                startGamePhase(playType, roomNumber);
            }
            return;
        }

        // Send countdown update to all players in the room
        room.players.forEach(playerId => {
            players[playerId]?.ws?.send(JSON.stringify({ type: 'countdown', countdown }));
        });

        countdown--;
    }, 1000); // Decrement every second
}


// Function to start the game phase
function startGamePhase(playType, roomNumber) {
    const room = rooms[playType][roomNumber];
    
    // Count only the players who have started the game
    const numberOfPlayers = room.players.filter(pid => players[pid]?.hasStarted).length;
    
    // Calculate win amount using the utility function
    const winAmount = calculateWinAmount(playType, numberOfPlayers, room);

    // Change the room phase to playing
    rooms[playType][roomNumber].phase = 'playing';
    broadcastRoomStateChange(playType); // Broadcast change in phase

    
    const date = new Date().toISOString().split('T')[0]; // Formats as "YYYY-MM-DD"

    const bet = parseInt(playType.slice(4)); // Replace with actual bet value

    // Call the createGame function
    createGame(bet, numberOfPlayers, date, winAmount)
        .then(gameId => {
            console.log(`Game created with ID: ${gameId}`);
            room.gameId = gameId;
            // Send game start messages to all players in the room
            room.players.forEach(playerId => {                
                players[playerId]?.ws?.send(JSON.stringify({
                    type: 'game-start',
                    message: 'Game phase started!',
                    numberOfPlayers: numberOfPlayers, // Send the number of players
                    gameID: gameId,
                    winAmount: winAmount // Send the calculated win amount
                }));
                players[playerId].status = 'playing'; // Change status to 'playing'
            });

        })
        .catch(error => {
            console.error("Error creating game:", error);
        });

        

    

    
    //get dbID
    // const dbId = players[playerId].dbId;  // Access dbId for the player

    room.players.forEach(playerId => {
        deductPlayerBalance(playType, players[playerId].dbId);
        console.log('Deducted from user ' + players[playerId].dbId);
     });


     //increase the demo numbers
     if(playType === 'play0'){
        room.players.forEach(playerId => {
            //add 1 to the players demo plays
            addDemoPlayed(players[playerId].dbId);
         });
     }

    // Start calling numbers every 3 seconds after setting the phase to playing
    startNumberCaller(playType, roomNumber);
    
}


// Function to start calling numbers randomly from 1 to 75 for a specific room
function startNumberCaller(playType, roomNumber) {
    const room = rooms[playType][roomNumber];
    const numbersToCall = Array.from({ length: 75 }, (_, i) => i + 1); // Create an array [1, 2, ..., 75]
    shuffleArray(numbersToCall); // Shuffle the array to ensure random order

    let index = 0; // Initialize index to keep track of the called numbers  

    const interval = setInterval(() => {
        if (index >= numbersToCall.length) {
            // If all numbers have been called, stop the interval
            clearInterval(interval);
            // Reset called numbers after the game ends
            // resetCalledNumbers(playType, roomNumber); Todo
            console.log('All numbers have been called for this game');

            //game end X
            room.players.forEach(playerId => {
                players[playerId]?.ws?.send(JSON.stringify({
                    type: 'gameEnd'
                }));
            });
            
            cleanUpRoom(playType, roomNumber);
            return;
        }

        const calledNumber = numbersToCall[index];
        room.calledNumbers.push(calledNumber); // Store the called number for reference
        const callCounter = index + 1; // Current call count (1-based index)

        // Send the called number and call counter to all players in the room
        room.players.forEach(playerId => {
            players[playerId]?.ws?.send(JSON.stringify({
                type: 'numberCall',
                number: calledNumber,
                callCounter: callCounter // Send the current call count
            }));
        });

        index++; // Move to the next number
    }, 3000); // Call a new number every 3 seconds
}


// Function to start the game and proceed to the game phase
function startGame(playerId, playType, roomNumber, cardId, dbId) {
    const room = rooms[playType][roomNumber];

    //select the users card    
    handleCardSelection(playerId, playType, roomNumber, cardId, dbId);
    
    players[playerId].hasStarted = true; // Mark player as having started the game

    // Check how many players have clicked start in the room
    const startedPlayers = room.players.filter(playerId => players[playerId].hasStarted);

    // If at least two players have clicked "start", start the countdown
    if (startedPlayers.length == 2 && !room.countdownStarted) {
        room.countdownStarted = true;
        startCardSelectionCountdown(playType, roomNumber);
    }

    // If countdown hasn't started, start it and set the flag //this is when one player starts the game
    // if (!room.countdownStarted) {
    //     room.countdownStarted = true;
    //     startCardSelectionCountdown(playType, roomNumber);
    // }


    // Notify all players that the game is starting
    room.players.forEach(pid => {
        players[pid]?.ws?.send(JSON.stringify({ message: `Game starting soon in room ${roomNumber + 1}!` }));
    });

}


async function handleBingoClaim(playerId, playType, roomNumber, cardId, dbId) {
    console.log(`${playerId} claims with ${cardId}`);

    // Step 1: Eligibility checks

    // Ensure the player exists
    if (!players[playerId]) {
        console.error(`Player ${playerId} does not exist.`);
        return;
    }

    // Get the room based on playType and roomNumber
    const room = rooms[playType]?.[roomNumber];
    if (!room) {
        console.error(`Room with playType ${playType} and roomNumber ${roomNumber} not found.`);
        return;
    }

    // Check if the room is in the 'playing' phase
    if (room.phase !== "playing") {
        console.error(`Bingo claim not allowed, room is not in the playing phase.`);
        return;
    }

    // Check if the player is actually in this room
    if (!room.players.includes(playerId)) {
        console.error(`Player ${playerId} is not in room ${roomNumber}.`);
        return;
    }

    // Ensure the player has not already claimed bingo
    const player = players[playerId];
    if (player.hasClaimedBingo) {
        console.error(`Player ${playerId} has already claimed bingo.`);
        return;
    }

    // Step 2: Validate the Bingo Pattern

    // Retrieve player's card
    const playerCard = presetCards[cardId];
    if (!playerCard) {
        console.error(`Card ${cardId} for player ${playerId} not found.`);
        return;
    }

    // Convert room's called numbers to a Set for pattern validation
    const calledNumbersSet = new Set(room.calledNumbers);

    // Check if the player's card fulfills the bingo pattern
    if (!checkWinningPattern(playerCard, calledNumbersSet, room)) {
        console.log(`Room ${roomNumber} called numbers:`, room.calledNumbers);
        console.error(`Player ${playerId} bingo claim with card ${cardId} is invalid.`);
        console.log(`Player ${playerId}'s card (${cardId}):`, playerCard);
        console.log(`Called numbers:`, calledNumbersSet);
    
        // Inform the player their claim was rejected
        players[playerId]?.ws?.send(JSON.stringify({
            type: 'bingoClaimRejected',
            message: `Your bingo claim with card ${cardId} is invalid. You have been disqualified.`
        }));
    
        // Step 1: Close the player's WebSocket connection
        players[playerId]?.ws?.close();
    
        // Step 2: Remove the player from the room
        const roomPlayers = room.players;
        const playerIndex = roomPlayers.indexOf(playerId);
        if (playerIndex !== -1) {
            roomPlayers.splice(playerIndex, 1); // Remove player from the room's player list
        }
    
        // Step 3: Remove the player from the global players object
        delete players[playerId];


    
        // Notify other players in the room about the disqualification
        roomPlayers.forEach(pid => {
            if (players[pid] && players[pid]?.ws) {
                players[pid]?.ws?.send(JSON.stringify({
                    type: 'playerDisqualified',
                    message: `Player ${playerId} has been disqualified for an invalid bingo claim.`
                }));
            }
        });

        
        const livePlayers = room.players.length;
    
        if(livePlayers < 1){
            cleanUpRoom(playType, roomNumber);
        }
    
        return;
    }
    

    // If the pattern is valid, confirm the win
    players[playerId].hasClaimedBingo = true;
    announceBingoWinner(playerId, cardId, playType, room);

    // Send confirmation message to the player who claimed bingo
    if (player?.ws) {
        player?.ws?.send(JSON.stringify({
            type: 'bingoClaimAcknowledged',
            message: `You have claimed bingo with card ${cardId}!`
        }));
    } else {
        console.error(`WebSocket for player ${playerId} is not available.`);
    }

    
    const lastCalledNumber = room.calledNumbers[room.calledNumbers.length - 1];
    const winnerName = await getWinnerName(dbId);
    
    // Notify all other players in the room about this bingo claim
    room.players.forEach(pid => {
        if (pid !== playerId) {
            if (players[pid] && players[pid]?.ws) {
                players[pid]?.ws?.send(JSON.stringify({
                    type: 'bingoClaimedByOtherUser',
                    message: `Player ${playerId} has won the game with card ${cardId + 1}!`,
                    card: cardId + 1,
                    player: playerId,
                    calledNumbers: room.calledNumbers,
                    winningNumbers: room.winningNumbers,
                    lastCalledNumber: lastCalledNumber,
                    winner: winnerName
                }));
            } else {
                console.error(`WebSocket for player ${pid} is not available or invalid.`);
            }
        }
    });

    //update the game database
    const gameId = room.gameId; // Replace with actual game ID
    const endTime = formatDateToSQL(Date.now()); // Current timestamp in desired format

    // Call the updateGame function
    updateGame(gameId, endTime, dbId, room.commission)
        .then(() => {
            console.log("Game updated successfully!");
        })
        .catch(error => {
            console.error("Error updating game:", error);
        });



    //game over clean up    
    cleanUpRoom(playType, roomNumber);
}

// Helper function to check for a winning pattern
function checkWinningPattern(playerCard, calledNumbersSet, room) {
    // Get the last called number
    const lastCalledNumber = Array.from(calledNumbersSet).pop();
    console.log(`Last called number: ${lastCalledNumber}`);

    let patternNumbers = [];

    // Check corners
    console.log("Checking corners...");
    if (
      calledNumbersSet.has(playerCard[0]) && 
      calledNumbersSet.has(playerCard[4]) && 
      calledNumbersSet.has(playerCard[20]) && 
      calledNumbersSet.has(playerCard[24])
    ) {
        patternNumbers = [playerCard[0], playerCard[4], playerCard[20], playerCard[24]];
        console.log(`Corners pattern found: ${patternNumbers}`);
        if (patternNumbers.includes(lastCalledNumber)) {
            room.winningNumbers = patternNumbers;
            console.log("Corners pattern added to winningNumbers:", room.winningNumbers);
            return true;
        }
    }

    // Check rows
    for (let i = 0; i < 5; i++) {
        let rowComplete = true;
        patternNumbers = [];
        for (let j = 0; j < 5; j++) {
            const number = playerCard[i * 5 + j];
            patternNumbers.push(number);
            if (number !== "*" && !calledNumbersSet.has(number)) {
                rowComplete = false;
                break;
            }
        }
        if (rowComplete && patternNumbers.includes(lastCalledNumber)) {
            room.winningNumbers = patternNumbers;
            console.log(`Row ${i} pattern found: ${patternNumbers}`);
            console.log("Row pattern added to winningNumbers:", room.winningNumbers);
            return true;
        }
    }

    // Check columns
    for (let j = 0; j < 5; j++) {
        let colComplete = true;
        patternNumbers = [];
        for (let i = 0; i < 5; i++) {
            const number = playerCard[i * 5 + j];
            patternNumbers.push(number);
            if (number !== "*" && !calledNumbersSet.has(number)) {
                colComplete = false;
                break;
            }
        }
        if (colComplete && patternNumbers.includes(lastCalledNumber)) {
            room.winningNumbers = patternNumbers;
            console.log(`Column ${j} pattern found: ${patternNumbers}`);
            console.log("Column pattern added to winningNumbers:", room.winningNumbers);
            return true;
        }
    }

    // Check diagonals
    const diag1Numbers = [];
    const diag2Numbers = [];
    let diag1Complete = true;
    let diag2Complete = true;

    console.log("Checking diagonals...");
    for (let i = 0; i < 5; i++) {
        const number1 = playerCard[i * 5 + i];
        diag1Numbers.push(number1);
        if (number1 !== "*" && !calledNumbersSet.has(number1)) {
            diag1Complete = false;
        }

        const number2 = playerCard[i * 5 + (4 - i)];
        diag2Numbers.push(number2);
        if (number2 !== "*" && !calledNumbersSet.has(number2)) {
            diag2Complete = false;
        }
    }
    if (diag1Complete && diag1Numbers.includes(lastCalledNumber)) {
        room.winningNumbers = diag1Numbers;
        console.log(`Diagonal 1 pattern found: ${diag1Numbers}`);
        console.log("Diagonal 1 pattern added to winningNumbers:", room.winningNumbers);
        return true;
    } else if (diag2Complete && diag2Numbers.includes(lastCalledNumber)) {
        room.winningNumbers = diag2Numbers;
        console.log(`Diagonal 2 pattern found: ${diag2Numbers}`);
        console.log("Diagonal 2 pattern added to winningNumbers:", room.winningNumbers);
        return true;
    }

    console.log("No winning pattern found.");
    return false;
}



function announceBingoWinner(playerId, cardId, playType, room) {
    // const winnerDbId = players[playerId].dbId;

    // Count only the players who have started the game
    const numberOfPlayers = room.players.filter(pid => players[pid]?.hasStarted).length;

    // Calculate win amount using the utility function
    const winAmount = calculateWinAmount(playType, numberOfPlayers, room);

    //get dbID
    // const dbId = players[playerId].dbId;  // Access dbId for the player

    // Give the winner their win money
    addPlayerBalance(winAmount, players[playerId].dbId); 


    const lastCalledNumber = room.calledNumbers[room.calledNumbers.length - 1];

    // Notify all players about the winner
    room.players.forEach(pid => {
        if (players[pid] && players[pid].ws) {
            players[pid]?.ws?.send(JSON.stringify({
                type: 'bingoWinnerAnnounced',
                message: `Player ${playerId} has won the game with card ${cardId + 1}!`,
                card: cardId + 1,
                player: playerId,
                calledNumbers: room.calledNumbers,
                winningNumbers: room.winningNumbers,
                lastCalledNumber: lastCalledNumber,
                winner: 'You'
            }));
        }
    });

    // Update room phase to 'game over' or handle accordingly
}


// Utility Functions

//call this after game is over to clean up the room
function cleanUpRoom(playType, roomNumber) {
    const room = rooms[playType]?.[roomNumber];
    if (!room) {
        console.error(`Room with playType ${playType} and roomNumber ${roomNumber} not found.`);
        return;
    }

    // Notify players that the game is over and the room is being cleaned up
    room.players.forEach(playerId => {
        // if (players[playerId]?.ws) {
        //     players[playerId].ws.send(JSON.stringify({
        //         type: 'gameOver',
        //         message: 'The game has ended. The room will be cleaned up now.'
        //     }));
        // }
        // Optionally, disconnect players from the WebSocket or remove them from `players`
        delete players[playerId];
    });

    // Reset the room to its initial form
    rooms[playType][roomNumber] = {
        players: [],
        phase: "cardSelection",
        calledNumbers: [],
        selectedCards: [],
        winningNumbers: [],
        countdownStarted: false,
        win: 0,
        companyIncome: 0,
        gameId: '',
    };

    
    clearInterval(room.countdownInterval); // Stop countdown if it's running
    room.countdownInterval = null;

    console.log(`Room ${roomNumber} of type ${playType} has been reset to its initial form.`);

    //change the active games number on the players screens
    broadcastRoomStateChange(playType);
}


// Utility function to shuffle an array (Fisher-Yates shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}



// deduct money from the players
function deductPlayerBalance(playType, dbId) {
    const amount = parseInt(playType.slice(4)); // Extracts "50" and converts to a number
    return new Promise((resolve, reject) => {
        const query = 'UPDATE users SET balance = balance - ? WHERE telegram_id = ?';
        db.query(query, [amount, dbId], (error, results) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

//give the winner his win money
function addPlayerBalance(winAmount, dbId) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE users SET balance = balance + ? WHERE telegram_id = ?';
        db.query(query, [winAmount, dbId], (error, results) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

//give the winner his win money
function addDemoPlayed(dbId) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE users SET demo = demo + 1 WHERE telegram_id = ?';
        db.query(query, [dbId], (error, results) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function getWinnerName(dbId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT username FROM users WHERE telegram_id = ?';
        db.query(query, [dbId], (error, results) => {
            if (error) return reject(error);

            // Resolve with the username if found, otherwise with a default value
            const playerName = results.length > 0 ? results[0].username : "Unknown Player";
            resolve(playerName);
        });
    });
}


// Utility function to calculate win amount based on playType and number of players
function calculateWinAmount(playType, numberOfPlayers, room) {
    let amountPerPlayer = 0;

    // Determine the amount per player based on playType
    if (playType === 'play10') {
        amountPerPlayer = 10;
    } else if (playType === 'play20') {
        amountPerPlayer = 20;
    } else if (playType === 'play50') {
        amountPerPlayer = 50;
    } else if (playType === 'play100') {
        amountPerPlayer = 100;
    }
    
    const totalWin = numberOfPlayers * amountPerPlayer;

    if(totalWin > 100){
        // Calculate the total win amount with a 20% deduction
        room.win = (numberOfPlayers * amountPerPlayer) * 0.8;
        room.commission = (numberOfPlayers * amountPerPlayer) * 0.2;
        return (numberOfPlayers * amountPerPlayer) * 0.8;

    }else{
        room.win = totalWin;
        return totalWin;
    }
}


// create the game and save it when it starts
function createGame(bet, numPlayers, date, winAmount) {
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO games (bet, number_of_players, date, win_amount) VALUES (?, ?, ?, ?)';
        db.query(query, [bet, numPlayers, date, winAmount], (error, results) => {
            if (error) return reject(error);
            resolve(results.insertId);
        });
    });
}


// update the game when it ends
function updateGame(gameId, endTime, winnerId, companyIncome) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE games SET game_end = ?, winner_id = ?, company_income = ? WHERE id = ?';
        db.query(query, [endTime, winnerId, companyIncome, gameId], (error, results) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function leaveRoom(playerId, playType, roomNumber, cardId, dbId) {
    const room = rooms[playType][roomNumber];

    // Ensure the player exists and is in the room
    if (!room || !room.players.includes(playerId)) {
        console.error(`Player ${playerId} is not in room ${roomNumber}`);
        return;
    }
    
    handleCardUnSelection(playerId, playType, roomNumber, cardId, dbId);

    // Remove player from the room
    room.players = room.players.filter(pid => pid !== playerId);
    
    console.log("Left players: " + room.players)

    // Notify the player that they have successfully left
    if (players[playerId]?.ws) {
        players[playerId].ws.send(JSON.stringify({
            type: 'leftRoom',
            message: `You have left room ${roomNumber}.`
        }));
    }

    // Notify all other players in the room
    room.players.forEach(pid => {
        if (players[pid]?.ws) {
            players[pid].ws.send(JSON.stringify({
                type: 'playerLeft',
                message: `${playerId} has left the room.`
            }));
        }
    });

    // If no players are left in the room, reset the room's phase or state
    if (room.players.length === 0) {
        console.log(`No players left in room ${roomNumber}. Resetting room.`);
        cleanUpRoom(playType, roomNumber);
    }
    
}

// Function to format date as "YYYY-MM-DD HH:MM:SS"
function formatDateToSQL(datetime) {
    const date = new Date(datetime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

