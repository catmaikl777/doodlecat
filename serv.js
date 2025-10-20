const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Настройка CORS для Vercel фронтенда
const io = socketIo(server, {
  cors: {
    origin: ["https://doodlecat-orcin.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ["https://doodlecat-orcin.vercel.app", "http://localhost:3000"],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    players: Object.keys(gameState.players).length,
    version: '1.0.0'
  });
});

// Состояние игры
const gameState = {
  players: {},
  platforms: []
};

// Socket.IO логика
io.on('connection', (socket) => {
  console.log('🎮 Новый игрок подключился:', socket.id);
  
  // Добавляем игрока в состояние игры
  gameState.players[socket.id] = {
    id: socket.id,
    x: 180,
    y: 400,
    color: getRandomColor(),
    score: 0,
    direction: 1,
    isRocket: false,
    hasShield: false,
    connectedAt: new Date().toISOString()
  };
  
  // Отправляем текущее состояние игры новому игроку
  socket.emit('gameState', {
    players: gameState.players,
    myPlayerId: socket.id
  });
  
  // Уведомляем всех о новом игроке
  socket.broadcast.emit('playerJoined', {
    playerId: socket.id,
    player: gameState.players[socket.id]
  });
  
  // Обновляем состояние игры для всех игроков
  io.emit('gameState', {
    players: gameState.players
  });
  
  // Обрабатываем обновления позиции игрока
  socket.on('playerUpdate', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].x = data.x;
      gameState.players[socket.id].y = data.y;
      gameState.players[socket.id].score = data.score;
      gameState.players[socket.id].color = data.color;
      gameState.players[socket.id].direction = data.direction;
      gameState.players[socket.id].isRocket = data.isRocket || false;
      gameState.players[socket.id].hasShield = data.hasShield || false;
      
      // Отправляем обновленное состояние всем игрокам
      socket.broadcast.emit('playerUpdate', {
        playerId: socket.id,
        player: gameState.players[socket.id]
      });
    }
  });
  
  // Обрабатываем окончание игры
  socket.on('gameOver', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].score = data.score;
      io.emit('gameOver', {
        playerId: socket.id,
        score: data.score,
        player: gameState.players[socket.id]
      });
    }
  });
  
  // Обрабатываем перезапуск игры
  socket.on('restartGame', () => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].score = 0;
      gameState.players[socket.id].x = 180;
      gameState.players[socket.id].y = 400;
      gameState.players[socket.id].isRocket = false;
      gameState.players[socket.id].hasShield = false;
      
      io.emit('playerRestarted', {
        playerId: socket.id,
        player: gameState.players[socket.id]
      });
    }
  });
  
  // Обрабатываем отключение игрока
  socket.on('disconnect', (reason) => {
    console.log('🎮 Игрок отключился:', socket.id, 'Причина:', reason);
    
    if (gameState.players[socket.id]) {
      // Сохраняем данные игрока перед удалением
      const disconnectedPlayer = { ...gameState.players[socket.id] };
      delete gameState.players[socket.id];
      
      // Уведомляем всех об отключении игрока
      io.emit('playerLeft', {
        playerId: socket.id,
        player: disconnectedPlayer
      });
      
      // Обновляем состояние игры
      io.emit('gameState', {
        players: gameState.players
      });
    }
  });
  
  // Обработка ошибок
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Вспомогательные функции
function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#FFD166', '#6A0572', '#118AB2', '#06D6A0', '#FF9E00'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Статистика сервера
app.get('/api/stats', (req, res) => {
  res.json({
    players: Object.keys(gameState.players).length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Информация об игроках
app.get('/api/players', (req, res) => {
  res.json({
    players: gameState.players,
    count: Object.keys(gameState.players).length
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
});