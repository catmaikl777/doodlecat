class DoodleJumpGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // URL бэкенда на Render (замените на ваш)
    this.BACKEND_URL = "https://doodlecat.onrender.com";
    this.socket = io(this.BACKEND_URL, {
      transports: ["websocket", "polling"],
      timeout: 10000,
    });

    this.gameState = {
      players: {},
      myPlayerId: null,
    };

    this.localState = {
      score: 0,
      coins: 0,
      gameOver: false,
      connected: false,
      highestPoint: 0,
      rocketActive: false,
      rocketTime: 0,
      shieldActive: false,
      shieldTime: 0,
      magnetActive: false,
      magnetTime: 0,
      combo: 0,
      achievements: [],
    };

    // Размеры объектов
    this.sizes = {
      player: { width: 46, height: 46 },
      platform: { width: 70, height: 18 },
      coin: { width: 20, height: 20 },
      shield: { width: 24, height: 24 },
    };

    this.player = {
      x: this.canvas.width / 2 - this.sizes.player.width / 2,
      y: this.canvas.height - 100,
      width: this.sizes.player.width,
      height: this.sizes.player.height,
      velocityY: 0,
      velocityX: 0,
      jumping: false,
      color: this.getRandomColor(),
      direction: 1,
      isRocket: false,
      hasShield: false,
    };

    this.keys = {};
    this.platforms = [];
    this.items = [];
    this.particles = [];
    this.cameraY = 0;
    this.animationFrame = 0;
    this.enemies = [];

    // Инициализация контейнеров для спрайтов
    this.sprites = { player: {}, platforms: {}, items: {}, effects: {}, ui: {}, background: {} };
    this.spritesLoaded = false;

    this.hideLoadingScreen();

    this.init();
    this.setupEventListeners();
    this.setupSocketListeners();
    this.generateInitialPlatforms();
    this.generateInitialItems();
    this.generateInitialEnemies && this.generateInitialEnemies();

    // Загрузка спрайтов из каталога sprites/
    this.loadSpritesFromImages().then(() => {
      this.spritesLoaded = true;
      this.gameLoop();
    });

    // Проверка соединения с сервером
    this.checkServerConnection();
  }

  async checkServerConnection() {
    try {
      const response = await fetch(`${this.BACKEND_URL}/api/health`);
      if (response.ok) {
        this.updateServerStatus(true);
      } else {
        this.updateServerStatus(false);
      }
    } catch (error) {
      this.updateServerStatus(false);
    }
  }

  updateServerStatus(online) {
    const statusElement = document.getElementById("serverStatus");
    const connectionInfo = document.getElementById("connectionInfo");

    if (online) {
      statusElement.textContent = "Online";
      statusElement.className = "server-status server-online";
      connectionInfo.textContent = `Подключено к: ${this.BACKEND_URL}`;
    } else {
      statusElement.textContent = "Offline";
      statusElement.className = "server-status server-offline";
      connectionInfo.textContent = "Сервер недоступен. Проверьте подключение.";
    }
  }

  // Загрузка спрайтов из файлов в каталоге sprites/
  loadSpritesFromImages() {
    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const tasks = [];

    // Player
    tasks.push(loadImage("sprites/player/player_normal.png").then((img) => (this.sprites.player.normal = img)));
    tasks.push(loadImage("sprites/player/player_right.png").then((img) => (this.sprites.player.right = img)));
    tasks.push(loadImage("sprites/player/player_left.png").then((img) => (this.sprites.player.left = img)));
    tasks.push(loadImage("sprites/player/player_jump.png").then((img) => (this.sprites.player.jump = img)));

    // Platforms
    tasks.push(loadImage("sprites/platforms/platform_green.png").then((img) => (this.sprites.platforms.green = img)));
    tasks.push(loadImage("sprites/platforms/platform_blue.png").then((img) => (this.sprites.platforms.blue = img)));
    tasks.push(loadImage("sprites/platforms/platform_white.png").then((img) => (this.sprites.platforms.white = img)));
    tasks.push(loadImage("sprites/platforms/platform_spring.png").then((img) => (this.sprites.platforms.spring = img)));

    // Items / enemies
    tasks.push(loadImage("sprites/items/rocket.png").then((img) => (this.sprites.items.rocket = img)));
    tasks.push(loadImage("sprites/items/spring.png").then((img) => (this.sprites.items.spring = img)));
    tasks.push(loadImage("sprites/items/monster.png").then((img) => (this.sprites.items.monster = img)));

    // Effects
    tasks.push(loadImage("sprites/effects/explosion.png").then((img) => (this.sprites.effects.explosion = img)));
    tasks.push(loadImage("sprites/effects/particle.png").then((img) => (this.sprites.effects.particle = img)));
    tasks.push(loadImage("sprites/effects/score_popup.png").then((img) => (this.sprites.effects.scorePopup = img)));

    // UI
    tasks.push(loadImage("sprites/ui/button.png").then((img) => (this.sprites.ui.button = img)));
    tasks.push(loadImage("sprites/ui/game_over.png").then((img) => (this.sprites.ui.gameOver = img)));
    tasks.push(loadImage("sprites/ui/score_board.png").then((img) => (this.sprites.ui.scoreBoard = img)));

    // Простой фон
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = this.canvas.width;
    bgCanvas.height = this.canvas.height;
    const bgCtx = bgCanvas.getContext("2d");
    const gradient = bgCtx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#B3E5FC");
    bgCtx.fillStyle = gradient;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    this.sprites.background.sky = bgCanvas;

    return Promise.all(tasks);
  }

  async loadPlayerSprites() {
    this.sprites.player.normal = await this.createPlayerSprite();
    this.sprites.player.right = await this.createPlayerSprite(5);
    this.sprites.player.left = await this.createPlayerSprite(-5);
    this.sprites.player.jump = await this.createPlayerSprite(0, true);
  }

  async loadPlatformSprites() {
    this.sprites.platforms.green = this.createPlatformSprite(
      "#4CAF50",
      "#388E3C"
    );
    this.sprites.platforms.blue = this.createPlatformSprite(
      "#2196F3",
      "#1976D2"
    );
    this.sprites.platforms.white = this.createPlatformSprite(
      "#E0E0E0",
      "#BDBDBD"
    );
    this.sprites.platforms.brown = this.createPlatformSprite(
      "#8B4513",
      "#654321"
    );
    this.sprites.platforms.moving = this.createPlatformSprite(
      "#9C27B0",
      "#7B1FA2"
    );
    this.sprites.platforms.breakable = this.createPlatformSprite(
      "#FF9800",
      "#F57C00"
    );
    this.sprites.platforms.spring = this.createPlatformSprite(
      "#4CAF50",
      "#388E3C",
      "#FFC107"
    );
    this.sprites.platforms.rocket = this.createPlatformSprite(
      "#FF5722",
      "#D84315",
      "#FFD700"
    );
  }

  async loadBackgroundSprites() {
    this.sprites.background.sky = this.createSkyBackground();
  }

  async loadItemSprites() {
    this.sprites.items.coin = this.createCoinSprite();
    this.sprites.items.shield = this.createShieldSprite();
    this.sprites.items.magnet = this.createMagnetSprite();
  }

  async loadEffectSprites() {
    this.sprites.effects.explosion = this.createExplosionEffect();
    this.sprites.effects.particle = this.createParticleEffect();
    this.sprites.effects.scorePopup = this.createScorePopupEffect();
  }

  async loadUISprites() {
    this.sprites.ui.button = this.createButtonSprite();
    this.sprites.ui.scoreBoard = this.createScoreBoardSprite();
    this.sprites.ui.gameOver = this.createGameOverSprite();
  }

  createFallbackSprites() {
    console.log("Создаем резервные спрайты...");
    this.createPlayerSprites();
    this.createPlatformSprites();
    this.createItemSprites();
    this.createEffectSprites();
    this.createUISprites();
    this.sprites.background.sky = this.createSkyBackground();
  }

  createPlayerSprite(eyeOffset = 0, isJumping = false) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = this.sizes.player.width;
      canvas.height = this.sizes.player.height;
      const ctx = canvas.getContext("2d");

      // Тело
      const bodyWidth = this.sizes.player.width * 0.6;
      const bodyHeight = this.sizes.player.height * 0.6;
      const bodyX = (this.sizes.player.width - bodyWidth) / 2;
      const bodyY = (this.sizes.player.height - bodyHeight) / 2;

      // Градиент для тела
      const gradient = ctx.createLinearGradient(
        bodyX,
        bodyY,
        bodyX,
        bodyY + bodyHeight
      );
      gradient.addColorStop(0, "#FF6B6B");
      gradient.addColorStop(1, "#FF5252");

      ctx.fillStyle = gradient;
      ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);

      // Глаза
      const eyeSize = this.sizes.player.width * 0.15;
      const leftEyeX = bodyX + bodyWidth * 0.2 + eyeOffset;
      const rightEyeX = bodyX + bodyWidth * 0.6 + eyeOffset;
      const eyesY = bodyY + bodyHeight * 0.2;

      ctx.fillStyle = "white";
      ctx.fillRect(leftEyeX, eyesY, eyeSize, eyeSize);
      ctx.fillRect(rightEyeX, eyesY, eyeSize, eyeSize);

      ctx.fillStyle = "black";
      const pupilSize = eyeSize * 0.4;
      ctx.fillRect(
        leftEyeX + eyeSize * 0.3,
        eyesY + eyeSize * 0.3,
        pupilSize,
        pupilSize
      );
      ctx.fillRect(
        rightEyeX + eyeSize * 0.3,
        eyesY + eyeSize * 0.3,
        pupilSize,
        pupilSize
      );

      // Улыбка
      ctx.strokeStyle = "black";
      ctx.lineWidth = Math.max(1, this.sizes.player.width * 0.05);
      ctx.beginPath();
      const smileY = bodyY + bodyHeight * 0.6;
      const smileRadius = bodyWidth * 0.3;
      ctx.arc(bodyX + bodyWidth / 2, smileY, smileRadius, 0, Math.PI);
      ctx.stroke();

      // Эффект прыжка
      if (isJumping) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
      }

      resolve(canvas);
    });
  }

  createPlatformSprite(color, darkColor, stripeColor = null) {
    const canvas = document.createElement("canvas");
    canvas.width = this.sizes.platform.width;
    canvas.height = this.sizes.platform.height;
    const ctx = canvas.getContext("2d");

    // Градиент для платформы
    const gradient = ctx.createLinearGradient(
      0,
      0,
      0,
      this.sizes.platform.height
    );
    gradient.addColorStop(0, darkColor);
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.sizes.platform.width, this.sizes.platform.height);

    // Верхняя часть
    const topHeight = this.sizes.platform.height * 0.25;
    ctx.fillStyle = darkColor;
    ctx.fillRect(0, 0, this.sizes.platform.width, topHeight);

    // Полоски
    if (stripeColor) {
      ctx.fillStyle = stripeColor;
      const stripeWidth = Math.max(2, this.sizes.platform.width * 0.05);
      const spacing = this.sizes.platform.width * 0.14;
      for (
        let i = spacing;
        i < this.sizes.platform.width - spacing;
        i += spacing
      ) {
        ctx.fillRect(
          i,
          topHeight,
          stripeWidth,
          this.sizes.platform.height - topHeight
        );
      }
    }

    // Текстура
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i < this.sizes.platform.width; i += 4) {
      for (let j = topHeight; j < this.sizes.platform.height; j += 4) {
        if (Math.random() > 0.7) {
          ctx.fillRect(i, j, 1, 1);
        }
      }
    }

    return canvas;
  }

  createSkyBackground() {
    const canvas = document.createElement("canvas");
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext("2d");

    // Градиентное небо
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(0.6, "#98D8F0");
    gradient.addColorStop(1, "#B3E5FC");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Облака
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    this.drawCloud(ctx, 50, 50, 60, 30);
    this.drawCloud(ctx, 200, 80, 80, 35);
    this.drawCloud(ctx, 350, 40, 70, 25);
    this.drawCloud(ctx, 100, 150, 90, 40);
    this.drawCloud(ctx, 300, 200, 70, 30);

    return canvas;
  }

  createCoinSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = this.sizes.coin.width;
    canvas.height = this.sizes.coin.height;
    const ctx = canvas.getContext("2d");

    // Внешний круг
    const gradient = ctx.createRadialGradient(
      this.sizes.coin.width / 2,
      this.sizes.coin.height / 2,
      0,
      this.sizes.coin.width / 2,
      this.sizes.coin.height / 2,
      this.sizes.coin.width / 2
    );
    gradient.addColorStop(0, "#FFD700");
    gradient.addColorStop(0.7, "#FFC107");
    gradient.addColorStop(1, "#FFA000");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(
      this.sizes.coin.width / 2,
      this.sizes.coin.height / 2,
      this.sizes.coin.width / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Блики
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(
      this.sizes.coin.width / 2 - 3,
      this.sizes.coin.height / 2 - 3,
      this.sizes.coin.width / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Буква C
    ctx.fillStyle = "#FFA000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C", this.sizes.coin.width / 2, this.sizes.coin.height / 2);

    return canvas;
  }

  createShieldSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = this.sizes.shield.width;
    canvas.height = this.sizes.shield.height;
    const ctx = canvas.getContext("2d");

    // Щит
    const gradient = ctx.createRadialGradient(
      this.sizes.shield.width / 2,
      this.sizes.shield.height / 2,
      0,
      this.sizes.shield.width / 2,
      this.sizes.shield.height / 2,
      this.sizes.shield.width / 2
    );
    gradient.addColorStop(0, "#4FC3F7");
    gradient.addColorStop(1, "#0288D1");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(
      this.sizes.shield.width / 2,
      this.sizes.shield.height / 2,
      this.sizes.shield.width / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Ободок
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      this.sizes.shield.width / 2,
      this.sizes.shield.height / 2,
      this.sizes.shield.width / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Крест
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.sizes.shield.width / 2, this.sizes.shield.height / 2 - 8);
    ctx.lineTo(this.sizes.shield.width / 2, this.sizes.shield.height / 2 + 8);
    ctx.moveTo(this.sizes.shield.width / 2 - 8, this.sizes.shield.height / 2);
    ctx.lineTo(this.sizes.shield.width / 2 + 8, this.sizes.shield.height / 2);
    ctx.stroke();

    return canvas;
  }

  createMagnetSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = this.sizes.coin.width;
    canvas.height = this.sizes.coin.height;
    const ctx = canvas.getContext("2d");

    // Градиент для магнита
    const gradient = ctx.createLinearGradient(0, 0, this.sizes.coin.width, 0);
    gradient.addColorStop(0, "#E91E63");
    gradient.addColorStop(1, "#AD1457");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.sizes.coin.width, this.sizes.coin.height);

    // Буква M
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("M", this.sizes.coin.width / 2, this.sizes.coin.height / 2);

    // Магнитные линии
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < this.sizes.coin.width; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 2);
      ctx.lineTo(i + 2, this.sizes.coin.height - 2);
      ctx.stroke();
    }

    return canvas;
  }

  createExplosionEffect() {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(25, 25, 0, 25, 25, 25);
    gradient.addColorStop(0, "#FFFF00");
    gradient.addColorStop(0.5, "#FF9800");
    gradient.addColorStop(1, "#FF5722");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(25, 25, 25, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  createParticleEffect() {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(5, 5, 5, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  createScorePopupEffect() {
    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, 60, 30);
    ctx.strokeRect(0, 0, 60, 30);

    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+10", 30, 15);

    return canvas;
  }

  createButtonSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 40);
    gradient.addColorStop(0, "#4CAF50");
    gradient.addColorStop(1, "#45a049");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 120, 40);

    ctx.strokeStyle = "#2E7D32";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 120, 40);

    return canvas;
  }

  createScoreBoardSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, 200, 100);

    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 200, 100);

    return canvas;
  }

  createGameOverSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 150;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, 300, 150);

    ctx.strokeStyle = "#FF6B6B";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 300, 150);

    ctx.fillStyle = "#FF6B6B";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", 150, 50);

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Нажмите для перезапуска", 150, 100);

    return canvas;
  }

  drawCloud(ctx, x, y, width, height) {
    ctx.beginPath();
    ctx.arc(x, y + height / 2, height / 2, 0, Math.PI * 2);
    ctx.arc(x + width / 3, y + height / 3, height / 2, 0, Math.PI * 2);
    ctx.arc(x + (width * 2) / 3, y + height / 2, height / 2, 0, Math.PI * 2);
    ctx.arc(x + width, y + height / 2, height / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  init() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener(
        "deviceorientation",
        this.handleOrientation.bind(this)
      );
    }
    this.canvas.width = 400;
    this.canvas.height = 600;
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Мобильные кнопки
    document.getElementById("leftBtn").addEventListener("mousedown", () => {
      this.keys["ArrowLeft"] = true;
    });

    document.getElementById("leftBtn").addEventListener("mouseup", () => {
      this.keys["ArrowLeft"] = false;
    });

    document.getElementById("leftBtn").addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.keys["ArrowLeft"] = true;
    });

    document.getElementById("leftBtn").addEventListener("touchend", (e) => {
      e.preventDefault();
      this.keys["ArrowLeft"] = false;
    });

    document.getElementById("rightBtn").addEventListener("mousedown", () => {
      this.keys["ArrowRight"] = true;
    });

    document.getElementById("rightBtn").addEventListener("mouseup", () => {
      this.keys["ArrowRight"] = false;
    });

    document.getElementById("rightBtn").addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.keys["ArrowRight"] = true;
    });

    document.getElementById("rightBtn").addEventListener("touchend", (e) => {
      e.preventDefault();
      this.keys["ArrowRight"] = false;
    });

    document.getElementById("restartBtn").addEventListener("click", () => {
      this.restartGame();
    });

    // Кнопка прыжка для мобильных устройств
    document.getElementById("jumpBtn").addEventListener("mousedown", () => {
      if (this.player.jumping) return;
      this.player.velocityY = -15;
      this.player.jumping = true;
    });

    document.getElementById("jumpBtn").addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (this.player.jumping) return;
      this.player.velocityY = -15;
      this.player.jumping = true;
    });
  }

  setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.localState.connected = true;
      document.getElementById("waiting").style.display = "none";
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.localState.connected = false;
      document.getElementById("waiting").style.display = "block";
    });

    this.socket.on("gameState", (gameState) => {
      this.gameState = gameState;
      this.updateUI();
    });

    this.socket.on("playerJoined", (data) => {
      console.log(`Player ${data.playerId} joined`);
      this.showAchievement("Новый игрок присоединился!");
    });

    this.socket.on("playerLeft", (data) => {
      console.log(`Player ${data.playerId} left`);
    });

    this.socket.on("gameOver", (data) => {
      if (data.playerId === this.gameState.myPlayerId) {
        this.localState.gameOver = true;
        document.getElementById("finalScore").textContent =
          this.localState.score;
        document.getElementById("gameOver").style.display = "block";
      }
    });
  }

  handleOrientation(event) {
    if (event.gamma) {
      const tilt = event.gamma / 30;
      if (tilt < -0.1) {
        this.keys["ArrowLeft"] = true;
        this.keys["ArrowRight"] = false;
      } else if (tilt > 0.1) {
        this.keys["ArrowRight"] = true;
        this.keys["ArrowLeft"] = false;
      } else {
        this.keys["ArrowLeft"] = false;
        this.keys["ArrowRight"] = false;
      }
    }
  }

  generateInitialPlatforms() {
    this.platforms = [];

    // Надежная стартовая платформа
    this.platforms.push({
      x: this.canvas.width / 2 - this.sizes.platform.width / 2,
      y: this.canvas.height - 50,
      width: this.sizes.platform.width,
      height: this.sizes.platform.height,
      type: "green",
      health: 1,
    });

    // Платформы выше
    for (let i = 1; i < 15; i++) {
      this.generatePlatform(i * 70);
    }
  }

  generatePlatform(offsetY = 0) {
    const platformTypes = [
      "green",
      "blue",
      "green",
      "green",
      "spring",
      "moving",
      "breakable",
    ];
    const weights = [0.3, 0.2, 0.3, 0.1, 0.05, 0.03, 0.02];

    let randomValue = Math.random();
    let randomType = "green";

    for (let i = 0; i < platformTypes.length; i++) {
      if (randomValue < weights[i]) {
        randomType = platformTypes[i];
        break;
      }
      randomValue -= weights[i];
    }

    const platform = {
      x: Math.random() * (this.canvas.width - this.sizes.platform.width),
      y: this.canvas.height - 50 - offsetY,
      width: this.sizes.platform.width,
      height: this.sizes.platform.height,
      type: randomType,
      health: randomType === "breakable" ? 3 : 1,
      velocityX: randomType === "moving" ? (Math.random() - 0.5) * 3 : 0,
    };

    this.platforms.push(platform);
  }

  generateInitialItems() {
    this.items = [];
    for (let i = 0; i < 5; i++) {
      this.generateItem();
    }
  }

  generateItem() {
    const itemTypes = ["coin", "coin", "coin", "coin", "shield", "magnet"];
    const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];

    const item = {
      x: Math.random() * (this.canvas.width - this.sizes.coin.width),
      y: this.cameraY - 100 - Math.random() * 200,
      width: this.sizes.coin.width,
      height: this.sizes.coin.height,
      type: randomType,
      collected: false,
      animation: Math.random() * Math.PI * 2,
    };

    this.items.push(item);
  }

  update() {
    if (
      this.localState.gameOver ||
      !this.localState.connected ||
      !this.spritesLoaded
    )
      return;

    this.animationFrame++;
    this.updatePowerUps();
    this.updateSpecialPlatforms();
    this.updateItems();
    this.updateParticles();

    // Управление
    if (this.keys["ArrowLeft"]) {
      this.player.velocityX = -5;
      this.player.direction = -1;
    } else if (this.keys["ArrowRight"]) {
      this.player.velocityX = 5;
      this.player.direction = 1;
    } else {
      this.player.velocityX *= 0.9;
    }

    // Физика
    if (!this.player.isRocket) {
      this.player.velocityY += 0.5;
    } else {
      this.player.velocityY = -10; // Ракета летит вверх
    }

    this.player.y += this.player.velocityY;
    this.player.x += this.player.velocityX;

    // Телепортация через края
    if (this.player.x < -this.player.width) {
      this.player.x = this.canvas.width;
    } else if (this.player.x > this.canvas.width) {
      this.player.x = -this.player.width;
    }

    // Проверка платформ
    let onPlatform = false;
    this.platforms.forEach((platform) => {
      if (
        this.player.velocityY > 0 &&
        this.player.x < platform.x + platform.width &&
        this.player.x + this.player.width > platform.x &&
        this.player.y + this.player.height < platform.y + 10 &&
        this.player.y + this.player.height + this.player.velocityY > platform.y
      ) {
        this.handlePlatformCollision(platform);
        onPlatform = true;
      }
    });

    // Сброс комбо если не на платформе и падает
    if (!onPlatform && this.player.velocityY > 0) {
      this.localState.combo = 0;
    }

    // Обновление камеры и генерация
    if (this.player.y < this.cameraY) {
      this.cameraY = this.player.y;

      if (
        this.platforms[this.platforms.length - 1].y >
        this.cameraY - this.canvas.height
      ) {
        this.generatePlatform();
      }

      this.platforms = this.platforms.filter(
        (platform) =>
          platform.y < this.cameraY + this.canvas.height + 100 &&
          (platform.type !== "broken" || platform.health > 0)
      );

      // Генерация предметов
      if (this.items.length < 8 && Math.random() < 0.02) {
        this.generateItem();
      }
    }

    // Проверка Game Over
    if (this.player.y > this.cameraY + this.canvas.height + 200) {
      if (this.localState.shieldActive) {
        // Щит спасает от падения
        this.player.y = this.cameraY + this.canvas.height - 100;
        this.player.velocityY = -15;
        this.localState.shieldActive = false;
        this.player.hasShield = false;
        this.createParticles(
          this.player.x + this.player.width / 2,
          this.player.y + this.player.height / 2,
          15,
          "#4FC3F7"
        );
        this.showAchievement("Щит спас вас!");
      } else {
        this.gameOver();
      }
    }

    // Отправка обновления на сервер
    this.socket.emit("playerUpdate", {
      x: this.player.x,
      y: this.player.y,
      color: this.player.color,
      score: this.localState.score,
      direction: this.player.direction,
      isRocket: this.player.isRocket,
      hasShield: this.player.hasShield,
    });
  }

  handlePlatformCollision(platform) {
    switch (platform.type) {
      case "breakable":
        platform.health--;
        if (platform.health <= 0) {
          platform.type = "broken";
          this.createParticles(
            platform.x + platform.width / 2,
            platform.y,
            10,
            "#8B4513"
          );
        } else {
          this.createParticles(
            platform.x + platform.width / 2,
            platform.y,
            3,
            "#FF9800"
          );
        }
        break;

      case "spring":
        this.player.velocityY = -20;
        this.createParticles(
          platform.x + platform.width / 2,
          platform.y,
          5,
          "#FFC107"
        );
        break;

      case "rocket":
        this.activateRocket();
        this.createParticles(
          platform.x + platform.width / 2,
          platform.y,
          8,
          "#FF5722"
        );
        break;

      default:
        if (platform.type !== "broken") {
          this.player.velocityY = platform.type === "moving" ? -13 : -15;
        }
    }

    if (platform.type !== "broken") {
      this.player.y = platform.y - this.player.height;
      this.player.jumping = true;

      // Добавляем очки
      if (platform.y < this.player.y + this.cameraY) {
        const points = this.calculatePoints(platform);
        this.localState.score += points;
        this.localState.combo++;
        this.showScorePopup(
          platform.x + platform.width / 2,
          platform.y,
          points
        );

        // Достижения за комбо
        if (this.localState.combo === 5) {
          this.showAchievement("Комбо x5!");
        } else if (this.localState.combo === 10) {
          this.showAchievement("Комбо x10! Невероятно!");
        }
      }
    }
  }

  updatePowerUps() {
    // Ракета
    if (this.localState.rocketActive) {
      this.localState.rocketTime--;
      if (this.localState.rocketTime <= 0) {
        this.localState.rocketActive = false;
        this.player.isRocket = false;
      }
    }

    // Щит
    if (this.localState.shieldActive) {
      this.localState.shieldTime--;
      if (this.localState.shieldTime <= 0) {
        this.localState.shieldActive = false;
        this.player.hasShield = false;
      }
    }

    // Магнит
    if (this.localState.magnetActive) {
      this.localState.magnetTime--;
      if (this.localState.magnetTime <= 0) {
        this.localState.magnetActive = false;
      } else {
        this.activateMagnet();
      }
    }
  }

  updateSpecialPlatforms() {
    this.platforms.forEach((platform) => {
      if (platform.type === "moving") {
        platform.x += platform.velocityX;
        if (
          platform.x <= 0 ||
          platform.x >= this.canvas.width - platform.width
        ) {
          platform.velocityX *= -1;
        }
      }
    });
  }

  updateItems() {
    this.items.forEach((item) => {
      item.animation += 0.1;
      item.y += Math.sin(item.animation) * 0.5;

      if (!item.collected && this.checkCollision(this.player, item)) {
        this.collectItem(item);
      }
    });

    this.items = this.items.filter(
      (item) =>
        !item.collected && item.y < this.cameraY + this.canvas.height + 100
    );
  }

  updateParticles() {
    this.particles.forEach((particle) => {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.life--;
      particle.velocityY += 0.1;

      if (particle.isText) {
        particle.velocityY *= 0.95;
      }
    });

    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  checkCollision(obj1, obj2) {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    );
  }

  collectItem(item) {
    item.collected = true;

    switch (item.type) {
      case "coin":
        this.localState.coins++;
        this.localState.score += 100;
        this.createParticles(
          item.x + item.width / 2,
          item.y + item.height / 2,
          5,
          "#FFD700"
        );
        break;

      case "shield":
        this.localState.shieldActive = true;
        this.localState.shieldTime = 300;
        this.player.hasShield = true;
        this.createParticles(
          item.x + item.width / 2,
          item.y + item.height / 2,
          8,
          "#4FC3F7"
        );
        this.showAchievement("Щит активирован!");
        break;

      case "magnet":
        this.localState.magnetActive = true;
        this.localState.magnetTime = 600;
        this.createParticles(
          item.x + item.width / 2,
          item.y + item.height / 2,
          8,
          "#E91E63"
        );
        this.showAchievement("Магнит активирован!");
        break;
    }

    this.updateUI();
  }

  activateMagnet() {
    this.items.forEach((item) => {
      if (item.type === "coin" && !item.collected) {
        const dx =
          this.player.x + this.player.width / 2 - (item.x + item.width / 2);
        const dy =
          this.player.y + this.player.height / 2 - (item.y + item.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          item.x += dx * 0.1;
          item.y += dy * 0.1;
        }
      }
    });
  }

  activateRocket() {
    this.localState.rocketActive = true;
    this.localState.rocketTime = 180;
    this.player.isRocket = true;
    this.showAchievement("Ракета активирована!");
  }

  calculatePoints(platform) {
    let basePoints = 10;
    switch (platform.type) {
      case "spring":
        basePoints = 50;
        break;
      case "rocket":
        basePoints = 100;
        break;
      case "moving":
        basePoints = 20;
        break;
      case "breakable":
        basePoints = 15;
        break;
    }

    const comboBonus = Math.min(this.localState.combo * 2, 50);
    return basePoints + comboBonus;
  }

  createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        velocityX: (Math.random() - 0.5) * 4,
        velocityY: (Math.random() - 0.5) * 4,
        life: 30,
        color: color,
        size: Math.random() * 3 + 1,
        isText: false,
      });
    }
  }

  showScorePopup(x, y, points) {
    this.particles.push({
      x: x,
      y: y,
      velocityX: 0,
      velocityY: -2,
      life: 60,
      color: "#FFFFFF",
      size: 12,
      text: `+${points}`,
      isText: true,
    });
  }

  showAchievement(text) {
    const achievement = {
      text: text,
      life: 180,
      y: 0,
    };

    this.localState.achievements.push(achievement);

    // Создаем элемент DOM для достижения
    const achievementElement = document.createElement("div");
    achievementElement.className = "achievement";
    achievementElement.textContent = text;
    achievementElement.style.opacity = "0";

    const achievementsContainer = document.getElementById("achievements");
    achievementsContainer.appendChild(achievementElement);

    // Анимация появления
    setTimeout(() => {
      achievementElement.style.transition = "all 0.3s ease";
      achievementElement.style.opacity = "1";
      achievementElement.style.transform = "translateX(0)";
    }, 100);

    // Автоматическое удаление
    setTimeout(() => {
      achievementElement.style.opacity = "0";
      achievementElement.style.transform = "translateX(100%)";
      setTimeout(() => {
        achievementsContainer.removeChild(achievementElement);
      }, 300);
    }, 3000);
  }

  draw() {
    if (!this.spritesLoaded) {
      this.ctx.fillStyle = "black";
      this.ctx.font = "16px Arial";
      this.ctx.fillText("Загрузка спрайтов...", 10, 30);
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Рисуем фон
    this.ctx.drawImage(this.sprites.background.sky, 0, 0);

    // Рисуем платформы
    this.platforms.forEach((platform) => {
      if (
        platform.y >= this.cameraY &&
        platform.y <= this.cameraY + this.canvas.height
      ) {
        this.drawPlatform(platform);
      }
    });

    // Рисуем предметы
    this.items.forEach((item) => {
      if (
        !item.collected &&
        item.y >= this.cameraY &&
        item.y <= this.cameraY + this.canvas.height
      ) {
        this.drawItem(item);
      }
    });

    // Рисуем частицы
    this.drawParticles();

    // Рисуем игроков
    this.drawPlayers();

    // Рисуем UI
    this.drawUI();
  }

  drawPlatform(platform) {
    const sprite = this.sprites.platforms[platform.type];
    if (sprite) {
      this.ctx.drawImage(
        sprite,
        platform.x,
        platform.y - this.cameraY,
        platform.width,
        platform.height
      );
    }

    // Индикатор здоровья для разрушаемых платформ
    if (platform.type === "breakable" && platform.health < 3) {
      this.ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
      const healthWidth = (platform.width * platform.health) / 3;
      this.ctx.fillRect(
        platform.x,
        platform.y - this.cameraY - 5,
        healthWidth,
        3
      );
    }
  }

  drawItem(item) {
    const sprite = this.sprites.items[item.type];
    if (sprite) {
      this.ctx.drawImage(
        sprite,
        item.x,
        item.y - this.cameraY,
        item.width,
        item.height
      );
    }
  }

  drawParticles() {
    this.particles.forEach((particle) => {
      this.ctx.globalAlpha = particle.life / 30;

      if (particle.isText) {
        this.ctx.fillStyle = particle.color;
        this.ctx.font = `bold ${particle.size}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.fillText(particle.text, particle.x, particle.y - this.cameraY);
      } else {
        this.ctx.fillStyle = particle.color;
        this.ctx.beginPath();
        this.ctx.arc(
          particle.x,
          particle.y - this.cameraY,
          particle.size,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
    });
    this.ctx.globalAlpha = 1;
  }

  drawPlayers() {
    // Рисуем локального игрока
    this.ctx.save();

    // Эффект щита
    if (this.player.hasShield) {
      this.ctx.strokeStyle = "#4FC3F7";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(
        this.player.x + this.player.width / 2,
        this.player.y - this.cameraY + this.player.height / 2,
        this.player.width / 2 + 5,
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
    }

    // Эффект ракеты
    if (this.player.isRocket) {
      // Пламя ракеты
      const flameLength = 20 + Math.sin(this.animationFrame * 0.3) * 5;
      this.ctx.fillStyle = "#FF5722";
      this.ctx.beginPath();
      this.ctx.moveTo(
        this.player.x + this.player.width / 2,
        this.player.y - this.cameraY + this.player.height
      );
      this.ctx.lineTo(
        this.player.x + this.player.width / 2 - 8,
        this.player.y - this.cameraY + this.player.height + flameLength
      );
      this.ctx.lineTo(
        this.player.x + this.player.width / 2 + 8,
        this.player.y - this.cameraY + this.player.height + flameLength
      );
      this.ctx.closePath();
      this.ctx.fill();

      // Искры
      if (this.animationFrame % 3 === 0) {
        this.createParticles(
          this.player.x + this.player.width / 2,
          this.player.y - this.cameraY + this.player.height + flameLength,
          1,
          "#FFD700"
        );
      }
    }

    // Определяем спрайт игрока
    let playerSprite;
    if (this.player.jumping && this.sprites.player.jump) {
      playerSprite = this.sprites.player.jump;
    } else if (this.player.velocityX > 0) {
      playerSprite = this.sprites.player.right;
    } else if (this.player.velocityX < 0) {
      playerSprite = this.sprites.player.left;
    } else {
      playerSprite = this.sprites.player.normal;
    }

    if (playerSprite) {
      this.ctx.drawImage(
        playerSprite,
        this.player.x,
        this.player.y - this.cameraY,
        this.player.width,
        this.player.height
      );
    }
    this.ctx.restore();

    // Рисуем других игроков
    Object.values(this.gameState.players).forEach((player) => {
      if (
        player.id !== this.gameState.myPlayerId &&
        player.y >= this.cameraY &&
        player.y <= this.cameraY + this.canvas.height
      ) {
        this.ctx.fillStyle = player.color;
        this.ctx.fillRect(
          player.x,
          player.y - this.cameraY,
          this.sizes.player.width,
          this.sizes.player.height
        );

        // Счет игрока
        this.ctx.fillStyle = "black";
        this.ctx.font = "12px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
          player.score,
          player.x + this.sizes.player.width / 2,
          player.y - this.cameraY - 5
        );
      }
    });
  }

  drawUI() {
    // Панель статистики
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(5, 5, 180, 90);

    this.ctx.fillStyle = "white";
    this.ctx.font = "14px Arial";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`Счет: ${this.localState.score}`, 15, 25);
    this.ctx.fillText(`Монеты: ${this.localState.coins}`, 15, 45);
    this.ctx.fillText(`Высота: ${Math.floor(-this.cameraY)}`, 15, 65);

    // Комбо
    if (this.localState.combo > 1) {
      this.ctx.fillStyle = "#FFD700";
      this.ctx.font = "bold 16px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        `Комбо x${this.localState.combo}!`,
        this.canvas.width / 2,
        30
      );
    }

    // Индикаторы улучшений
    let powerUpY = 85;
    if (this.localState.rocketActive) {
      this.ctx.fillStyle = "#FF5722";
      this.ctx.textAlign = "left";
      this.ctx.fillText(
        `Ракета: ${Math.ceil(this.localState.rocketTime / 60)}с`,
        15,
        powerUpY
      );
      powerUpY += 20;
    }

    if (this.localState.shieldActive) {
      this.ctx.fillStyle = "#4FC3F7";
      this.ctx.textAlign = "left";
      this.ctx.fillText(
        `Щит: ${Math.ceil(this.localState.shieldTime / 60)}с`,
        15,
        powerUpY
      );
      powerUpY += 20;
    }

    if (this.localState.magnetActive) {
      this.ctx.fillStyle = "#E91E63";
      this.ctx.textAlign = "left";
      this.ctx.fillText(
        `Магнит: ${Math.ceil(this.localState.magnetTime / 60)}с`,
        15,
        powerUpY
      );
    }
  }

  gameLoop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }

  gameOver() {
    this.localState.gameOver = true;
    this.localState.combo = 0;
    document.getElementById("finalScore").textContent = this.localState.score;
    document.getElementById("gameOver").style.display = "block";
    this.socket.emit("gameOver", { score: this.localState.score });

    // Достижения за результат
    if (this.localState.score >= 1000) {
      this.showAchievement("1000 очков! Отлично!");
    }
    if (this.localState.coins >= 10) {
      this.showAchievement("Коллекционер: 10 монет!");
    }
  }

  restartGame() {
    this.localState.score = 0;
    this.localState.coins = 0;
    this.localState.gameOver = false;
    this.localState.highestPoint = 0;
    this.localState.combo = 0;
    this.localState.rocketActive = false;
    this.localState.shieldActive = false;
    this.localState.magnetActive = false;

    this.player.x = this.canvas.width / 2 - this.sizes.player.width / 2;
    this.player.y = this.canvas.height - 100;
    this.player.velocityY = 0;
    this.player.jumping = false;
    this.player.isRocket = false;
    this.player.hasShield = false;

    this.cameraY = 0;
    this.platforms = [];
    this.items = [];
    this.particles = [];

    this.generateInitialPlatforms();
    this.generateInitialItems();

    document.getElementById("score").textContent = "0";
    document.getElementById("coins").textContent = "0";
    document.getElementById("gameOver").style.display = "none";
    this.socket.emit("restartGame");
  }

  updateUI() {
    document.getElementById("score").textContent = this.localState.score;
    document.getElementById("coins").textContent = this.localState.coins;
    document.getElementById("player-count").textContent = Object.keys(
      this.gameState.players
    ).length;

    const playersList = document.getElementById("playersList");
    playersList.innerHTML = "";

    Object.values(this.gameState.players).forEach((player) => {
      const li = document.createElement("li");
      const isMe = player.id === this.gameState.myPlayerId;
      li.innerHTML = `
                <div class="player-name">
                    <span class="player-color" style="background-color: ${
                      player.color
                    }"></span>
                    <span>${isMe ? "Вы" : "Игрок"}</span>
                </div>
                <span class="player-score">${player.score}</span>
            `;
      playersList.appendChild(li);
    });
  }

  getRandomColor() {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#FFD166",
      "#6A0572",
      "#118AB2",
      "#06D6A0",
      "#FF9E00",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

window.addEventListener("load", () => {
  new DoodleJumpGame();
});
