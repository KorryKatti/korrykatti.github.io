let board = null;
let game = new Chess();
let currentGameId = null;
let isInitialized = false;
let isProcessing = false;
let lastMove = null;
let gameStats = {
    total: 0,
    wins: 0,
    losses: 0,
    draws: 0
};

let moveConfidence = {
    learned: 0,
    random: 0,
    total: 0
};

let learningStats = {
    databaseSize: 0,
    positionsAnalyzed: 0,
    successfulPatterns: 0,
    learningRate: 0,
    learnedMoves: 0,
    randomMoves: 0
};

const API_URL = 'https://duinogame.pythonanywhere.com/';

// Piece mapping to emojis with different colors for white and black
const pieceTheme = {
    'wP': '♙', 'wN': '♘', 'wB': '♗', 'wR': '♖', 'wQ': '♕', 'wK': '♔',
    'bP': '♟', 'bN': '♞', 'bB': '♝', 'bR': '♜', 'bQ': '♛', 'bK': '♚'
};

// Initialize the game
async function initGame() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        const response = await fetch(`${API_URL}/game/new`, {
            method: 'POST'
        });
        
        if (response.status === 429) {
            showMessage('Please wait before starting a new game');
            return;
        }
        
        const data = await response.json();
        currentGameId = data.game_id;
        game = new Chess();
        lastMove = null;
        document.getElementById('surrender').disabled = false;
        document.getElementById('undo').disabled = true;
        clearCapturedPieces();
        updateStatus();
        updateBoardPosition();
        isInitialized = true;
        
        // Reset UI elements
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('selected', 'valid-move', 'last-move', 'check');
        });
        document.getElementById('thinking').classList.add('hidden');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        showMessage('Failed to start new game');
    } finally {
        isProcessing = false;
    }
}

async function endGame(result, reason) {
    if (!isInitialized || !currentGameId) return;
    
    try {
        const response = await fetch(`${API_URL}/game/end`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                game_id: currentGameId,
                result: result,
                reason: reason
            })
        });
        
        if (response.ok) {
            updateGameStats(result);
            isInitialized = false;
            document.getElementById('surrender').disabled = true;
            document.getElementById('undo').disabled = true;
            
            let message = '';
            switch (result) {
                case 'player_wins':
                    message = '🎉 Congratulations! You won! ' + (reason ? `(${reason})` : '');
                    break;
                case 'bot_wins':
                    message = '😔 Game Over - Bot wins! ' + (reason ? `(${reason})` : '');
                    break;
                case 'draw':
                    message = '🤝 Game ended in a draw! ' + (reason ? `(${reason})` : '');
                    break;
            }
            showMessage(message, false);
        }
    } catch (error) {
        console.error('Failed to end game:', error);
    }
}

function clearCapturedPieces() {
    document.querySelector('.white-captured').textContent = '';
    document.querySelector('.black-captured').textContent = '';
}

function updateCapturedPieces() {
    const pieces = {
        white: { P: 0, N: 0, B: 0, R: 0, Q: 0 },
        black: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };
    
    // Count pieces on the board
    const board = game.board();
    board.forEach(row => {
        row.forEach(piece => {
            if (piece) {
                pieces[piece.color === 'w' ? 'white' : 'black'][piece.type]++;
            }
        });
    });
    
    // Calculate captured pieces
    const whiteCaptured = [];
    const blackCaptured = [];
    
    ['P', 'N', 'B', 'R', 'Q'].forEach(type => {
        const whiteMissing = (type === 'P' ? 8 : 2) - pieces.white[type];
        const blackMissing = (type === 'P' ? 8 : 2) - pieces.black[type.toLowerCase()];
        
        for (let i = 0; i < whiteMissing; i++) {
            blackCaptured.push(pieceTheme['w' + type]);
        }
        for (let i = 0; i < blackMissing; i++) {
            whiteCaptured.push(pieceTheme['b' + type.toUpperCase()]);
        }
    });
    
    document.querySelector('.white-captured').textContent = whiteCaptured.join(' ');
    document.querySelector('.black-captured').textContent = blackCaptured.join(' ');
}

