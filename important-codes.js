
// Sends a message to a specific player in a room by checking the room's player list
function sendMessageToPlayerInRoom(room, playerId, message) {
    const player = room.players.find(p => p === playerId); // Find playerId in the room's player list
    if (player) {
        const playerWs = players[playerId]?.ws; // Get the WebSocket connection for the player
        if (playerWs) {
            playerWs.send(JSON.stringify({ message: message })); // Send the message to the player
        } else {
            console.error(`Player ${playerId} WebSocket connection not found.`);
        }
    } else {
        console.error(`Player ${playerId} not found in room ${room.roomId}.`);
    }
}

// Sends a message to all players in the room except the one specified by playerId
function sendMessageToPlayersInRoomExceptOne(room, excludePlayerId, message) {
    room.players.forEach((playerId) => {
        if (playerId !== excludePlayerId) { // Exclude the playerId to not send message
            const playerWs = players[playerId]?.ws; // Get WebSocket connection for the player
            if (playerWs) {
                playerWs.send(JSON.stringify({ message: message })); // Send the message
            } else {
                console.error(`Player ${playerId} WebSocket connection not found.`);
            }
        }
    });
}


// Sends a message to all players in the room
function sendMessageToAllPlayersInRoom(room, message) {
    room.players.forEach((playerId) => {
        const playerWs = players[playerId]?.ws; // Get WebSocket connection for the player
        if (playerWs) {
            playerWs.send(JSON.stringify({ message: message })); // Send the message
        } else {
            console.error(`Player ${playerId} WebSocket connection not found.`);
        }
    });
}


// deduct money from the players
function deductPlayerBalance(playerId, playType, dbId) {
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
function addPlayerBalance(playerId, amount, dbId) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE users SET balance = balance + ? WHERE telegram_id = ?';
        db.query(query, [amount, dbId], (error, results) => {
            if (error) return reject(error);
            resolve();
        });
    });
}


// Helper function to check for a winning pattern
function checkWinningPattern(playerCard, calledNumbersSet) {
    // Check corners
    if (
      calledNumbersSet.has(playerCard[0]) && 
      calledNumbersSet.has(playerCard[4]) && 
      calledNumbersSet.has(playerCard[20]) && 
      calledNumbersSet.has(playerCard[24])
    ) {
      return true;
    }

    // Check rows
    for (let i = 0; i < 5; i++) {
        let rowComplete = true;
        for (let j = 0; j < 5; j++) {
            const number = playerCard[i * 5 + j];
            if (number !== "*" && !calledNumbersSet.has(number)) {
                rowComplete = false;
                break;
            }
        }
        if (rowComplete) return true;
    }

    // Check columns
    for (let j = 0; j < 5; j++) {
        let colComplete = true;
        for (let i = 0; i < 5; i++) {
            const number = playerCard[i * 5 + j];
            if (number !== "*" && !calledNumbersSet.has(number)) {
                colComplete = false;
                break;
            }
        }
        if (colComplete) return true;
    }

    // Check diagonals
    let diag1Complete = true;
    let diag2Complete = true;
    for (let i = 0; i < 5; i++) {
        const number1 = playerCard[i * 5 + i];
        if (number1 !== "*" && !calledNumbersSet.has(number1)) {
            diag1Complete = false;
        }
        const number2 = playerCard[i * 5 + (4 - i)];
        if (number2 !== "*" && !calledNumbersSet.has(number2)) {
            diag2Complete = false;
        }
    }
    return diag1Complete || diag2Complete;
}


function leaveRoom(playerId, playType, roomNumber, cardId, dbId) {
    const room = rooms[playType][roomNumber];

    // Ensure the player exists and is in the room
    if (!room || !room.players.includes(playerId)) {
        console.error(`Player ${playerId} is not in room ${roomNumber}`);
        return;
    }

    // Remove player from the room
    room.players = room.players.filter(pid => pid !== playerId);
    
    console.log("Left players: " + room.players)

    // Notify the player that they have successfully left
    if (players[playerId]?.ws) {
        players[playerId].ws.send(JSON.stringify({
            type: 'leaveRoom',
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
        room.phase = "cardSelection";  // Reset room phase
        room.calledNumbers = [];
        room.selectedCards = [];
        room.winningNumbers = [];
        room.countdownStarted = false;
        clearInterval(room.countdownInterval); // Stop countdown if it's running
        room.countdownInterval = null;
    } else {
        // If there are still players in the room, check if the countdown needs to continue or restart
        if (room.countdownInterval) {
            // If countdown is running, check if it should continue
            const startedPlayers = room.players.filter(playerId => players[playerId]?.hasStarted);
            if (startedPlayers.length < 2) {
                console.log(`Not enough players to continue countdown in room ${roomNumber}. Restarting countdown.`);
                // Restart the countdown
                startCardSelectionCountdown(playType, roomNumber);
            }
        }
    }

    // Optionally handle any database or balance updates here
    // Example: Update player balance, remove bets, etc.
    // You can use the dbId to perform any necessary database updates if needed
}