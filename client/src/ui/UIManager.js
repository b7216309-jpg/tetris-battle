import './ui.css';

export class UIManager {
  constructor(gameManager) {
    this.game = gameManager;
    this.currentScreen = null;
    this._flashTimer = null;
    this._errorTimer = null;

    this._createOverlay();
    this._bindEvents();
    this._setupGameCallbacks();

    this.showScreen('title');
  }

  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'ui-overlay';
    this.overlay.innerHTML = `
      <!-- Title Screen -->
      <div id="title-screen" class="screen">
        <div class="title">TETRIS</div>
        <div class="subtitle">BATTLE</div>
        <button class="btn" id="btn-play-online">PLAY ONLINE</button>
        <button class="btn btn-secondary" id="btn-practice">PRACTICE</button>
      </div>

      <!-- Online Menu Screen -->
      <div id="online-menu-screen" class="screen">
        <div class="screen-title">ONLINE</div>
        <button class="btn" id="btn-quick-match">QUICK MATCH</button>
        <button class="btn" id="btn-create-room">CREATE ROOM</button>
        <button class="btn" id="btn-join-room">JOIN ROOM</button>
        <button class="btn btn-secondary" id="btn-online-back">BACK</button>
      </div>

      <!-- Join Room Screen -->
      <div id="join-room-screen" class="screen">
        <div class="screen-title">JOIN ROOM</div>
        <div class="join-room-form">
          <input type="text" id="room-code-input" class="room-code-input" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false" />
          <div class="join-room-error" id="join-room-error"></div>
          <div class="button-row">
            <button class="btn" id="btn-join-confirm">JOIN</button>
            <button class="btn btn-secondary" id="btn-join-back">BACK</button>
          </div>
        </div>
      </div>

      <!-- Room Lobby Screen -->
      <div id="room-lobby-screen" class="screen">
        <div class="room-lobby-container">
          <div class="room-code-section">
            <div class="room-code-label">ROOM CODE</div>
            <div class="room-code-display">
              <span id="room-code-value">----</span>
              <button class="btn-copy" id="btn-copy-code" title="Copy code">COPY</button>
            </div>
          </div>

          <div class="room-players-section">
            <div class="player-card neon-cyan-border">
              <div class="player-card-role">HOST</div>
              <div class="player-card-status" id="host-status">NOT READY</div>
              <div class="player-card-indicator" id="host-indicator"></div>
            </div>
            <div class="player-card-vs">VS</div>
            <div class="player-card neon-magenta-border">
              <div class="player-card-role">GUEST</div>
              <div class="player-card-status" id="guest-status">WAITING...</div>
              <div class="player-card-indicator" id="guest-indicator"></div>
            </div>
          </div>

          <div class="room-options-panel" id="room-options-panel">
            <div class="options-title">GAME OPTIONS</div>

            <div class="option-row">
              <span class="option-label">STARTING LEVEL</span>
              <div class="option-stepper">
                <button class="stepper-btn" data-option="startingLevel" data-dir="-1">-</button>
                <span class="stepper-value" id="opt-startingLevel">1</span>
                <button class="stepper-btn" data-option="startingLevel" data-dir="1">+</button>
              </div>
            </div>

            <div class="option-row">
              <span class="option-label">GARBAGE DELAY</span>
              <div class="option-select">
                <button class="select-btn" data-option="garbageDelay" data-value="short">SHORT</button>
                <button class="select-btn active" data-option="garbageDelay" data-value="normal">NORMAL</button>
                <button class="select-btn" data-option="garbageDelay" data-value="long">LONG</button>
              </div>
            </div>

            <div class="option-row">
              <span class="option-label">BONUSES</span>
              <div class="option-select">
                <button class="select-btn active" data-option="bonusesEnabled" data-value="true">ON</button>
                <button class="select-btn" data-option="bonusesEnabled" data-value="false">OFF</button>
              </div>
            </div>

            <div class="option-row">
              <span class="option-label">SPEED CURVE</span>
              <div class="option-select">
                <button class="select-btn active" data-option="speedCurve" data-value="normal">NORMAL</button>
                <button class="select-btn" data-option="speedCurve" data-value="fast">FAST</button>
              </div>
            </div>

            <div class="option-row">
              <span class="option-label">LINES TO WIN</span>
              <div class="option-select">
                <button class="select-btn active" data-option="linesToWin" data-value="0">NONE</button>
                <button class="select-btn" data-option="linesToWin" data-value="40">40L</button>
                <button class="select-btn" data-option="linesToWin" data-value="100">100L</button>
                <button class="select-btn" data-option="linesToWin" data-value="150">150L</button>
              </div>
            </div>
          </div>

          <div class="room-lobby-error" id="room-lobby-error"></div>

          <div class="room-actions">
            <button class="btn" id="btn-ready">READY</button>
            <button class="btn" id="btn-start-game" disabled>START GAME</button>
            <button class="btn btn-danger" id="btn-leave-room">LEAVE</button>
          </div>
        </div>
      </div>

      <!-- Lobby Screen (Quick Match) -->
      <div id="lobby-screen" class="screen">
        <div class="spinner"></div>
        <div class="lobby-text">SEARCHING FOR OPPONENT...</div>
        <button class="btn btn-danger" id="btn-cancel">CANCEL</button>
      </div>

      <!-- Countdown Screen -->
      <div id="countdown-screen" class="screen">
        <div class="countdown-number" id="countdown-display">3</div>
      </div>

      <!-- HUD Screen -->
      <div id="hud-screen" class="screen">
        <!-- Player HUD -->
        <div class="board-hud" id="hud-player">
          <div class="board-hud-label neon-cyan-text">YOU</div>
          <div class="hud-panel neon-cyan">
            <div class="hud-label">SCORE</div>
            <div class="hud-value" id="hud-score">0</div>
          </div>
          <div class="hud-panel neon-cyan">
            <div class="hud-label">LEVEL</div>
            <div class="hud-value" id="hud-level">1</div>
          </div>
          <div class="hud-panel neon-cyan">
            <div class="hud-label">LINES</div>
            <div class="hud-value" id="hud-lines">0</div>
          </div>
          <div class="hud-panel neon-cyan">
            <div class="hud-label">COMBO</div>
            <div class="hud-value" id="hud-combo">-</div>
          </div>
        </div>

        <!-- Opponent HUD -->
        <div class="board-hud" id="hud-opponent">
          <div class="board-hud-label neon-magenta-text">OPP</div>
          <div class="hud-panel neon-magenta">
            <div class="hud-label">SCORE</div>
            <div class="hud-value" id="hud-opp-score">0</div>
          </div>
          <div class="hud-panel neon-magenta">
            <div class="hud-label">LEVEL</div>
            <div class="hud-value" id="hud-opp-level">1</div>
          </div>
          <div class="hud-panel neon-magenta">
            <div class="hud-label">LINES</div>
            <div class="hud-value" id="hud-opp-lines">0</div>
          </div>
          <div class="hud-panel neon-magenta">
            <div class="hud-label">COMBO</div>
            <div class="hud-value" id="hud-opp-combo">-</div>
          </div>
        </div>

        <!-- Tug-of-war bar (versus only) -->
        <div class="tug-bar" id="lead-bar">
          <div class="tug-bar-track">
            <div class="tug-bar-cursor" id="tug-cursor"></div>
          </div>
        </div>

        <!-- VS indicator -->
        <div class="vs-indicator" id="vs-indicator">VS</div>

        <div class="effect-tray" id="effect-tray"></div>
        <div class="bonus-feed" id="bonus-feed"></div>
        <div class="hud-message" id="hud-message"></div>
        <div class="hud-flash-layer" id="hud-flash-layer"></div>
      </div>

      <!-- Game Over Screen -->
      <div id="gameover-screen" class="screen">
        <div class="result-text" id="result-text">YOU WIN</div>
        <div class="stats-grid">
          <div><div class="stat-label">SCORE</div><div class="stat-value" id="stat-score">0</div></div>
          <div><div class="stat-label">LINES</div><div class="stat-value" id="stat-lines">0</div></div>
          <div><div class="stat-label">LEVEL</div><div class="stat-value" id="stat-level">1</div></div>
          <div><div class="stat-label">PIECES</div><div class="stat-value" id="stat-pieces">0</div></div>
        </div>
        <div class="button-row">
          <button class="btn" id="btn-rematch">REMATCH</button>
          <button class="btn btn-secondary" id="btn-back">MENU</button>
        </div>
      </div>
    `;