// Initialize the board
function initBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';
    
    for (let row = 8; row >= 1; row--) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'board-row';
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            const file = String.fromCharCode(97 + col);
            const position = file + row;
            square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
            square.dataset.position = position;
            square.addEventListener('click', handleSquareClick);
            rowDiv.appendChild(square);
        }
        boardElement.appendChild(rowDiv);
    }
    
    updateBoardPosition();
}

let selectedSquare = null;

function handleSquareClick(event) {
    if (!isInitialized || isProcessing) return;
    
    const square = event.target;
    const position = square.dataset.position;
    
    if (selectedSquare === null) {
        // First click - select piece if it's valid
        const piece = game.get(position);
        if (piece && piece.color === 'w') {  // Only allow white pieces to be selected
            selectedSquare = position;
            // Remove any existing selections
            document.querySelectorAll('.square.selected').forEach(sq => sq.classList.remove('selected'));
            square.classList.add('selected');
            // Show valid moves
            showValidMoves(position);
        }
    } else {
        // Second click - attempt to make move
        makeMove(selectedSquare, position);
        // Clear selection and valid moves
        document.querySelectorAll('.square.selected, .square.valid-move').forEach(sq => {
            sq.classList.remove('selected', 'valid-move');
        });
        selectedSquare = null;
    }
}

function showValidMoves(position) {
    const moves = game.moves({ square: position, verbose: true });
    moves.forEach(move => {
        const square = document.querySelector(`[data-position="${move.to}"]`);
        if (square) {
            square.classList.add('valid-move');
        }
    });
}

