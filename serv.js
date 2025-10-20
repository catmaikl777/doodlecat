const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Раздаем статические файлы из корневой директории
app.use(express.static(__dirname));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Состояние игры
const gameState = {
    players: {},
    platforms: []
};

io.on('connection', (socket) => {
    console.log('Новый игрок подключился:', socket.id);
    
    // Добавляем игрока в состояние игры
    gameState.players[socket.id] = {
        id: socket.id,
        x: 180,
        y: 400,
        color: getRandomColor(),
        score: 0,
        direction: 1
    };
    
    // Отправляем текущее состояние игры новому игроку
    socket.emit('gameState', {
        players: gameState.players,
        myPlayerId: socket.id
    });
    
    // Уведомляем всех о новом игроке
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id
    });
    
    // Обновляем состояние игры для всех игроков
    io.emit('gameState', {
        players: gameState.players,
        myPlayerId: socket.id
    });
    
    // Обрабатываем обновления позиции игрока
    socket.on('playerUpdate', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            gameState.players[socket.id].score = data.score;
            gameState.players[socket.id].color = data.color;
            gameState.players[socket.id].direction = data.direction;
            
            // Отправляем обновленное состояние всем игрокам
            io.emit('gameState', {
                players: gameState.players,
                myPlayerId: socket.id
            });
        }
    });
    
    // Обрабатываем окончание игры
    socket.on('gameOver', (data) => {
        io.emit('gameOver', {
            playerId: socket.id,
            score: data.score
        });
    });
    
    // Обрабатываем перезапуск игры
    socket.on('restartGame', () => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = 0;
            gameState.players[socket.id].x = 180;
            gameState.players[socket.id].y = 400;
        }
    });
    
    // Обрабатываем отключение игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete gameState.players[socket.id];
        
        // Уведомляем всех об отключении игрока
        io.emit('playerLeft', {
            playerId: socket.id
        });
        
        // Обновляем состояние игры
        io.emit('gameState', {
            players: gameState.players
        });
    });
});

function getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFD166', '#6A0572', '#118AB2', '#06D6A0', '#FF9E00'];
    return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
});