    // Persistent volume button (always visible)
    this._volumeState = 1; // 0=mute, 0.5=half, 1=full
    const volBtn = document.createElement('button');
    volBtn.id = 'btn-volume';
    volBtn.className = 'btn-volume';
    volBtn.textContent = '🔊';
    volBtn.title = 'Volume';
    this.overlay.appendChild(volBtn);
    volBtn.addEventListener('click', () => {
      this._volumeState = this._volumeState === 1 ? 0.5 : this._volumeState === 0.5 ? 0 : 1;
      volBtn.textContent = this._volumeState === 1 ? '🔊' : this._volumeState === 0.5 ? '🔉' : '🔇';
      this.game.audio.setVolumeState(this._volumeState);
    });

    document.body.appendChild(this.overlay);
  }

  _bindEvents() {
    // Title screen
    this.overlay.querySelector('#btn-play-online').addEventListener('click', () => {
      this.game.showOnlineMenu();
    });

    this.overlay.querySelector('#btn-practice').addEventListener('click', () => {
      this.game.startSolo();
    });

    // Online menu
    this.overlay.querySelector('#btn-quick-match').addEventListener('click', () => {
      this.game.startQuickMatch();
    });

    this.overlay.querySelector('#btn-create-room').addEventListener('click', () => {
      this.game.createRoom();
    });

    this.overlay.querySelector('#btn-join-room').addEventListener('click', () => {
      this.showScreen('join-room');
      const input = this.overlay.querySelector('#room-code-input');
      input.value = '';
      this.overlay.querySelector('#join-room-error').textContent = '';
      setTimeout(() => input.focus(), 100);
    });

    this.overlay.querySelector('#btn-online-back').addEventListener('click', () => {
      this.game.returnToMenu();
    });

    // Join room screen
    const codeInput = this.overlay.querySelector('#room-code-input');
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && codeInput.value.length === 4) {
        this.game.joinRoom(codeInput.value);
      }
    });

    this.overlay.querySelector('#btn-join-confirm').addEventListener('click', () => {
      const code = codeInput.value.trim();
      if (code.length !== 4) {
        this._showJoinError('Enter a 4-character code');
        return;
      }
      this.game.joinRoom(code);
    });

    this.overlay.querySelector('#btn-join-back').addEventListener('click', () => {
      this.showScreen('online-menu');
    });

    // Room lobby
    this.overlay.querySelector('#btn-copy-code').addEventListener('click', () => {
      const code = this.overlay.querySelector('#room-code-value').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = this.overlay.querySelector('#btn-copy-code');
        btn.textContent = 'COPIED!';
        setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
      });
    });

    this.overlay.querySelector('#btn-ready').addEventListener('click', () => {
      this.game.socketClient.toggleReady();
    });

    this.overlay.querySelector('#btn-start-game').addEventListener('click', () => {
      this.game.socketClient.startRoom();
    });

    this.overlay.querySelector('#btn-leave-room').addEventListener('click', () => {
      this.game.leaveRoom();
    });

    // Room options - event delegation
    this.overlay.querySelector('#room-options-panel').addEventListener('click', (e) => {
      if (!this.game.isHost) return;

      const stepperBtn = e.target.closest('.stepper-btn');
      if (stepperBtn) {
        const option = stepperBtn.dataset.option;
        const dir = parseInt(stepperBtn.dataset.dir, 10);
        const opts = { ...this.game.roomOptions };
        if (option === 'startingLevel') {
          opts.startingLevel = Math.max(1, Math.min(15, (opts.startingLevel || 1) + dir));
        }
        this.game.socketClient.updateRoomOptions(opts);
        return;
      }

      const selectBtn = e.target.closest('.select-btn');
      if (selectBtn) {
        const option = selectBtn.dataset.option;
        let value = selectBtn.dataset.value;

        const opts = { ...this.game.roomOptions };
        if (option === 'bonusesEnabled') {
          opts.bonusesEnabled = value === 'true';
        } else if (option === 'linesToWin' || option === 'startingLevel') {
          opts[option] = parseInt(value, 10);
        } else {
          opts[option] = value;
        }
        this.game.socketClient.updateRoomOptions(opts);
      }
    });

    // Quick match cancel
    this.overlay.querySelector('#btn-cancel').addEventListener('click', () => {
      this.game.cancelGame();
    });

    // Game over
    this.overlay.querySelector('#btn-rematch').addEventListener('click', () => {
      if (this.game.isMultiplayer) {
        this.game.startQuickMatch();
      } else {
        this.game.startSolo();
      }
    });

    this.overlay.querySelector('#btn-back').addEventListener('click', () => {
      this.game.returnToMenu();
    });

    window.addEventListener('resize', () => {
      this._onResize();
    });
  }

  _onResize() {
    if (this.currentScreen === 'hud' && this.game.getHudPositions) {
      const pos = this.game.getHudPositions();
      if (pos) this.updateHudPositions(pos);
    }
  }

  _setupGameCallbacks() {
    this.game.onStateChange = (state, data) => {
      switch (state) {
        case 'MENU':
          this.showScreen('title');
          break;
        case 'ONLINE_MENU':
          this.showScreen('online-menu');
          break;
        case 'WAITING':
          this.showScreen('lobby');
          break;
        case 'ROOM_LOBBY':
          this.showScreen('room-lobby');
          this._updateRoomLobby(data);
          break;
        case 'COUNTDOWN':
          this.showScreen('countdown');
          this._updateCountdown(data.countdown);
          break;
        case 'PLAYING':
          this._resetHUD();
          this.showScreen('hud');
          break;
        case 'GAME_OVER':
          break;
        case 'OPPONENT_DISCONNECT':
          this._showOpponentDisconnect();
          break;
        case 'ROOM_ERROR':
          this._showRoomError(data.message);
          break;
      }
    };

    this._playerScore = 0;
    this._oppScore = 0;

    this.game.onStatsUpdate = (stats) => {
      this.overlay.querySelector('#hud-score').textContent = stats.score.toLocaleString();
      this.overlay.querySelector('#hud-level').textContent = stats.level;
      this.overlay.querySelector('#hud-lines').textContent = stats.lines;
      this.overlay.querySelector('#hud-combo').textContent =
        stats.combo >= 0 ? `x${stats.combo + 1}` : '-';
      this._playerScore = stats.score;
      this._updateLeadBar();
    };

    this.game.onOpponentStatsUpdate = (stats) => {
      this.overlay.querySelector('#hud-opp-score').textContent = stats.score.toLocaleString();
      this.overlay.querySelector('#hud-opp-level').textContent = stats.level;
      this.overlay.querySelector('#hud-opp-lines').textContent = stats.lines;
      this._oppScore = stats.score;
      this._updateLeadBar();
    };

    this.game.onAttack = (result) => {
      this._showAttackNotification(result);
    };

    this.game.onBonusEvent = (event) => {
      this._showBonusNotification(event);
    };

    this.game.onEffectsUpdate = (effects) => {
      this._renderEffectTray(effects);
    };

    this.game.onHudPositionUpdate = (positions) => {
      this.updateHudPositions(positions);
    };

    this.game.onGameOver = (isWinner) => {
      this.showScreen('gameover');
      const resultText = this.overlay.querySelector('#result-text');
      resultText.textContent = isWinner ? 'YOU WIN' : (this.game.isMultiplayer ? 'YOU LOSE' : 'GAME OVER');
      resultText.className = 'result-text ' + (isWinner ? 'result-win' : 'result-lose');

      const engine = this.game.localEngine;
      if (engine) {
        this.overlay.querySelector('#stat-score').textContent = engine.score.toLocaleString();
        this.overlay.querySelector('#stat-lines').textContent = engine.linesCleared;
        this.overlay.querySelector('#stat-level').textContent = engine.level;
        this.overlay.querySelector('#stat-pieces').textContent = engine.piecesPlaced;
      }
    };
  }

  // --- Room Lobby ---

  _updateRoomLobby(data) {
    if (!data) return;

    // Room code
    if (data.roomCode) {
      this.overlay.querySelector('#room-code-value').textContent = data.roomCode;
    }

    // Player statuses
    const hostStatus = this.overlay.querySelector('#host-status');
    const guestStatus = this.overlay.querySelector('#guest-status');
    const hostIndicator = this.overlay.querySelector('#host-indicator');
    const guestIndicator = this.overlay.querySelector('#guest-indicator');

    hostStatus.textContent = data.hostReady ? 'READY' : 'NOT READY';
    hostIndicator.className = `player-card-indicator ${data.hostReady ? 'ready' : ''}`;

    if (data.hasGuest) {
      guestStatus.textContent = data.guestReady ? 'READY' : 'NOT READY';
      guestIndicator.className = `player-card-indicator ${data.guestReady ? 'ready' : ''}`;
    } else {
      guestStatus.textContent = 'WAITING...';
      guestIndicator.className = 'player-card-indicator';
    }

    // Options
    if (data.roomOptions) {
      this._renderRoomOptions(data.roomOptions);
    }

    // Guest mode: disable options
    const optionsPanel = this.overlay.querySelector('#room-options-panel');
    if (data.isHost) {
      optionsPanel.classList.remove('guest-mode');
    } else {
      optionsPanel.classList.add('guest-mode');
    }

    // Ready button text
    const readyBtn = this.overlay.querySelector('#btn-ready');
    const myReady = data.isHost ? data.hostReady : data.guestReady;
    readyBtn.textContent = myReady ? 'UNREADY' : 'READY';
    readyBtn.className = myReady ? 'btn btn-danger' : 'btn';

    // Start button (host only)
    const startBtn = this.overlay.querySelector('#btn-start-game');
    if (data.isHost) {
      startBtn.style.display = '';
      startBtn.disabled = !(data.hostReady && data.guestReady && data.hasGuest);
    } else {
      startBtn.style.display = 'none';
    }
  }

  _renderRoomOptions(options) {
    // Starting level
    this.overlay.querySelector('#opt-startingLevel').textContent = options.startingLevel || 1;

    // Select buttons
    const selectBtns = this.overlay.querySelectorAll('#room-options-panel .select-btn');
    for (const btn of selectBtns) {
      const option = btn.dataset.option;
      let value = btn.dataset.value;

      let currentValue;
      if (option === 'bonusesEnabled') {
        currentValue = String(options.bonusesEnabled);
      } else if (option === 'linesToWin') {
        currentValue = String(options.linesToWin);
      } else {
        currentValue = options[option];
      }

      if (value === String(currentValue)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  _showJoinError(message) {
    const el = this.overlay.querySelector('#join-room-error');
    el.textContent = message;
    setTimeout(() => { el.textContent = ''; }, 3000);
  }

  _showRoomError(message) {
    // Show error on the current screen
    if (this.currentScreen === 'join-room') {
      this._showJoinError(message);
    } else if (this.currentScreen === 'room-lobby') {
      const el = this.overlay.querySelector('#room-lobby-error');
      el.textContent = message;
      if (this._errorTimer) clearTimeout(this._errorTimer);
      this._errorTimer = setTimeout(() => { el.textContent = ''; }, 3000);
    }
  }

  // --- Existing methods (unchanged) ---

  updateHudPositions(positions) {
    const hud = this.overlay.querySelector('#hud-screen');
    const playerHud = this.overlay.querySelector('#hud-player');
    const opponentHud = this.overlay.querySelector('#hud-opponent');
    const vsIndicator = this.overlay.querySelector('#vs-indicator');
    const effectTray = this.overlay.querySelector('#effect-tray');
    const bonusFeed = this.overlay.querySelector('#bonus-feed');

    const leadBar = this.overlay.querySelector('#lead-bar');

    if (positions.isVersus) {
      hud.classList.add('hud-versus');
      hud.classList.remove('hud-solo');
      leadBar.style.display = '';
    } else {
      hud.classList.add('hud-solo');
      hud.classList.remove('hud-versus');
      leadBar.style.display = 'none';
    }

    const p = positions.player;
    const hudWidth = 110;

    playerHud.style.left = `${Math.max(4, p.left - hudWidth - 8)}px`;
    playerHud.style.top = `${p.top}px`;

    effectTray.style.left = `${Math.max(4, p.left - hudWidth - 8)}px`;
    effectTray.style.top = `${p.top + 240}px`;
    effectTray.style.width = `${hudWidth + 10}px`;

    if (positions.isVersus && positions.opponent) {
      const o = positions.opponent;

      opponentHud.style.left = `${Math.max(4, o.left - hudWidth - 8)}px`;
      opponentHud.style.top = `${o.top}px`;
      opponentHud.style.display = '';

      const centerX = (p.right + o.left) / 2;
      const centerY = (p.top + p.bottom) / 2;
      vsIndicator.style.left = `${centerX}px`;
      vsIndicator.style.top = `${centerY}px`;
      vsIndicator.style.display = '';

      bonusFeed.style.left = `${centerX - 140}px`;
      bonusFeed.style.top = `${Math.max(8, p.top)}px`;
      bonusFeed.style.right = 'auto';
      bonusFeed.style.width = '280px';
    } else {
      opponentHud.style.display = 'none';
      vsIndicator.style.display = 'none';

      bonusFeed.style.left = 'auto';
      bonusFeed.style.right = `${Math.max(8, window.innerWidth - p.right - hudWidth - 24)}px`;
      bonusFeed.style.top = `${p.top}px`;
      bonusFeed.style.width = '320px';
    }
  }

  _resetHUD() {
    this.overlay.querySelector('#hud-score').textContent = '0';
    this.overlay.querySelector('#hud-level').textContent = '1';
    this.overlay.querySelector('#hud-lines').textContent = '0';
    this.overlay.querySelector('#hud-combo').textContent = '-';
    this.overlay.querySelector('#hud-opp-score').textContent = '0';
    this.overlay.querySelector('#hud-opp-level').textContent = '1';
    this.overlay.querySelector('#hud-opp-lines').textContent = '0';
    this.overlay.querySelector('#hud-opp-combo').textContent = '-';
    this._playerScore = 0;
    this._oppScore = 0;
    this._updateLeadBar();
    this._setHudMessage('');
    this._renderEffectTray({});
    this.overlay.querySelector('#bonus-feed').replaceChildren();
    this._clearHudFlash();
  }

  _updateCountdown(value) {
    const display = this.overlay.querySelector('#countdown-display');
    display.textContent = value <= 0 ? 'GO!' : value;

    const parent = display.parentNode;
    const clone = display.cloneNode(true);
    parent.replaceChild(clone, display);
  }

  _showOpponentDisconnect() {
    this._setHudMessage('OPPONENT DISCONNECTED...', 'danger');
  }

  showScreen(name) {
    const screens = this.overlay.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    if (name !== 'hud') {
      this._clearHudFlash();
    }

    const target = this.overlay.querySelector(`#${name}-screen`);
    if (target) {
      target.classList.add('active');
      this.currentScreen = name;
    }
  }

  _showAttackNotification(result) {
    const existing = this.overlay.querySelectorAll('.attack-notification');
    if (existing.length >= 3) return;

    let text = '';
    let className = '';

    if (result.isPerfectClear) {
      text = 'PERFECT CLEAR';
      className = 'attack-perfect';
    } else if (result.isTSpin) {
      const types = { 1: 'SINGLE', 2: 'DOUBLE', 3: 'TRIPLE' };
      text = `T-SPIN ${types[result.linesCleared] || ''}`;
      if (result.isMini) text = 'MINI ' + text;
      className = 'attack-tspin';
    } else if (result.linesCleared === 4) {
      text = 'TETRIS';
      className = 'attack-tetris';
    }

    if (result.backToBack > 0 && text) {
      text = `B2B ${text}`;
      className = 'attack-b2b';
    }

    if (result.combo > 0) {
      if (text) text += ` + COMBO x${result.combo + 1}`;
      else {
        text = `COMBO x${result.combo + 1}`;
        className = 'attack-combo';
      }
    }

    if (!text && result.attack > 0) {
      const names = { 1: 'SINGLE', 2: 'DOUBLE', 3: 'TRIPLE' };
      text = names[result.linesCleared] || `${result.linesCleared} LINES`;
    }

    if (!text) return;

    const el = document.createElement('div');
    el.className = `attack-notification ${className}`;
    el.textContent = text;
    this.overlay.appendChild(el);

    setTimeout(() => el.remove(), 1500);
  }

  _showBonusNotification(event = {}) {
    const feed = this.overlay.querySelector('#bonus-feed');
    if (!feed) return;

    const { title, subtitle } = this._getBonusDisplay(event);
    const meta = this._getBonusMeta(event);
    const existing = feed.querySelectorAll('.bonus-card');
    if (existing.length >= 4) {
      existing[0].remove();
    }

    const card = document.createElement('div');
    const tone = event.positive === false ? 'negative' : 'positive';
    card.className = `bonus-card ${tone} bonus-${event.kind || 'generic'}`;
    card.innerHTML = `
      <div class="bonus-card-label">${event.positive === false ? 'STATUS HIT' : 'BONUS READY'}</div>
      <div class="bonus-card-title">${title}</div>
      <div class="bonus-card-subtitle">${subtitle}</div>
      ${meta ? `<div class="bonus-card-meta">${meta}</div>` : ''}
    `;
    feed.appendChild(card);

    requestAnimationFrame(() => {
      card.classList.add('visible');
    });

    this._triggerHudFlash(event.kind, event.positive !== false);

    setTimeout(() => {
      card.classList.remove('visible');
      setTimeout(() => card.remove(), 220);
    }, 2400);
  }

  _renderEffectTray(effects = {}) {
    const tray = this.overlay.querySelector('#effect-tray');
    if (!tray) return;

    const chips = [];

    if (effects.stableGarbageLines > 0) {
      chips.push(`
        <div class="effect-chip effect-ironWell">
          <div class="effect-chip-label">IRON WELL</div>
          <div class="effect-chip-value">${effects.stableGarbageLines} STABLE LINES</div>
        </div>
      `);
    }

    if (effects.previewMaskedMs > 0) {
      chips.push(`
        <div class="effect-chip effect-blackout negative">
          <div class="effect-chip-label">BLACKOUT</div>
          <div class="effect-chip-value">PREVIEW JAMMED ${this._formatDuration(effects.previewMaskedMs)}</div>
        </div>
      `);
    }

    if (effects.phaseShiftMs > 0) {
      chips.push(`
        <div class="effect-chip effect-phaseShift">
          <div class="effect-chip-label">PHASE SHIFT</div>
          <div class="effect-chip-value">
            +${effects.lockDelayBoostMs || 0}MS LOCK / +${effects.incomingDelayBoostMs || 0}MS BUFFER
            <span class="effect-chip-timer">${this._formatDuration(effects.phaseShiftMs)}</span>
          </div>
        </div>
      `);
    }

    tray.innerHTML = chips.join('');
  }

  _formatDuration(ms) {
    const seconds = ms / 1000;
    return seconds >= 10 ? `${Math.ceil(seconds)}S` : `${seconds.toFixed(1)}S`;
  }

  _getBonusDisplay(event = {}) {
    const defaults = {
      ironWell: {
        title: 'IRON WELL',
        subtitle: 'NEXT GARBAGE HOLE LOCKED'
      },
      blackout: {
        title: event.positive === false ? 'PREVIEW JAMMED' : 'BLACKOUT SENT',
        subtitle: event.positive === false ? 'YOUR NEXT QUEUE IS SCRAMBLED' : 'OPPONENT LOST THE NEXT QUEUE'
      },
      phaseShift: {
        title: 'PHASE SHIFT',
        subtitle: 'LOCK DELAY AND GARBAGE BUFFER BOOSTED'
      }
    };

    const fallback = defaults[event.kind] || {
      title: 'BONUS',
      subtitle: 'TACTICAL ADVANTAGE ACTIVATED'
    };

    return {
      title: event.title || fallback.title,
      subtitle: event.subtitle || fallback.subtitle
    };
  }

  _getBonusMeta(event = {}) {
    if (event.kind === 'ironWell' && event.stableGarbageLines > 0) {
      return `${event.stableGarbageLines} STABLE LINES BANKED`;
    }

    if (event.kind === 'blackout' && event.previewMaskedMs > 0) {
      return `MASK FOR ${this._formatDuration(event.previewMaskedMs)}`;
    }

    if (event.kind === 'phaseShift' && event.durationMs > 0) {
      return `${this._formatDuration(event.durationMs)} OF BOOSTED CONTROL`;
    }

    return '';
  }

  _triggerHudFlash(kind, positive) {
    const flash = this.overlay.querySelector('#hud-flash-layer');
    if (!flash) return;

    this._clearHudFlash();
    void flash.offsetWidth;

    flash.classList.add('active');
    flash.classList.add(positive ? 'flash-positive' : 'flash-negative');
    if (kind) {
      flash.classList.add(`flash-${kind}`);
    }

    this._flashTimer = setTimeout(() => {
      this._clearHudFlash();
    }, 850);
  }

  _clearHudFlash() {
    const flash = this.overlay.querySelector('#hud-flash-layer');
    if (!flash) return;

    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }

    flash.className = 'hud-flash-layer';
  }

  _setHudMessage(text, tone = 'default') {
    const msg = this.overlay.querySelector('#hud-message');
    if (!msg) return;

    msg.textContent = text;
    msg.className = `hud-message ${tone === 'danger' ? 'hud-message-danger' : ''}`.trim();
  }

  _updateLeadBar() {
    const cursor = this.overlay.querySelector('#tug-cursor');
    if (!cursor) return;

    const p = this._playerScore || 0;
    const o = this._oppScore || 0;
    const total = p + o;

    const pct = total === 0 ? 50 : (p / total) * 100;
    cursor.style.left = `${pct}%`;
  }
}