async function makeMove(from, to) {
    if (isProcessing) return;
    isProcessing = true;
    
    // Check if move is legal
    const move = game.move({
        from: from,
        to: to,
        promotion: 'q' // Always promote to queen for simplicity
    });

    // If illegal move, do nothing
    if (move === null) {
        isProcessing = false;
        return;
    }

    // Update last move highlight
    updateLastMove(from, to);
    updateBoardPosition();
    updateStatus();
    document.getElementById('undo').disabled = false;
    showThinking(true);

    // Make API call to backend
    try {
        const response = await fetch(`${API_URL}/move/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from_square: from,
                to_square: to,
                game_id: currentGameId,
                position: game.fen(),  // Send current position for learning
                previous_moves: game.history()  // Send move history for pattern recognition
            })
        });

        if (response.status === 429) {
            game.undo();
            showMessage('Please wait before making another move');
            updateBoardPosition();
            updateStatus();
            return;
        }

        const data = await response.json();
        
        // Update the game with bot's move
        if (data.moves && data.moves.length > game.history().length) {
            const botMove = data.moves[data.moves.length - 1];
            const from = botMove.slice(0, 2);
            const to = botMove.slice(2, 4);
            game.move({
                from: from,
                to: to,
                promotion: botMove.length === 5 ? botMove[4] : undefined
            });
            updateLastMove(from, to);
            updateBoardPosition();
            updateStatus();
            updateCapturedPieces();
            
            // Check if bot is in a stuck position
            if (game.turn() === 'b' && game.moves().length === 0 && !game.in_checkmate()) {
                await endGame('player_wins', 'Bot is stuck');
            }
        }
        
        if (data.is_game_over) {
            handleGameOver(data.result);
        }

        // Update learning statistics after each move
        await updateLearningStats();
        
    } catch (error) {
        console.error('Error:', error);
        game.undo();
        showMessage('Failed to make move. Please try again.');
        updateBoardPosition();
        updateStatus();
    } finally {
        isProcessing = false;
        showThinking(false);
    }
}

function handleGameOver(result) {
    let message = '';
    let confettiConfig = {
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    };

    switch (result) {
        case 'player_wins':
            message = '🎉 Congratulations! You won!';
            confetti({
                ...confettiConfig,
                colors: ['#ffd700', '#4CAF50', '#7389ae']
            });
            break;
        case 'bot_wins':
            message = '😔 Game Over - Bot wins!';
            confettiConfig.colors = ['#dc3545', '#6c757d', '#343a40'];
            confetti(confettiConfig);
            break;
        case 'draw':
            message = '🤝 Game ended in a draw!';
            confettiConfig.colors = ['#6c757d', '#495057', '#7389ae'];
            confetti(confettiConfig);
            break;
    }

    showMessage(message, false);
    document.getElementById('surrender').disabled = true;
    document.getElementById('undo').disabled = true;
    isInitialized = false;
    updateGameStats(result);

    // Update player info highlighting
    document.querySelector('.white-player').classList.remove('active');
    document.querySelector('.black-player').classList.remove('active');
}

function updateLastMove(from, to) {
    // Clear previous last move
    document.querySelectorAll('.square.last-move').forEach(sq => {
        sq.classList.remove('last-move');
    });
    
    // Highlight new last move
    document.querySelector(`[data-position="${from}"]`)?.classList.add('last-move');
    document.querySelector(`[data-position="${to}"]`)?.classList.add('last-move');
    lastMove = { from, to };
}

function showThinking(show) {
    document.getElementById('thinking').classList.toggle('hidden', !show);
}

function showMessage(message, temporary = true) {
    const status = document.getElementById('game-status');
    status.textContent = message;
    if (temporary) {
        setTimeout(() => updateStatus(), 3000);
    }
}

function updateBoardPosition() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const position = square.dataset.position;
        const piece = game.get(position);
        if (piece) {
            square.textContent = pieceTheme[piece.color + piece.type.toUpperCase()];
            square.dataset.piece = piece.color + piece.type.toUpperCase();
        } else {
            square.textContent = '';
            delete square.dataset.piece;
        }
        
        // Add check highlight
        square.classList.remove('check');
        if (piece && piece.type === 'k' && game.in_check()) {
            if ((piece.color === 'w' && game.turn() === 'w') ||
                (piece.color === 'b' && game.turn() === 'b')) {
                square.classList.add('check');
            }
        }
    });
}

function updateStatus() {
    let status = '';
    document.querySelector('.white-player').classList.toggle('active', game.turn() === 'w');
    document.querySelector('.black-player').classList.toggle('active', game.turn() === 'b');

    if (game.in_checkmate()) {
        status = '♔ Checkmate! ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins!';
        handleGameOver(game.turn() === 'w' ? 'bot_wins' : 'player_wins');
    } else if (game.in_draw()) {
        status = '🤝 Draw!';
        if (game.insufficient_material()) status += ' (Insufficient material)';
        else if (game.in_stalemate()) status += ' (Stalemate)';
        else if (game.in_threefold_repetition()) status += ' (Threefold repetition)';
        handleGameOver('draw');
        endGame('draw', 'Game ended in draw');  // Ensure backend is notified
    } else {
        status = (game.turn() === 'w' ? 'White' : 'Black') + ' to move';
        if (game.in_check()) {
            status = '⚠️ ' + (game.turn() === 'w' ? 'White' : 'Black') + ' is in check!';
        }
        updateBotMovePreview();
    }

    document.getElementById('game-status').textContent = status;
    updateMoveHistory();
}

function updateGameStats(result) {
    gameStats.total++;
    if (result === 'player_wins') gameStats.wins++;
    else if (result === 'bot_wins') gameStats.losses++;
    else if (result === 'draw') gameStats.draws++;
    
    document.getElementById('total-games').textContent = gameStats.total;
    document.getElementById('wins').textContent = gameStats.wins;
    document.getElementById('losses').textContent = gameStats.losses;
    document.getElementById('draws').textContent = gameStats.draws;
}

function updateMoveHistory() {
    const history = game.history();
    const moveHistory = document.getElementById('move-history');
    moveHistory.innerHTML = '';
    
    for (let i = 0; i < history.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = history[i];
        const blackMove = history[i + 1] || '';
        
        const moveElement = document.createElement('div');
        moveElement.textContent = `${moveNumber}. ${whiteMove} ${blackMove}`;
        moveElement.title = `Move ${moveNumber}`;
        if (i === history.length - 1 || i === history.length - 2) {
            moveElement.classList.add('latest-move');
        }
        moveHistory.appendChild(moveElement);
    }
    
    moveHistory.scrollTop = moveHistory.scrollHeight;
}

async function surrender() {
    if (!isInitialized || isProcessing) return;
    await endGame('bot_wins', 'Player surrendered');
}

function undoMove() {
    if (!isInitialized || isProcessing || game.history().length < 2) return;
    
    game.undo(); // Undo AI's move
    game.undo(); // Undo player's move
    updateBoardPosition();
    updateStatus();
    updateCapturedPieces();
    document.getElementById('undo').disabled = game.history().length < 2;
    
    // Clear highlights
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'valid-move', 'last-move', 'check');
    });
}

async function updateBotMovePreview() {
    const previewElement = document.getElementById('bot-move-preview');
    const contentElement = previewElement.querySelector('.preview-content');
    const confidenceFill = previewElement.querySelector('.confidence-fill');
    const confidenceText = previewElement.querySelector('.confidence-text');
    
    if (game.turn() === 'b' && !game.game_over()) {
        previewElement.classList.add('visible');
        contentElement.textContent = 'Bot is analyzing the position...';
        
        try {
            const response = await fetch(`${API_URL}/suggest_move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: currentGameId,
                    position: game.fen(),
                    previous_moves: game.history(),
                    exploration_rate: 0.2  // 20% random moves for exploration
                })
            });
            
            const data = await response.json();
            
            // Update confidence display
            const confidence = data.confidence || 0;
            confidenceFill.style.width = `${confidence}%`;
            confidenceFill.className = 'confidence-fill ' + getConfidenceClass(confidence);
            
            let moveDescription = '';
            if (data.move_type === 'learned') {
                moveDescription = `${confidence}% confident (from ${data.pattern_matches} similar positions)`;
                learningStats.learnedMoves++;
            } else {
                moveDescription = 'Exploring new possibilities';
                learningStats.randomMoves++;
            }
            
            confidenceText.textContent = moveDescription;
            
            if (data.move) {
                const from = data.move.slice(0, 2).toUpperCase();
                const to = data.move.slice(2, 4).toUpperCase();
                contentElement.textContent = `Bot is considering: ${from} → ${to}`;
                
                if (data.evaluation) {
                    contentElement.textContent += ` (Position evaluation: ${data.evaluation})`;
                }
            }
            
            // Update learning statistics
            await updateLearningStats();
            
        } catch (error) {
            console.error('Error getting move suggestion:', error);
            contentElement.textContent = 'Bot is making a random move...';
            confidenceFill.style.width = '0%';
            confidenceText.textContent = 'No learned patterns available';
        }
    } else {
        previewElement.classList.remove('visible');
    }
}

function getConfidenceClass(confidence) {
    if (confidence >= 70) return 'high';
    if (confidence >= 40) return 'medium';
    return 'low';
}

async function updateLearningStats() {
    try {
        const response = await fetch(`${API_URL}/learning_stats`);
        const stats = await response.json();
        
        // Update learning statistics
        learningStats = {
            ...learningStats,
            ...stats
        };
        
        // Update database size progress
        const databaseFill = document.getElementById('database-fill');
        const databaseSize = document.getElementById('database-size');
        const dbPercentage = Math.min((learningStats.databaseSize / 1000) * 100, 100);
        databaseFill.style.width = `${dbPercentage}%`;
        databaseFill.className = `progress-fill ${getConfidenceClass(dbPercentage)}`;
        databaseSize.textContent = `${learningStats.databaseSize} positions`;
        
        // Update learning ratio progress
        const learningFill = document.getElementById('learning-fill');
        const learningRatio = document.getElementById('learning-ratio');
        const total = learningStats.learnedMoves + learningStats.randomMoves;
        const learnedPercentage = total > 0 ? Math.round((learningStats.learnedMoves / total) * 100) : 0;
        learningFill.style.width = `${learnedPercentage}%`;
        learningFill.className = `progress-fill ${getConfidenceClass(learnedPercentage)}`;
        learningRatio.textContent = `Learned: ${learnedPercentage}% / Random: ${100 - learnedPercentage}%`;
        
        // Update metrics
        document.getElementById('positions-analyzed').textContent = learningStats.positionsAnalyzed;
        document.getElementById('successful-patterns').textContent = learningStats.successfulPatterns;
        document.getElementById('learning-rate').textContent = `${learningStats.learningRate}%`;
    } catch (error) {
        console.error('Failed to update learning stats:', error);
    }
}

// Event listeners
document.getElementById('new-game').addEventListener('click', async () => {
    if (!isProcessing) {
        await initGame();
    }
});

document.getElementById('surrender').addEventListener('click', surrender);
document.getElementById('undo').addEventListener('click', undoMove);

// Initialize the board only once when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    initBoard();
    await initGame();
    await updateLearningStats();  // Initial stats update
});

// Update learning stats periodically
setInterval(updateLearningStats, 30000);  // Update every 30 seconds 