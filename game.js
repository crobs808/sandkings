// Sandkings Game - Main Game Engine
// A survival game based on George R.R. Martin's "Sandkings"

class SandkingGame {
    constructor() {
        this.canvas = document.getElementById('tank-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Magnifier overlay for fight highlighting
        this.magnifierCanvas = document.getElementById('magnifier-canvas');
        this.magnifierCtx = this.magnifierCanvas.getContext('2d');
        this.magnifierOverlay = document.getElementById('magnifier-overlay');
        this.highlightFights = false;
        this.activeFightLocation = null;
        
        // Game time: 1 second = 1 day, 365 days = ~6 minutes
        this.gameDay = 0;
        this.gameRunning = false;
        this.lastUpdate = Date.now();
        
        // Game state
        this.foodSupply = 100;
        this.isWithholdingFood = false;
        this.daysWithoutFeeding = 0;
        this.consecutiveDaysFed = 0;
        this.autoFeed = false;
        
        // Player safety level (0-100, lower is more dangerous)
        this.safetyLevel = 100;
        
        // Interactive tools
        this.currentTool = 'hand';
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
        
        // Food pieces in tank
        this.foodPieces = [];
        
        // Active battles
        this.battles = [];
        
        // Spider threat
        this.spider = null;
        this.spiderPieces = [];
        
        // Grabbing state
        this.grabbedMobile = null;
        this.grabbedColony = null;
        this.grabbedFood = null;
        
        // Narrative commentary system
        this.lastCommentTime = 0;
        this.commentCooldown = 15; // seconds between comments
        
        // Wet spots from spray tool
        this.wetSpots = [];
        
        // Tap glass effect
        this.tankShaking = false;
        this.mobilesFreeze = false;
        this.freezeTimer = 0;
        this.shakeIntensity = 0;
        this.agitationLevel = 0; // 0-100, affects mobile speed and behavior
        this.agitationDecayRate = 15; // Points per second
        
        // Generate static sand texture once
        this.generateSandTexture();
        
        // Environment controls
        this.temperature = 50; // 0-100
        this.humidity = 30; // 0-100
        
        // Sound system
        this.audioContext = null;
        this.isMuted = localStorage.getItem('sandkings_muted') === 'true';
        this.ambientSoundInterval = null;
        this.initAudio();
        
        // Sandking colonies - positioned in each corner
        this.colonies = {
            red: this.createColony('red', 60, 60),
            white: this.createColony('white', 740, 60),
            black: this.createColony('black', 60, 540),
            orange: this.createColony('orange', 740, 540)
        };
        
        // Event log
        this.events = [];
        
        this.init();
    }
    
    createColony(color, x, y) {
        return {
            color: color,
            castleX: x,
            castleY: y,
            population: 15,
            mawHealth: 100,
            mawSize: 1, // Size multiplier (starts at 1, grows much slower now)
            hunger: 50, // 0-100, higher means hungrier
            hostility: 0, // 0-100, higher means more hostile
            favoritism: 0, // -50 to +50, tracks targeted treatment
            confidence: 50, // 0-100, increases with favoritism/food, affects aggression
            mood: 'neutral', // neutral, content, angry, hostile, adored, abused
            // Mobiles (individual creatures)
            mobiles: [],
            // Castle building progress
            castleSize: 10,
            castleHealth: 100,
            buildingProgress: 0, // 0-100, how complete the castle is
            // Castle structures (walls, towers, gates)
            walls: [],
            towers: [],
            // Face carving quality and style
            faceQuality: 0, // 0-100
            faceStyle: 'neutral', // neutral, benevolent, grotesque, fearful, adoring
            // Poke counter for interactions
            timesPokedRecently: 0,
            // War tracking
            lastAttackDay: -100, // Last day this colony attacked
            attackCooldown: 15, // Days between attacks (reduced for more action)
            preparingWar: false // Visual indicator
        };
    }
    
    init() {
        // Initialize mobiles for each colony
        Object.values(this.colonies).forEach(colony => {
            this.spawnInitialMobiles(colony);
            this.initializeCastleStructure(colony);
        });
        
        // Set up UI event listeners
        this.setupEventListeners();
        
        // Initialize value displays
        document.getElementById('heat-value').textContent = this.temperature + '°';
        document.getElementById('humidity-value').textContent = this.humidity + '%';
        
        // Set up canvas interaction
        this.setupCanvasInteraction();
        
        // Start game loop
        this.gameRunning = true;
        this.gameLoop();
        
        this.addEvent('The sandkings have awakened. Keep them fed and contained.', 'info');
    }
    
    initializeCastleStructure(colony) {
        // Initialize basic castle structure
        colony.walls = [
            { x: -15, y: -15, w: 30, h: 3 }, // top wall
            { x: -15, y: 12, w: 30, h: 3 }, // bottom wall
            { x: -15, y: -15, w: 3, h: 30 }, // left wall
            { x: 12, y: -15, w: 3, h: 30 } // right wall
        ];
        colony.towers = [
            { x: -15, y: -15, w: 8, h: 8 }, // top-left
            { x: 7, y: -15, w: 8, h: 8 }, // top-right
            { x: -15, y: 7, w: 8, h: 8 }, // bottom-left
            { x: 7, y: 7, w: 8, h: 8 } // bottom-right
        ];
    }
    
    initAudio() {
        // Initialize Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
        
        // Start ambient sound loop
        if (!this.isMuted) {
            this.startAmbientSound();
        }
    }
    
    startAmbientSound() {
        if (this.ambientSoundInterval || this.isMuted || !this.audioContext) return;
        
        this.ambientSoundInterval = setInterval(() => {
            if (this.isMuted || !this.gameRunning) return;
            
            // Calculate total population
            const totalPop = Object.values(this.colonies).reduce((sum, c) => sum + c.population, 0);
            
            // Only play sounds if population is high enough (30+)
            if (totalPop > 30 && Math.random() < 0.3) {
                // Volume scales with population (quieter for lower pop)
                const volume = Math.min(0.15, (totalPop / 200) * 0.15);
                this.playScritchSound(volume);
            }
        }, 800 + Math.random() * 400); // Random interval between sounds
    }
    
    stopAmbientSound() {
        if (this.ambientSoundInterval) {
            clearInterval(this.ambientSoundInterval);
            this.ambientSoundInterval = null;
        }
    }
    
    playScritchSound(volume = 0.1) {
        if (!this.audioContext || this.isMuted) return;
        
        // Create scratchy, sandy sound using noise
        const duration = 0.05 + Math.random() * 0.1;
        const now = this.audioContext.currentTime;
        
        // Create noise buffer
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate filtered noise (scratchy sound)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * volume;
        }
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        // Add filter for more realistic sand sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000 + Math.random() * 3000;
        filter.Q.value = 0.5;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(now);
        source.stop(now + duration);
    }
    
    playAttackSound() {
        if (!this.audioContext || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }
    
    playThudSound() {
        if (!this.audioContext || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(80, now);
        oscillator.frequency.exponentialRampToValueAtTime(20, now + 0.15);
        
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }
    
    playTapSound() {
        if (!this.audioContext || this.isMuted) return;
        
        const now = this.audioContext.currentTime;
        
        // Create two tones for glass tap effect
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // High frequency for glass sound
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1800, now);
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        
        // Sharp bandpass filter for glass-like sound
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 10;
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.1);
        osc2.stop(now + 0.1);
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('sandkings_muted', this.isMuted.toString());
        
        const icon = document.getElementById('mute-icon');
        const btn = document.getElementById('mute-btn');
        
        if (this.isMuted) {
            icon.textContent = '🔇';
            this.stopAmbientSound();
            btn.classList.remove('active');
        } else {
            icon.textContent = '🔊';
            this.startAmbientSound();
            btn.classList.add('active');
        }
    }
    
    spawnInitialMobiles(colony) {
        const baseRadius = 50;
        for (let i = 0; i < colony.population; i++) {
            const angle = (Math.PI * 2 * i) / colony.population;
            const radius = Math.random() * baseRadius;
            colony.mobiles.push({
                x: colony.castleX + Math.cos(angle) * radius,
                y: colony.castleY + Math.sin(angle) * radius,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: 1, // Current size in pixels
                targetSize: 1, // Target size based on game day
                activity: 'wandering', // wandering, building, fighting, feeding
                target: null,
                agitated: false,
                agitationTimer: 0
            });
        }
    }
    
    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.getAttribute('data-tool');
                this.selectTool(tool);
            });
        });
        
        // Auto-feed toggle
        document.getElementById('auto-feed-btn').addEventListener('click', () => {
            this.autoFeed = !this.autoFeed;
            const btn = document.getElementById('auto-feed-btn');
            btn.querySelector('.tool-label').textContent = `Auto Feed: ${this.autoFeed ? 'ON' : 'OFF'}`;
            btn.classList.toggle('active', this.autoFeed);
        });
        
        // Mute toggle
        document.getElementById('mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });
        
        // Highlight fights checkbox
        document.getElementById('highlight-fights-checkbox').addEventListener('change', (e) => {
            this.highlightFights = e.target.checked;
            if (!this.highlightFights) {
                this.magnifierOverlay.classList.add('hidden');
                this.activeFightLocation = null;
            }
        });
        
        // Set initial mute button state
        if (!this.isMuted) {
            document.getElementById('mute-btn').classList.add('active');
        }
        
        // Environment controls
        document.getElementById('heat-slider').addEventListener('input', (e) => {
            this.temperature = parseInt(e.target.value);
            document.getElementById('heat-value').textContent = this.temperature + '°';
        });
        
        document.getElementById('humidity-slider').addEventListener('input', (e) => {
            this.humidity = parseInt(e.target.value);
            document.getElementById('humidity-value').textContent = this.humidity + '%';
        });
        
        // Weather presets
        document.querySelectorAll('.weather-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.getAttribute('data-preset');
                this.applyWeatherPreset(preset);
            });
        });
        
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
    }
    
    applyWeatherPreset(preset) {
        const presets = {
            cloudy: { temp: 30, humidity: 50, name: 'Cloudy' },
            sunny: { temp: 85, humidity: 20, name: 'Sunny' },
            rainy: { temp: 55, humidity: 80, name: 'Rainy' }
        };
        
        const config = presets[preset];
        if (!config) return;
        
        this.temperature = config.temp;
        this.humidity = config.humidity;
        
        // Update sliders
        document.getElementById('heat-slider').value = config.temp;
        document.getElementById('humidity-slider').value = config.humidity;
        
        // Update value displays
        document.getElementById('heat-value').textContent = config.temp + '°';
        document.getElementById('humidity-value').textContent = config.humidity + '%';
        
        this.addEvent(`Weather set to ${config.name}`, 'info');
    }
    
    setupCanvasInteraction() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        
        // Update button states
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
        });
        
        // Update cursor
        this.canvas.className = '';
        if (tool === 'hand') {
            this.canvas.classList.add('cursor-hand');
        } else if (tool === 'grab') {
            this.canvas.style.cursor = 'grab';
        } else if (tool === 'feed' || tool === 'treat' || tool === 'meat' || tool === 'live-food') {
            this.canvas.classList.add('cursor-feed');
        } else if (tool === 'spray') {
            this.canvas.classList.add('cursor-spray');
        } else if (tool === 'spider') {
            this.canvas.style.cursor = 'crosshair';
        }
        
        // Update description
        const descriptions = {
            hand: 'Click and drag to poke sandkings',
            grab: 'Click and drag to pick up and move a sandking',
            feed: 'Drag to drop table scraps (basic food)',
            meat: 'Drag to drop fresh meat (more nutritious)',
            'live-food': 'Drag to drop live prey (🦎 lizard) - they hunt it!',
            treat: 'Click to give special treats (Cost: 5 food)',
            spider: 'Drag to place deadly spider - colonies will unite!',
            spray: 'Click to spray water at sandkings (annoys them)',
            observe: 'Click on a colony to get detailed information'
        };
        document.getElementById('tool-description').textContent = descriptions[tool] || '';
        document.getElementById('current-tool').textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
    }
    
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    handleMouseDown(e) {
        if (!this.gameRunning) return;
        
        const coords = this.getCanvasCoordinates(e);
        this.isDragging = true;
        this.dragStartX = coords.x;
        this.dragStartY = coords.y;
        this.dragCurrentX = coords.x;
        this.dragCurrentY = coords.y;
        
        // If grab tool, try to pick up a sandking
        if (this.currentTool === 'grab') {
            this.handleGrabStart(coords.x, coords.y);
        }
    }
    
    handleMouseMove(e) {
        if (!this.gameRunning || !this.isDragging) return;
        
        const coords = this.getCanvasCoordinates(e);
        this.dragCurrentX = coords.x;
        this.dragCurrentY = coords.y;
        
        // If holding a sandking, move it
        if (this.grabbedMobile && this.currentTool === 'grab') {
            this.grabbedMobile.x = coords.x;
            this.grabbedMobile.y = coords.y;
            this.canvas.style.cursor = 'grabbing';
        }
        
        // If holding live food, move it
        if (this.grabbedFood && this.currentTool === 'grab') {
            this.grabbedFood.x = coords.x;
            this.grabbedFood.y = coords.y;
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    handleMouseUp(e) {
        if (!this.gameRunning) return;
        
        const coords = this.getCanvasCoordinates(e);
        
        // If we were grabbing a sandking, drop it
        if (this.grabbedMobile && this.currentTool === 'grab') {
            this.handleGrabDrop(coords.x, coords.y);
            this.canvas.style.cursor = 'grab';
            this.isDragging = false;
            return;
        }
        
        // If we were grabbing live food, drop it
        if (this.grabbedFood && this.currentTool === 'grab') {
            this.grabbedFood = null;
            this.addEvent('Dropped live food!', 'info');
            this.canvas.style.cursor = 'grab';
            this.isDragging = false;
            return;
        }
        
        // For other tools, only proceed if we had a valid interaction
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Handle tool action
        switch (this.currentTool) {
            case 'hand':
                this.handleHandTool(coords.x, coords.y);
                break;
            case 'feed':
                this.handleFeedTool(coords.x, coords.y, 'scraps');
                break;
            case 'meat':
                this.handleFeedTool(coords.x, coords.y, 'meat');
                break;
            case 'live-food':
                this.handleLiveFoodTool(coords.x, coords.y);
                break;
            case 'treat':
                this.handleTreatTool(coords.x, coords.y);
                break;
            case 'spider':
                this.handleSpiderTool(coords.x, coords.y);
                break;
            case 'spray':
                this.handleSprayTool(coords.x, coords.y);
                break;
            case 'observe':
                this.handleObserveTool(coords.x, coords.y);
                break;
            case 'tap':
                this.handleTapTool();
                break;
        }
    }
    
    handleHandTool(x, y) {
        // Poke/disturb sandkings
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                const dx = mobile.x - x;
                const dy = mobile.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 20) {
                    // Push mobile away
                    mobile.vx += (dx / dist) * 5;
                    mobile.vy += (dy / dist) * 5;
                    
                    // Increase colony hostility slightly
                    colony.hostility += 0.5;
                    colony.favoritism -= 0.2;
                    colony.timesPokedRecently++;
                }
            });
            
            // Check if clicking near castle
            const dx = colony.castleX - x;
            const dy = colony.castleY - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 30) {
                colony.hostility += 1;
                colony.favoritism -= 0.5;
                colony.timesPokedRecently += 2;
                this.addEvent(`You disturbed the ${colony.color} colony. They seem agitated.`, 'warning');
            }
        });
    }
    
    handleGrabStart(x, y) {
        // Try to grab live food first
        let nearestFood = null;
        let minFoodDist = 15; // Must be within 15 pixels
        
        this.foodPieces.forEach(food => {
            if (food.type === 'live') {
                const dx = food.x - x;
                const dy = food.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < minFoodDist) {
                    minFoodDist = dist;
                    nearestFood = food;
                }
            }
        });
        
        if (nearestFood) {
            this.grabbedFood = nearestFood;
            this.addEvent('Grabbed live food!', 'info');
            return;
        }
        
        // Find the nearest mobile to grab
        let nearestMobile = null;
        let nearestColony = null;
        let minDist = 15; // Must be within 15 pixels (increased from 10)
        
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                const dx = mobile.x - x;
                const dy = mobile.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < minDist) {
                    minDist = dist;
                    nearestMobile = mobile;
                    nearestColony = colony;
                }
            });
        });
        
        if (nearestMobile) {
            this.grabbedMobile = nearestMobile;
            this.grabbedColony = nearestColony;
            this.addEvent(`Grabbed a ${nearestColony.color} sandking!`, 'info');
        }
    }
    
    handleGrabDrop(x, y) {
        if (this.grabbedMobile) {
            this.grabbedMobile.x = x;
            this.grabbedMobile.y = y;
            // Reset activity so it wanders from new location
            this.grabbedMobile.activity = 'wandering';
            this.grabbedMobile.target = null;
            
            // Check if dropped in another colony's territory
            let droppedInTerritory = null;
            Object.values(this.colonies).forEach(colony => {
                if (colony !== this.grabbedColony) {
                    const dx = colony.castleX - x;
                    const dy = colony.castleY - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Within 100 pixels = territory
                    if (dist < 100) {
                        droppedInTerritory = colony;
                    }
                }
            });
            
            if (droppedInTerritory) {
                this.grabbedMobile.isIntruder = true;
                this.grabbedMobile.intruderTarget = this.grabbedColony; // Remember home
                this.addEvent(`Dropped ${this.grabbedColony.color} sandking in ${droppedInTerritory.color} territory!`, 'warning');
                
                // Alert the territory owner
                if (this.grabbedMobile.carryingFood) {
                    this.addEvent(`${droppedInTerritory.color} colony notices the intruder carrying food!`, 'danger');
                }
            } else {
                this.addEvent(`Dropped sandking at new location.`, 'info');
            }
            
            // Slightly annoy the colony
            if (this.grabbedColony) {
                this.grabbedColony.hostility = Math.min(100, this.grabbedColony.hostility + 1);
            }
        }
        
        this.grabbedMobile = null;
        this.grabbedColony = null;
    }
    
    handleFeedTool(x, y, foodType = 'scraps') {
        const cost = foodType === 'meat' ? 8 : 5;
        if (this.foodSupply < cost) {
            this.addEvent('Not enough food supply!', 'warning');
            return;
        }
        
        this.foodSupply -= cost;
        this.dropFood(x, y, foodType);
        this.addEvent(`Dropped ${foodType} at location.`, 'info');
    }
    
    handleLiveFoodTool(x, y) {
        if (this.foodSupply < 10) {
            this.addEvent('Not enough food supply!', 'warning');
            return;
        }
        
        this.foodSupply -= 10;
        this.dropFood(x, y, 'live', null, true);
        this.addEvent('Released live prey - watch them hunt!', 'info');
    }
    
    handleSpiderTool(x, y) {
        if (this.spider) {
            this.addEvent('Spider already in tank!', 'warning');
            return;
        }
        
        // Random sci-fi names for the spider
        const spiderNames = [
            'Xenos', 'Krell', 'Zerg', 'Xenon', 'Vex', 'Skarn',
            'Gorn', 'Sleeth', 'Wraith', 'Reaver', 'Viper', 'Scylla',
            'Drac', 'Shade', 'Ravager', 'Stalker', 'Hunter', 'Apex'
        ];
        
        // Add slight random offset for organic landing
        const landingX = x + (Math.random() - 0.5) * 20;
        const landingY = y + (Math.random() - 0.5) * 20;
        
        // Create spider - deadly threat (much stronger now)
        this.spider = {
            x: x,
            y: y,
            targetX: landingX,
            targetY: landingY,
            vx: 0,
            vy: 0,
            health: 200, // Doubled health
            maxHealth: 200,
            size: 20,
            target: null,
            attackCooldown: 0,
            name: spiderNames[Math.floor(Math.random() * spiderNames.length)],
            falling: true,
            fallProgress: 0,
            fallVelocity: 0,
            bouncing: false,
            bounceVelocity: 0,
            fallRotation: Math.random() * Math.PI * 2,
            fallRotationSpeed: (Math.random() - 0.5) * 0.6
        };
        
        // Don't play sound yet - will play when it lands
        this.addEvent('SPIDER RELEASED! Colonies are mobilizing!', 'danger');
        
        // All colonies detect the threat and prepare to unite
        Object.values(this.colonies).forEach(colony => {
            colony.spiderThreat = true;
        });
    }
    
    handleTreatTool(x, y) {
        if (this.foodSupply < 5) {
            this.addEvent('Not enough food supply!', 'warning');
            return;
        }
        
        // Find nearest colony
        let nearestColony = null;
        let minDist = Infinity;
        
        Object.values(this.colonies).forEach(colony => {
            const dx = colony.castleX - x;
            const dy = colony.castleY - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist && dist < 150) {
                minDist = dist;
                nearestColony = colony;
            }
        });
        
        if (nearestColony) {
            this.foodSupply -= 5;
            this.dropFood(x, y, 'treat', nearestColony);
            nearestColony.favoritism += 2;
            nearestColony.hostility = Math.max(0, nearestColony.hostility - 1);
            this.addEvent(`Gave special treat to ${nearestColony.color} colony!`, 'info');
        } else {
            this.addEvent('No colony nearby to receive treat.', 'warning');
        }
    }
    
    handleSprayTool(x, y) {
        // Create wet spot on sand
        this.wetSpots.push({
            x: x,
            y: y,
            radius: 35,
            wetness: 1.0 // 1.0 = fully wet, 0.0 = dry
        });
        
        // Spray annoys sandkings in area
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                const dx = mobile.x - x;
                const dy = mobile.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 40) {
                    // Scatter mobiles
                    mobile.vx += (dx / dist) * 8;
                    mobile.vy += (dy / dist) * 8;
                }
            });
            
            const dx = colony.castleX - x;
            const dy = colony.castleY - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 80) {
                colony.hostility += 2;
                colony.favoritism -= 1;
                this.addEvent(`Sprayed the ${colony.color} colony. They are NOT happy!`, 'danger');
            }
        });
    }
    
    updateWetSpots(deltaTime) {
        // Dry out wet spots over time - faster when hotter
        const baseDryRate = 0.08; // Base drying per second
        const tempDryFactor = 0.5 + (this.temperature / 100) * 1.5; // 0.5x to 2x based on temp
        const dryRate = baseDryRate * tempDryFactor;
        
        for (let i = this.wetSpots.length - 1; i >= 0; i--) {
            const spot = this.wetSpots[i];
            spot.wetness -= dryRate * deltaTime;
            
            // Remove fully dried spots
            if (spot.wetness <= 0) {
                this.wetSpots.splice(i, 1);
            }
        }
    }
    
    updateFallingItems(deltaTime) {
        const gravity = 500; // Pixels per second squared
        const bounceReduction = 0.4; // Bounce loses 60% of velocity
        const startHeight = 80; // Starting height above target
        
        // Update falling food items
        this.foodPieces.forEach(food => {
            if (food.falling) {
                // Apply gravity acceleration
                food.fallVelocity += gravity * deltaTime;
                
                // Calculate current height
                const distanceFallen = food.fallVelocity * deltaTime;
                food.fallProgress += distanceFallen / startHeight;
                
                if (food.fallProgress >= 1) {
                    // Landed! Start bounce
                    food.falling = false;
                    food.bouncing = true;
                    food.bounceVelocity = -food.fallVelocity * bounceReduction;
                    food.x = food.targetX;
                    food.y = food.targetY;
                    this.playThudSound();
                } else {
                    // Interpolate position during fall
                    const t = Math.min(1, food.fallProgress);
                    food.x = food.x + (food.targetX - food.x) * t * deltaTime * 8;
                    food.y = food.y + (food.targetY - food.y) * t * deltaTime * 8;
                    food.fallRotation += food.fallRotationSpeed * (1 + food.fallVelocity / 200);
                }
            } else if (food.bouncing) {
                // Bounce physics
                food.bounceVelocity += gravity * deltaTime * 0.5; // Gravity during bounce
                const bounceHeight = food.bounceVelocity * deltaTime;
                
                if (bounceHeight >= 0) {
                    // Stopped bouncing
                    food.bouncing = false;
                    food.bounceVelocity = 0;
                } else {
                    // Continue bounce with smaller velocity
                    food.bounceVelocity *= 0.95;
                }
            }
        });
        
        // Update falling spider
        if (this.spider && this.spider.falling) {
            this.spider.fallVelocity += gravity * deltaTime;
            const distanceFallen = this.spider.fallVelocity * deltaTime;
            this.spider.fallProgress += distanceFallen / startHeight;
            
            if (this.spider.fallProgress >= 1) {
                this.spider.falling = false;
                this.spider.bouncing = true;
                this.spider.bounceVelocity = -this.spider.fallVelocity * bounceReduction;
                this.spider.x = this.spider.targetX;
                this.spider.y = this.spider.targetY;
                this.playThudSound();
            } else {
                const t = Math.min(1, this.spider.fallProgress);
                this.spider.x = this.spider.x + (this.spider.targetX - this.spider.x) * t * deltaTime * 8;
                this.spider.y = this.spider.y + (this.spider.targetY - this.spider.y) * t * deltaTime * 8;
                this.spider.fallRotation += this.spider.fallRotationSpeed * (1 + this.spider.fallVelocity / 200);
            }
        } else if (this.spider && this.spider.bouncing) {
            this.spider.bounceVelocity += gravity * deltaTime * 0.5;
            const bounceHeight = this.spider.bounceVelocity * deltaTime;
            
            if (bounceHeight >= 0) {
                this.spider.bouncing = false;
                this.spider.bounceVelocity = 0;
            } else {
                this.spider.bounceVelocity *= 0.95;
            }
        }
    }
    
    updateTapEffect(deltaTime) {
        // Reduce shake intensity
        if (this.tankShaking) {
            this.shakeIntensity *= 0.85;
            if (this.shakeIntensity < 0.1) {
                this.shakeIntensity = 0;
            }
        }
        
        // Update freeze timer
        if (this.mobilesFreeze) {
            this.freezeTimer -= deltaTime;
            if (this.freezeTimer <= 0) {
                this.mobilesFreeze = false;
                this.freezeTimer = 0;
            }
        }
        
        // Decay agitation level over time
        if (this.agitationLevel > 0) {
            this.agitationLevel -= this.agitationDecayRate * deltaTime;
            if (this.agitationLevel < 0) {
                this.agitationLevel = 0;
            }
        }
        
        // Update individual mobile agitation timers
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                if (mobile.agitated) {
                    mobile.agitationTimer -= deltaTime;
                    if (mobile.agitationTimer <= 0) {
                        mobile.agitated = false;
                        mobile.agitationTimer = 0;
                    }
                }
            });
        });
    }
    
    handleTapTool() {
        // Tap on glass effect - startles all sandkings
        this.playTapSound();
        this.tankShaking = true;
        this.shakeIntensity = 8;
        
        // Increase agitation level (cumulative with repeated taps)
        this.agitationLevel = Math.min(100, this.agitationLevel + 25);
        
        // Disperse and agitate all mobiles
        Object.values(this.colonies).forEach(colony => {
            // Increase colony hostility
            colony.hostility = Math.min(100, colony.hostility + 5);
            
            colony.mobiles.forEach(mobile => {
                // Calculate distance from home
                const dx = mobile.x - colony.castleX;
                const dy = mobile.y - colony.castleY;
                const distFromHome = Math.sqrt(dx * dx + dy * dy);
                
                // Scatter away from castle in panic
                const scatterAngle = Math.random() * Math.PI * 2;
                const scatterForce = 50 + this.agitationLevel * 0.5; // More agitation = further scatter
                
                mobile.vx += Math.cos(scatterAngle) * scatterForce;
                mobile.vy += Math.sin(scatterAngle) * scatterForce;
                
                // Mark as agitated
                mobile.agitated = true;
                mobile.agitationTimer = 4 + Math.random(); // 4-5 seconds
                
                // Interrupt current activity
                if (mobile.activity !== 'fighting_spider') {
                    mobile.activity = 'wandering';
                    mobile.target = null;
                    mobile.carryingFood = false;
                }
            });
        });
        
        // After shake, freeze mobiles for 1 second
        setTimeout(() => {
            this.tankShaking = false;
            this.mobilesFreeze = true;
            this.freezeTimer = 1.0; // 1 second freeze
        }, 100); // 100ms shake duration
        
        this.addEvent('*TAP* Glass vibration startles the sandkings!', 'warning');
    }
    
    handleObserveTool(x, y) {
        // Find which colony was clicked
        let foundColony = null;
        Object.values(this.colonies).forEach(colony => {
            const dx = colony.castleX - x;
            const dy = colony.castleY - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 80) {
                foundColony = colony;
            }
        });
        
        if (foundColony) {
            this.showObservePanel(foundColony, x, y);
        } else {
            this.addEvent('Click near a colony castle to observe it.', 'info');
        }
    }
    
    showObservePanel(colony, clickX, clickY) {
        const overlay = document.getElementById('observe-overlay');
        const name = document.getElementById('observe-colony-name');
        const content = document.getElementById('observe-content');
        
        // Set colony name with color
        name.textContent = `${colony.color.toUpperCase()} COLONY`;
        name.style.color = colony.color === 'white' ? '#eee' : colony.color;
        
        // Calculate average mobile size for sentience check
        const avgSize = colony.mobiles.length > 0 
            ? (colony.mobiles.reduce((sum, m) => sum + m.size, 0) / colony.mobiles.length)
            : 0;
        
        // Sentience levels based on size
        const hasBasicSentience = avgSize >= 3;  // Small awareness
        const hasAdvancedSentience = avgSize >= 7; // Complex thoughts
        const hasHighSentience = avgSize >= 11; // Philosophy/religion
        
        // Calculate "God Awareness" (relationship with player/favoritism)
        const godAwareness = Math.max(1, Math.min(10, Math.round((colony.favoritism + 50) / 10)));
        
        // Calculate relationships with other colonies
        const relationships = {};
        const allies = [];
        const enemies = [];
        Object.entries(this.colonies).forEach(([color, otherColony]) => {
            if (color === colony.color) return;
            
            // Determine relationship based on multiple factors
            let relationScore = 0;
            
            // Spatial proximity (colonies farther apart are more neutral)
            const dx = colony.castleX - otherColony.castleX;
            const dy = colony.castleY - otherColony.castleY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const proximityFactor = Math.max(0, (800 - distance) / 800); // 0-1
            
            // Hostility affects relationships negatively
            relationScore -= (colony.hostility + otherColony.hostility) / 100;
            
            // Hunger increases rivalry
            if (colony.hunger > 60 && otherColony.population > colony.population) {
                relationScore -= 0.5; // See them as threats/food
            }
            
            // Confidence difference
            const confidenceDiff = colony.confidence - otherColony.confidence;
            if (confidenceDiff > 30) relationScore += 0.3; // Feel superior
            else if (confidenceDiff < -30) relationScore -= 0.3; // Feel threatened
            
            // Recent battles
            if (colony.lastAttackDay > this.gameDay - 50) {
                relationScore -= 0.5; // Recent warlike behavior
            }
            
            // Apply proximity
            relationScore *= proximityFactor;
            
            // Convert to percentage and classify
            const relationPercent = Math.max(-100, Math.min(100, relationScore * 50));
            let relationStatus;
            if (relationPercent > 40) relationStatus = 'ally';
            else if (relationPercent > 10) relationStatus = 'friendly';
            else if (relationPercent > -10) relationStatus = 'neutral';
            else if (relationPercent > -40) relationStatus = 'hostile';
            else relationStatus = 'enemy';
            
            relationships[color] = { percent: relationPercent, status: relationStatus };
            
            // Add to allies or enemies lists
            const colorName = color.charAt(0).toUpperCase() + color.slice(1);
            if (relationStatus === 'ally' || relationStatus === 'friendly') {
                allies.push(colorName);
            } else if (relationStatus === 'enemy' || relationStatus === 'hostile') {
                enemies.push(colorName);
            }
        });
        
        // Build stats HTML
        let statsHTML = '';
        
        // Basic stats (always visible)
        const hungerClass = colony.hunger > 70 ? 'danger' : colony.hunger > 40 ? 'warning' : 'good';
        const popClass = colony.population > 50 ? 'good' : colony.population < 20 ? 'danger' : '';
        
        statsHTML += `
            <div class="observe-stat">
                <span class="observe-stat-label">Population:</span>
                <span class="observe-stat-value ${popClass}">${colony.population}</span>
            </div>
            <div class="observe-stat">
                <span class="observe-stat-label">Avg Size:</span>
                <span class="observe-stat-value">${avgSize.toFixed(1)}mm</span>
            </div>
            <div class="observe-stat">
                <span class="observe-stat-label">Hunger:</span>
                <span class="observe-stat-value ${hungerClass}">${Math.floor(colony.hunger)}%</span>
            </div>`;
        
        // Show allies and enemies if sentient enough
        if (hasAdvancedSentience) {
            statsHTML += `
                <div class="observe-stat">
                    <span class="observe-stat-label">Allies:</span>
                    <span class="observe-stat-value good">${allies.length > 0 ? allies.join(', ') : 'None'}</span>
                </div>
                <div class="observe-stat">
                    <span class="observe-stat-label">Enemies:</span>
                    <span class="observe-stat-value danger">${enemies.length > 0 ? enemies.join(', ') : 'None'}</span>
                </div>`;
        }
        
        // Sentience-dependent stats
        if (hasBasicSentience) {
            statsHTML += `
                <div class="observe-stat">
                    <span class="observe-stat-label">Mood:</span>
                    <span class="observe-stat-value">${colony.mood.charAt(0).toUpperCase() + colony.mood.slice(1)}</span>
                </div>`;
        }
        
        if (hasAdvancedSentience) {
            const godClass = godAwareness >= 7 ? 'good' : godAwareness <= 3 ? 'danger' : 'warning';
            statsHTML += `
                <div class="observe-stat">
                    <span class="observe-stat-label">God Devotion:</span>
                    <span class="observe-stat-value ${godClass}">${godAwareness}/10</span>
                </div>
                <div class="observe-stat">
                    <span class="observe-stat-label">Castle Face:</span>
                    <span class="observe-stat-value">${colony.faceStyle.charAt(0).toUpperCase() + colony.faceStyle.slice(1)}</span>
                </div>`;
            
            // Show relationships
            Object.entries(relationships).forEach(([color, rel]) => {
                const relClass = rel.status === 'ally' ? 'good' : 
                                 rel.status === 'enemy' ? 'danger' : 
                                 rel.status === 'hostile' ? 'danger' : '';
                const colorName = color.charAt(0).toUpperCase() + color.slice(1);
                statsHTML += `
                    <div class="observe-stat">
                        <span class="observe-stat-label">vs ${colorName}:</span>
                        <span class="observe-stat-value ${relClass}">${rel.status.toUpperCase()}</span>
                    </div>`;
            });
        }
        
        if (hasHighSentience) {
            const thoughtsAboutLife = [
                "Questioning existence",
                "Contemplating war",
                "Dreaming of feast",
                "Fearing the void",
                "Sensing your presence",
                "Planning expansion",
                "Mourning the dead",
                "Worshipping the face",
                "Craving sustenance",
                "Plotting revenge"
            ];
            const randomThought = thoughtsAboutLife[Math.floor((colony.hostility + colony.hunger + this.gameDay) % thoughtsAboutLife.length)];
            
            statsHTML += `
                <div class="observe-stat">
                    <span class="observe-stat-label">Thoughts:</span>
                    <span class="observe-stat-value" style="font-style: italic;">"${randomThought}"</span>
                </div>`;
            
            // Awareness of mortality
            const daysAlive = Math.floor(this.gameDay);
            if (daysAlive > 100) {
                statsHTML += `
                    <div class="observe-stat">
                        <span class="observe-stat-label">Age Awareness:</span>
                        <span class="observe-stat-value">Ancient (${daysAlive} days)</span>
                    </div>`;
            }
        }
        
        content.innerHTML = statsHTML;
        
        // Position overlay near click location
        // Convert canvas coordinates to page coordinates
        const canvasRect = this.canvas.getBoundingClientRect();
        const pageX = canvasRect.left + clickX;
        const pageY = canvasRect.top + clickY;
        
        // Show overlay first to measure its dimensions
        overlay.classList.remove('hidden');
        const overlayRect = overlay.getBoundingClientRect();
        
        // Calculate position, keeping it within viewport
        let left = pageX - overlayRect.width / 2;
        let top = pageY + 20; // Offset below click
        
        // Keep within bounds
        const margin = 20;
        left = Math.max(margin, Math.min(window.innerWidth - overlayRect.width - margin, left));
        top = Math.max(margin, Math.min(window.innerHeight - overlayRect.height - margin, top));
        
        // Apply positioning
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        overlay.style.transform = 'none'; // Remove centering transform
        
        // Auto-close after 5 seconds
        if (this.observeTimeout) clearTimeout(this.observeTimeout);
        this.observeTimeout = setTimeout(() => {
            overlay.classList.add('hidden');
        }, 5000);
        
        // Setup close button
        const closeBtn = document.getElementById('observe-close-btn');
        closeBtn.onclick = () => {
            if (this.observeTimeout) clearTimeout(this.observeTimeout);
            overlay.classList.add('hidden');
        };
    }
    
    dropFood(x, y, type = 'scraps', targetColony = null, isLive = false) {
        // Calculate average sandking size across all colonies to scale food appropriately
        let totalSize = 0;
        let totalMobiles = 0;
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                totalSize += mobile.size;
                totalMobiles++;
            });
        });
        const avgMobileSize = totalMobiles > 0 ? totalSize / totalMobiles : 2;
        
        // Scale food based on average mobile size (food should be 0.8-1.5x mobile size)
        const sizeScale = Math.max(0.5, Math.min(2, avgMobileSize / 5));
        
        const foodTypes = {
            scraps: { size: 3 * sizeScale, amount: 10, color: '#dd9966', nutritionValue: 10 },
            meat: { size: 5 * sizeScale, amount: 20, color: '#dd5555', nutritionValue: 25 },
            treat: { size: 5 * sizeScale, amount: 20, color: '#ffdd66', nutritionValue: 20 },
            live: { size: 4 * sizeScale, amount: 25, color: '#88dd88', nutritionValue: 30 }
        };
        
        const foodData = foodTypes[type] || foodTypes.scraps;
        
        // Add slight random offset for organic landing
        const landingX = x + (Math.random() - 0.5) * 20;
        const landingY = y + (Math.random() - 0.5) * 20;
        
        const foodPiece = {
            x: x,
            y: y,
            targetX: landingX,
            targetY: landingY,
            vx: isLive ? (Math.random() - 0.5) * 2 : 0,
            vy: isLive ? (Math.random() - 0.5) * 2 : 0,
            type: type,
            size: foodData.size,
            amount: foodData.amount,
            color: foodData.color,
            nutritionValue: foodData.nutritionValue,
            targetColony: targetColony,
            claimed: false,
            isLive: isLive,
            health: isLive ? 100 : 0,
            alive: isLive,
            falling: true,
            fallProgress: 0,
            fallVelocity: 0,
            bouncing: false,
            bounceVelocity: 0,
            fallRotation: Math.random() * Math.PI * 2,
            fallRotationSpeed: (Math.random() - 0.5) * 0.5
        };
        this.foodPieces.push(foodPiece);
    }
    
    gameLoop() {
        if (!this.gameRunning) return;
        
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;
        
        // Update game day (1 second = 1 day)
        this.gameDay += deltaTime;
        
        // Update game state
        this.updateWetSpots(deltaTime);
        this.updateFallingItems(deltaTime);
        this.updateTapEffect(deltaTime);
        this.updateColonies(deltaTime);
        this.updateSafety();
        this.checkGameOver();
        
        // Render
        this.render();
        this.renderMagnifier();
        
        // Update UI
        this.updateUI();
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateColonies(deltaTime) {
        // Process food pieces - check if sandkings should swarm
        this.updateFoodPieces(deltaTime);
        
        Object.values(this.colonies).forEach(colony => {
            // Decay recent poke counter
            colony.timesPokedRecently *= 0.99;
            
            // Increase hunger over time - affected by temperature
            const tempHungerFactor = 1 + ((this.temperature - 50) / 100); // Hotter = faster hunger
            colony.hunger += deltaTime * 0.5 * tempHungerFactor;
            if (colony.hunger > 100) colony.hunger = 100;
            
            // Calculate expected size based on game day
            // Growth affected by temperature and humidity
            const growthProgress = Math.min(this.gameDay / 365, 1);
            const tempGrowthFactor = 0.7 + (this.temperature / 100) * 0.6; // Heat speeds growth (0.7-1.3x)
            const humidityFactor = 0.8 + Math.max(0, 1 - Math.abs(this.humidity - 40) / 40) * 0.4; // Optimal at 40% (0.8-1.2x)
            const baseTargetSize = 1 + growthProgress * 14 * tempGrowthFactor * humidityFactor; // 1 to 15 pixels max (modified by environment)
            
            // Hunger affects growth (if starving, growth slows dramatically)
            const hungerMultiplier = colony.hunger > 70 ? 0.3 : 1.0;
            const targetSize = baseTargetSize * hungerMultiplier;
            
            // Update maw size (also grows much slower)
            colony.mawSize = 1 + growthProgress * 1.5; // 1 to 2.5x
            
            // Update favoritism decay (gradually returns to neutral)
            colony.favoritism *= 0.995;
            
            // Update confidence based on favoritism and hunger
            // Well-fed and favored colonies gain confidence
            if (colony.favoritism > 10 && colony.hunger < 40) {
                colony.confidence = Math.min(100, colony.confidence + deltaTime * 0.2);
            } else if (colony.favoritism < -10 || colony.hunger > 70) {
                colony.confidence = Math.max(0, colony.confidence - deltaTime * 0.3);
            } else {
                // Slowly drift toward neutral confidence
                colony.confidence += (50 - colony.confidence) * 0.001;
            }
            
            // Update hostility based on treatment and environment
            const envStress = Math.max(0, (this.temperature - 70) / 30) + Math.abs(this.humidity - 40) / 40; // Environmental stress
            
            if (colony.hunger > 70) {
                colony.hostility += deltaTime * (0.3 + envStress * 0.2);
            } else if (colony.hunger < 30 && colony.favoritism > 0) {
                // Gradually reduce hostility if well-fed and favored
                colony.hostility -= deltaTime * 0.08;
            } else if (colony.hunger < 40 && colony.favoritism >= 0) {
                // Slowly reduce if just well-fed
                colony.hostility -= deltaTime * 0.03;
            }
            
            // Environment stress increases baseline hostility
            colony.hostility += deltaTime * envStress * 0.05;
            
            // Poking increases hostility
            if (colony.timesPokedRecently > 5) {
                colony.hostility += deltaTime * 0.2;
            }
            
            colony.hostility = Math.max(0, Math.min(100, colony.hostility));
            
            // Update mood and face style based on hunger, hostility, and favoritism
            if (colony.favoritism > 20 && colony.hunger < 40) {
                colony.mood = 'adored';
                colony.faceStyle = 'adoring';
            } else if (colony.favoritism < -20 || colony.timesPokedRecently > 10) {
                colony.mood = 'abused';
                colony.faceStyle = 'fearful';
            } else if (colony.hostility > 60) {
                colony.mood = 'hostile';
                colony.faceStyle = 'grotesque';
            } else if (colony.hunger > 70) {
                colony.mood = 'angry';
                colony.faceStyle = 'grotesque';
            } else if (colony.hunger < 40 && colony.hostility < 30) {
                colony.mood = 'content';
                colony.faceStyle = 'benevolent';
            } else {
                colony.mood = 'neutral';
                colony.faceStyle = 'neutral';
            }
            
            // Update castle building progress
            if (colony.hunger < 60 && colony.population > 10) {
                colony.buildingProgress += deltaTime * 0.15;
                colony.buildingProgress = Math.min(100, colony.buildingProgress);
            }
            
            // Castle size grows with building progress
            colony.castleSize = 10 + (colony.buildingProgress * 0.4);
            
            // Update mobiles (skip if frozen from tap)
            if (!this.mobilesFreeze) {
                colony.mobiles.forEach((mobile, index) => {
                    // Gradually grow to target size
                    if (mobile.targetSize < targetSize) {
                        mobile.targetSize += deltaTime * 0.3;
                    }
                    if (mobile.size < mobile.targetSize) {
                        mobile.size += deltaTime * 0.2;
                    }
                    
                    // Movement AI
                    this.updateMobileMovement(mobile, colony, deltaTime);
                    
                    // Check if mobile should die (starvation)
                    if (colony.hunger > 90 && Math.random() < 0.001) {
                        colony.mobiles.splice(index, 1);
                        colony.population--;
                    }
                });
            }
            
            // Face carving develops after day 30 if conditions are right
            if (this.gameDay > 30) {
                if (colony.hunger < 50 && colony.buildingProgress > 50) {
                    colony.faceQuality += deltaTime * 0.3;
                } else if (colony.hostility > 50 || colony.favoritism < -10) {
                    colony.faceQuality = Math.max(0, colony.faceQuality - deltaTime * 0.1);
                }
                colony.faceQuality = Math.min(100, colony.faceQuality);
            }
            
            // Spawn new mobiles if population is low and well-fed
            if (colony.population < 60 && colony.hunger < 50 && Math.random() < 0.008) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 40;
                colony.mobiles.push({
                    x: colony.castleX + Math.cos(angle) * radius,
                    y: colony.castleY + Math.sin(angle) * radius,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: 1,
                    targetSize: targetSize,
                    activity: 'wandering',
                    target: null,
                    carryingFood: false
                });
                colony.population++;
            }
            
            // Check for intruders in territory
            Object.values(this.colonies).forEach(otherColony => {
                if (otherColony === colony) return;
                
                otherColony.mobiles.forEach(intruder => {
                    const dx = colony.castleX - intruder.x;
                    const dy = colony.castleY - intruder.y;
                    const distToTerritory = Math.sqrt(dx * dx + dy * dy);
                    
                    // Intruder in our territory
                    if (distToTerritory < 100 && !intruder.warParty) {
                        intruder.isIntruder = true;
                        intruder.intruderTarget = otherColony;
                        
                        // Send defenders to deal with intruder
                        colony.mobiles.forEach(defender => {
                            const dxi = intruder.x - defender.x;
                            const dyi = intruder.y - defender.y;
                            const distToIntruder = Math.sqrt(dxi * dxi + dyi * dyi);
                            
                            // Nearby defenders respond
                            if (distToIntruder < 60 && defender.activity !== 'fighting_spider' && Math.random() < 0.1) {
                                defender.activity = 'chasing_intruder';
                                defender.target = intruder;
                                defender.chasingColony = otherColony;
                            }
                        });
                    }
                });
            });
            
            // Check if colony should attack (multiple conditions)
            const hasEnoughForces = colony.population > 20;
            const canAttack = this.gameDay - colony.lastAttackDay > colony.attackCooldown;
            
            if (hasEnoughForces && canAttack) {
                let shouldAttack = false;
                let attackReason = '';
                
                // 1. Desperate hunger attack (original condition)
                if (colony.hunger > 80 && colony.hostility > 50) {
                    colony.preparingWar = true;
                    shouldAttack = Math.random() < 0.15; // Increased from 0.05
                    attackReason = 'desperation';
                }
                // 2. High hostility attack (anger-driven)
                else if (colony.hostility > 70 && colony.hunger > 50) {
                    colony.preparingWar = true;
                    shouldAttack = Math.random() < 0.10; // Increased from 0.03
                    attackReason = 'anger';
                }
                // 3. Confidence-based opportunistic attack
                else if (colony.confidence > 70 && colony.population > 30) {
                    // Find weakest colony
                    const otherColonies = Object.values(this.colonies).filter(c => c !== colony);
                    const weakest = otherColonies.reduce((min, c) => 
                        c.confidence < min.confidence ? c : min, otherColonies[0]);
                    
                    // Attack if confidence gap is large enough
                    if (weakest && colony.confidence - weakest.confidence > 30) {
                        colony.preparingWar = true;
                        shouldAttack = Math.random() < 0.08; // Increased from 0.02
                        attackReason = 'dominance';
                    }
                }
                // 4. Territorial aggression (combination)
                else if (colony.hostility > 60 && colony.confidence > 60) {
                    colony.preparingWar = true;
                    shouldAttack = Math.random() < 0.06; // Increased from 0.015
                    attackReason = 'territorial';
                }
                // 5. Food-motivated raid (new)
                else if (colony.hunger > 65 && colony.population > 25) {
                    colony.preparingWar = true;
                    shouldAttack = Math.random() < 0.05; // New attack type
                    attackReason = 'raid';
                }
                
                if (shouldAttack) {
                    this.initiateAttack(colony, attackReason);
                }
                
                if (!shouldAttack && colony.preparingWar) {
                    colony.preparingWar = false;
                }
            } else {
                colony.preparingWar = false;
            }
        });
        
        // Update active battles
        this.updateBattles(deltaTime);
        
        // Update spider threat
        if (this.spider) {
            this.updateSpider(deltaTime);
        }
        
        // Update spider pieces being carried
        this.updateSpiderPieces(deltaTime);
        
        // Add narrative commentary
        this.updateNarrative(deltaTime);
        
        // Auto-feed if enabled
        if (this.autoFeed && this.foodSupply >= 10 && this.gameDay % 5 < deltaTime) {
            // Random position in central area (within 150 pixels of center)
            const centerX = 400;
            const centerY = 300;
            const radius = 150;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            this.dropFood(x, y, 'normal');
            this.foodSupply -= 10;
        }
        
        // Auto-drain food supply slowly
        this.foodSupply -= deltaTime * 0.05;
        if (this.foodSupply < 0) this.foodSupply = 0;
        
        // Track feeding consistency
        if (this.foodPieces.length === 0 && !this.autoFeed) {
            this.daysWithoutFeeding += deltaTime;
            this.consecutiveDaysFed = 0;
        }
    }
    
    initiateAttack(attackerColony, reason = 'unknown') {
        // Find potential target colonies (not self)
        const targets = Object.values(this.colonies).filter(c => c !== attackerColony && c.population > 5);
        if (targets.length === 0) return;
        
        // For confidence/dominance attacks, target the weakest
        let targetColony;
        if (reason === 'dominance') {
            targetColony = targets.reduce((min, c) => c.confidence < min.confidence ? c : min, targets[0]);
        } else {
            // Random target for other attack types
            targetColony = targets[Math.floor(Math.random() * targets.length)];
        }
        
        // Send 20-40% of population to attack
        const attackForce = Math.floor(attackerColony.population * (0.2 + Math.random() * 0.2));
        
        if (attackForce < 5) return; // Need at least 5 soldiers
        
        // Create war party
        const warParty = [];
        for (let i = 0; i < attackForce && attackerColony.mobiles.length > 0; i++) {
            const mobile = attackerColony.mobiles.pop();
            if (mobile) {
                mobile.activity = 'attacking';
                mobile.target = targetColony;
                mobile.warParty = true;
                warParty.push(mobile);
            }
        }
        
        attackerColony.population -= attackForce;
        attackerColony.lastAttackDay = this.gameDay;
        
        // Create battle tracker
        this.battles.push({
            attacker: attackerColony,
            defender: targetColony,
            attackers: warParty,
            defenders: [],
            startTime: Date.now(),
            phase: 'marching' // marching, fighting, retreating
        });
        
        this.playAttackSound();
        const reasonText = {
            desperation: 'out of desperation',
            anger: 'in a rage',
            dominance: 'to assert dominance',
            territorial: 'defending territory',
            raid: 'to steal food'
        }[reason] || '';
        this.addEvent(`${attackerColony.color.toUpperCase()} colony launches attack on ${targetColony.color.toUpperCase()} ${reasonText}!`, 'danger');
    }
    
    updateNarrative(deltaTime) {
        // Add atmospheric commentary periodically
        this.lastCommentTime += deltaTime;
        
        if (this.lastCommentTime < this.commentCooldown) return;
        
        // Reset timer
        this.lastCommentTime = 0;
        
        // Check game state and add appropriate commentary
        const colonies = Object.values(this.colonies);
        const avgHostility = colonies.reduce((sum, c) => sum + c.hostility, 0) / 4;
        const avgHunger = colonies.reduce((sum, c) => sum + c.hunger, 0) / 4;
        const avgConfidence = colonies.reduce((sum, c) => sum + c.confidence, 0) / 4;
        const totalPop = colonies.reduce((sum, c) => sum + c.population, 0);
        const activeBattles = this.battles.length;
        
        let comments = [];
        
        // Confidence-based observations
        const mostConfident = colonies.reduce((max, c) => c.confidence > max.confidence ? c : max, colonies[0]);
        const leastConfident = colonies.reduce((min, c) => c.confidence < min.confidence ? c : min, colonies[0]);
        
        if (mostConfident.confidence > 80 && leastConfident.confidence < 30) {
            comments.push(
                `The ${mostConfident.color} colony has grown bold. Dominant.`,
                `${mostConfident.color.toUpperCase()} swaggers while ${leastConfident.color} cowers.`,
                `One colony thrives, another fears. Natural selection at work.`
            );
        } else if (avgConfidence > 70) {
            comments.push(
                "They're all feeling confident now. This could get interesting.",
                "Bold colonies make for aggressive wars."
            );
        }
        
        // Spider-related observations
        if (this.spider) {
            comments.push(
                "The colonies have put aside their differences. Remarkable.",
                "Even insects understand the value of alliance against greater threats.",
                "Watch how they coordinate. There's intelligence here.",
                "The creature is formidable, but numbers may prevail."
            );
        }
        
        // Battle observations
        if (activeBattles > 0) {
            comments.push(
                "The wars have begun. They're magnificent in their savagery.",
                "See how they march? Like tiny armies.",
                "This is better than any entertainment system.",
                "The castles grow more elaborate with each victory."
            );
        }
        
        // High hostility observations
        if (avgHostility > 70 && !this.spider) {
            comments.push(
                "They're becoming aggressive. Perhaps I've been neglecting them.",
                "The faces in the castles have changed. More grotesque now.",
                "Their behavior is shifting. This could be dangerous.",
                "I should have fed them more regularly."
            );
        }
        
        // Peaceful/well-fed observations
        if (avgHunger < 30 && avgHostility < 30) {
            comments.push(
                "They're content. See how the faces smile?",
                "My guests would be fascinated by their castle-building.",
                "The detail in their architecture is extraordinary.",
                "Such beautiful creatures when properly maintained."
            );
        }
        
        // Starvation concerns
        if (avgHunger > 75) {
            comments.push(
                "They're starving. I need to feed them soon.",
                "Hunger makes them unpredictable. And bold.",
                "The faces are twisted with rage now.",
                "This is getting out of hand."
            );
        }
        
        // Population observations
        if (totalPop > 150) {
            comments.push(
                "Their numbers are growing rapidly.",
                "The colonies are thriving. Perhaps too well.",
                "They're multiplying faster than I expected."
            );
        } else if (totalPop < 50) {
            comments.push(
                "The population is declining. Troubling.",
                "So few left. The wars have taken their toll.",
                "I may have let this go too far."
            );
        }
        
        // Castle building observations
        if (this.gameDay > 30) {
            comments.push(
                "The castles are taking shape beautifully.",
                "They carve my face into the stone. Or something like it.",
                "Each colony's architecture reflects its character."
            );
        }
        
        // Early game observations
        if (this.gameDay < 20 && comments.length === 0) {
            comments.push(
                "The colonies are establishing themselves.",
                "They're so small now. Hard to believe what they'll become.",
                "Each color represents a different hive mind."
            );
        }
        
        // Select random comment from applicable ones
        if (comments.length > 0) {
            const comment = comments[Math.floor(Math.random() * comments.length)];
            this.addEvent(`💭 ${comment}`, 'info');
        }
    }
    
    updateSpider(deltaTime) {
        if (!this.spider) return;
        
        const spider = this.spider;
        
        // Don't move or attack while falling
        if (spider.falling) return;
        
        // Spider moves and attacks
        if (!spider.target || spider.target.length === 0) {
            // Find nearest colony to attack
            let nearest = null;
            let minDist = Infinity;
            Object.values(this.colonies).forEach(colony => {
                const dx = colony.castleX - spider.x;
                const dy = colony.castleY - spider.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = colony;
                }
            });
            
            if (nearest) {
                const dx = nearest.castleX - spider.x;
                const dy = nearest.castleY - spider.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    spider.vx = (dx / dist) * 1.5;
                    spider.vy = (dy / dist) * 1.5;
                }
            }
        }
        
        // Apply movement
        spider.x += spider.vx * deltaTime * 60;
        spider.y += spider.vy * deltaTime * 60;
        spider.vx *= 0.95;
        spider.vy *= 0.95;
        
        // Spider damages nearby castle walls
        Object.values(this.colonies).forEach(colony => {
            const dx = colony.castleX - spider.x;
            const dy = colony.castleY - spider.y;
            const distToCastle = Math.sqrt(dx * dx + dy * dy);
            
            // If spider is close to castle, damage it
            if (distToCastle < 40) {
                // Slowly reduce building progress (0.5% per second when close)
                colony.buildingProgress = Math.max(0, colony.buildingProgress - deltaTime * 0.5);
                
                // Visual feedback occasionally
                if (Math.random() < 0.01) {
                    this.addEvent(`${spider.name} is destroying ${colony.color} colony walls!`, 'danger');
                }
            }
        });
        
        // All colonies send forces to fight spider (COOPERATIVE BEHAVIOR)
        Object.values(this.colonies).forEach(colony => {
            if (!colony.spiderThreat) return;
            
            // Send mobiles to attack spider
            colony.mobiles.forEach(mobile => {
                if (mobile.activity !== 'fighting_spider' && Math.random() < 0.02) {
                    mobile.activity = 'fighting_spider';
                    mobile.target = spider;
                }
            });
        });
        
        // Check for sandking attacks on spider
        let attackersNearby = 0;
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                if (mobile.activity === 'fighting_spider') {
                    const dx = spider.x - mobile.x;
                    const dy = spider.y - mobile.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Track time near spider
                    if (!mobile.timeNearSpider) mobile.timeNearSpider = 0;
                    
                    if (dist < 25) {
                        attackersNearby++;
                        mobile.timeNearSpider += deltaTime;
                        
                        // Damage spider (now harder to damage)
                        if (Math.random() < 0.03) {
                            spider.health -= 1.5;
                        }
                        
                        // Spider repels sandkings that stay too close for too long
                        if (dist < 15 && mobile.timeNearSpider > 2 && Math.random() < 0.15) {
                            const repelAngle = Math.atan2(mobile.y - spider.y, mobile.x - spider.x);
                            const repelForce = 8 + Math.random() * 4; // Strong knockback
                            mobile.vx = Math.cos(repelAngle) * repelForce;
                            mobile.vy = Math.sin(repelAngle) * repelForce;
                            mobile.timeNearSpider = 0; // Reset timer
                            
                            // Visual feedback via event log occasionally
                            if (Math.random() < 0.3) {
                                this.addEvent(`${spider.name} flings attackers away!`, 'warning');
                            }
                        }
                    } else {
                        // Reset timer if not close
                        mobile.timeNearSpider = 0;
                    }
                    
                    // Spider kills sandkings more frequently
                    if (dist < 10 && Math.random() < 0.08) {
                        const index = colony.mobiles.indexOf(mobile);
                        if (index > -1) {
                            colony.mobiles.splice(index, 1);
                            colony.population--;
                        }
                    }
                }
            });
        });
        
        // Spider is defeated
        if (spider.health <= 0) {
            this.addEvent('SPIDER DEFEATED! The colonies feast on its remains!', 'info');
            
            // Create spider pieces for sandkings to carry back
            const pieceCount = 8;
            for (let i = 0; i < pieceCount; i++) {
                const angle = (Math.PI * 2 * i) / pieceCount;
                const dist = 20;
                this.spiderPieces.push({
                    x: spider.x + Math.cos(angle) * dist,
                    y: spider.y + Math.sin(angle) * dist,
                    claimed: false,
                    carrier: null
                });
            }
            
            this.spider = null;
            
            // Clear spider threat status
            Object.values(this.colonies).forEach(colony => {
                colony.spiderThreat = false;
            });
        }
    }
    
    updateSpiderPieces(deltaTime) {
        this.spiderPieces = this.spiderPieces.filter(piece => {
            if (!piece.claimed) {
                // Find nearest sandking to claim piece
                Object.values(this.colonies).forEach(colony => {
                    colony.mobiles.forEach(mobile => {
                        if (mobile.activity === 'fighting_spider' || mobile.activity === 'wandering') {
                            const dx = piece.x - mobile.x;
                            const dy = piece.y - mobile.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist < 5 && !mobile.carryingSpiderPiece) {
                                piece.claimed = true;
                                piece.carrier = mobile;
                                mobile.carryingSpiderPiece = true;
                                mobile.spiderPiece = piece;
                                mobile.activity = 'carrying_spider_piece';
                                mobile.target = colony;
                            }
                        }
                    });
                });
            } else if (piece.carrier) {
                // Move piece with carrier
                piece.x = piece.carrier.x;
                piece.y = piece.carrier.y;
                
                // Check if carrier reached home
                if (piece.carrier.target) {
                    const dx = piece.carrier.target.castleX - piece.x;
                    const dy = piece.carrier.target.castleY - piece.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 15) {
                        // Delivered! Feed the colony
                        piece.carrier.target.hunger = Math.max(0, piece.carrier.target.hunger - 15);
                        piece.carrier.carryingSpiderPiece = false;
                        piece.carrier.spiderPiece = null;
                        piece.carrier.activity = 'wandering';
                        piece.carrier.target = null;
                        return false; // Remove piece
                    }
                }
            }
            
            return true; // Keep piece
        });
    }
    
    updateBattles(deltaTime) {
        this.battles = this.battles.filter(battle => {
            const { attacker, defender, attackers, defenders, phase } = battle;
            
            if (phase === 'marching') {
                // Move attackers toward target
                let reachedTarget = 0;
                attackers.forEach(mobile => {
                    const dx = defender.castleX - mobile.x;
                    const dy = defender.castleY - mobile.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 30) {
                        reachedTarget++;
                    } else {
                        mobile.vx = (dx / dist) * 2;
                        mobile.vy = (dy / dist) * 2;
                        mobile.x += mobile.vx * deltaTime * 60;
                        mobile.y += mobile.vy * deltaTime * 60;
                    }
                });
                
                // When majority reach target, start fighting
                if (reachedTarget > attackers.length * 0.5) {
                    battle.phase = 'fighting';
                    
                    // Set active fight location for magnifier
                    if (this.highlightFights) {
                        this.activeFightLocation = {
                            x: defender.castleX,
                            y: defender.castleY,
                            type: 'battle'
                        };
                    }
                    
                    // Defenders mobilize (30-50% of population)
                    const defenseForce = Math.floor(defender.population * (0.3 + Math.random() * 0.2));
                    for (let i = 0; i < defenseForce && defender.mobiles.length > 0; i++) {
                        const mobile = defender.mobiles.pop();
                        if (mobile) {
                            mobile.activity = 'defending';
                            mobile.warParty = true;
                            defenders.push(mobile);
                        }
                    }
                    defender.population -= defenseForce;
                    battle.defenders = defenders;
                    
                    this.addEvent(`Battle rages at ${defender.color.toUpperCase()} castle!`, 'danger');
                }
            } else if (phase === 'fighting') {
                // Combat simulation
                const fightDuration = (Date.now() - battle.startTime) / 1000;
                
                // Make fighters swarm around each other
                attackers.forEach(attacker => {
                    // Find nearest defender
                    let nearest = null;
                    let minDist = Infinity;
                    defenders.forEach(def => {
                        const dx = def.x - attacker.x;
                        const dy = def.y - attacker.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = def;
                        }
                    });
                    
                    if (nearest && minDist > 3) {
                        const dx = nearest.x - attacker.x;
                        const dy = nearest.y - attacker.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        attacker.vx = (dx / dist) * 2;
                        attacker.vy = (dy / dist) * 2;
                        attacker.x += attacker.vx * deltaTime * 60;
                        attacker.y += attacker.vy * deltaTime * 60;
                    }
                });
                
                defenders.forEach(defender => {
                    // Defenders swarm attackers
                    let nearest = null;
                    let minDist = Infinity;
                    attackers.forEach(att => {
                        const dx = att.x - defender.x;
                        const dy = att.y - defender.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = att;
                        }
                    });
                    
                    if (nearest && minDist > 3) {
                        const dx = nearest.x - defender.x;
                        const dy = nearest.y - defender.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        defender.vx = (dx / dist) * 2;
                        defender.vy = (dy / dist) * 2;
                        defender.x += defender.vx * deltaTime * 60;
                        defender.y += defender.vy * deltaTime * 60;
                    }
                });
                
                // Casualties on both sides
                if (Math.random() < 0.2 && attackers.length > 0) {
                    const casualty = attackers.pop();
                    // Visual feedback - particle effect handled in render
                }
                if (Math.random() < 0.18 && defenders.length > 0) {
                    const casualty = defenders.pop();
                }
                
                // Battle lasts 3-5 seconds, then survivors return
                if (fightDuration > 3 || attackers.length === 0 || defenders.length === 0) {
                    battle.phase = 'retreating';
                    
                    // Determine victor and spoils
                    const attackerVictory = attackers.length > defenders.length;
                    const survivors = attackerVictory ? attackers : defenders;
                    const casualties = attackerVictory ? defenders.length : attackers.length;
                    
                    if (attackerVictory && casualties > 0) {
                        // Attackers won - they bring back defeated enemies as food
                        const foodGained = casualties * 2;
                        attacker.hunger = Math.max(0, attacker.hunger - foodGained);
                        
                        // Some survivors carry corpses back
                        const corpseBearers = Math.min(survivors.length, casualties);
                        for (let i = 0; i < corpseBearers; i++) {
                            if (survivors[i]) {
                                survivors[i].carryingFood = true;
                            }
                        }
                        
                        this.addEvent(`${attacker.color.toUpperCase()} victory! ${casualties} ${defender.color} corpses dragged back as food.`, 'warning');
                    } else if (!attackerVictory && casualties > 0) {
                        // Defenders won
                        defender.hunger = Math.max(0, defender.hunger - casualties * 2);
                        this.addEvent(`${defender.color.toUpperCase()} repels the attack! ${casualties} attackers killed.`, 'info');
                    }
                    
                    // Return survivors to their colonies
                    survivors.forEach(mobile => {
                        mobile.activity = 'wandering';
                        mobile.warParty = false;
                        mobile.target = null;
                        
                        if (attackerVictory) {
                            attacker.mobiles.push(mobile);
                            attacker.population++;
                        } else {
                            defender.mobiles.push(mobile);
                            defender.population++;
                        }
                    });
                    
                    // Battle ends - clear fight location
                    if (this.activeFightLocation && this.activeFightLocation.type === 'battle') {
                        this.activeFightLocation = null;
                    }
                    return false;
                }
            }
            
            return true; // Keep battle active
        });
        
        // Clear fight location if no battles active
        if (this.battles.length === 0 && this.activeFightLocation && this.activeFightLocation.type === 'battle') {
            this.activeFightLocation = null;
        }
    }
    
    updateFoodPieces(deltaTime) {
        this.foodPieces = this.foodPieces.filter(food => {
            // Don't allow swarming on falling items
            if (food.falling) return true;
            
            // All colonies can compete for food (not just nearest)
            Object.values(this.colonies).forEach(colony => {
                const dx = colony.castleX - food.x;
                const dy = colony.castleY - food.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Send mobiles if food is within reasonable range
                if (dist < 400) {
                    // Higher priority for treats targeted at this colony
                    const seekChance = (food.targetColony === colony) ? 0.7 : 0.35; // Increased from 0.5/0.2
                    
                    colony.mobiles.forEach(mobile => {
                        if (!mobile.carryingFood && 
                            mobile.activity !== 'fighting_spider' && 
                            mobile.activity !== 'chasing_intruder' &&
                            !mobile.warParty &&
                            Math.random() < seekChance) {
                            mobile.activity = 'seeking_food';
                            mobile.target = food;
                        }
                    });
                }
            });
            
            // Check for conflicts at food location
            const seekersAtFood = [];
            Object.values(this.colonies).forEach(colony => {
                colony.mobiles.forEach(mobile => {
                    if (mobile.target === food && mobile.activity === 'seeking_food') {
                        const dx = mobile.x - food.x;
                        const dy = mobile.y - food.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist < 20) {
                            seekersAtFood.push({ mobile, colony, dist });
                        }
                    }
                });
            });
            
            // Check for conflicts between different colonies at the food
            if (seekersAtFood.length > 1) {
                for (let i = 0; i < seekersAtFood.length; i++) {
                    for (let j = i + 1; j < seekersAtFood.length; j++) {
                        const seeker1 = seekersAtFood[i];
                        const seeker2 = seekersAtFood[j];
                        
                        // Different colonies
                        if (seeker1.colony !== seeker2.colony) {
                            const dx = seeker1.mobile.x - seeker2.mobile.x;
                            const dy = seeker1.mobile.y - seeker2.mobile.y;
                            const distBetween = Math.sqrt(dx * dx + dy * dy);
                            
                            // Close enough to interact
                            if (distBetween < 8) {
                                // Set active fight location for magnifier
                                if (this.highlightFights && (seeker1.colony.hostility > 40 || seeker2.colony.hostility > 40)) {
                                    this.activeFightLocation = {
                                        x: food.x,
                                        y: food.y,
                                        type: 'food-conflict'
                                    };
                                }
                                
                                // If either colony is hostile, they fight
                                if (seeker1.colony.hostility > 40 || seeker2.colony.hostility > 40) { // Lowered from 50
                                    // Combat! Higher chance of casualties
                                    if (Math.random() < 0.25) { // Increased from 0.1
                                        const loser = Math.random() < 0.5 ? seeker1 : seeker2;
                                        const winner = loser === seeker1 ? seeker2 : seeker1;
                                        
                                        const loserIndex = loser.colony.mobiles.indexOf(loser.mobile);
                                        if (loserIndex > -1) {
                                            loser.colony.mobiles.splice(loserIndex, 1);
                                            loser.colony.population--;
                                            
                                            // Winner drags corpse back as food
                                            winner.mobile.carryingFood = true;
                                            winner.mobile.activity = 'carrying_food';
                                            winner.mobile.target = winner.colony;
                                            winner.colony.hunger = Math.max(0, winner.colony.hunger - 3);
                                            
                                            this.addEvent(`${winner.colony.color} killed ${loser.colony.color} over food and drags corpse back!`, 'danger');
                                        }
                                    }
                                } else {
                                    // Not hostile, just push each other away
                                    const pushForce = 3;
                                    seeker1.mobile.vx += (dx / distBetween) * pushForce;
                                    seeker1.mobile.vy += (dy / distBetween) * pushForce;
                                    seeker2.mobile.vx -= (dx / distBetween) * pushForce;
                                    seeker2.mobile.vy -= (dy / distBetween) * pushForce;
                                }
                            }
                        }
                    }
                }
            }
            
            // Check if any mobile has reached the food and picks it up
            Object.values(this.colonies).forEach(colony => {
                colony.mobiles.forEach(mobile => {
                    if (mobile.target === food && mobile.activity === 'seeking_food') {
                        const dx = mobile.x - food.x;
                        const dy = mobile.y - food.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist < 8) {
                            // If live food is still alive, damage it first
                            if (food.isLive && food.alive) {
                                // Count how many mobiles are attacking
                                let attackerCount = 0;
                                Object.values(this.colonies).forEach(c => {
                                    c.mobiles.forEach(m => {
                                        if (m.target === food && m.activity === 'seeking_food') {
                                            const mdx = m.x - food.x;
                                            const mdy = m.y - food.y;
                                            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
                                            if (mdist < 15) attackerCount++;
                                        }
                                    });
                                });
                                
                                // Damage increases with more attackers
                                food.health -= attackerCount * 0.5;
                                
                                // Die when health depleted
                                if (food.health <= 0) {
                                    food.alive = false;
                                    food.vx = 0;
                                    food.vy = 0;
                                    this.addEvent(`Live prey overwhelmed and killed by ${attackerCount} mobiles!`, 'warning');
                                }
                            }
                            
                            // Can only pick up if dead or very close
                            if (!food.isLive || !food.alive) {
                                if (dist < 5) {
                                    // Mobile picks up food
                                    mobile.carryingFood = true;
                                    mobile.activity = 'carrying_food';
                                    mobile.target = colony;
                                    food.amount -= 1;
                                    
                                    // Feed the colony based on food nutrition value
                                    const hungerReduction = (food.nutritionValue || 10) / 20;
                                    colony.hunger = Math.max(0, colony.hunger - hungerReduction);
                                    
                                    // Live food gives excitement bonus (reduces hostility)
                                    if (food.isLive) {
                                        colony.hostility = Math.max(0, colony.hostility - 2);
                                        colony.favoritism += 0.5;
                                    }
                                }
                            }
                        }
                    }
                });
            });
            
            // Remove food if depleted
            if (food.amount <= 0) {
                // Clear any mobiles still targeting this food
                Object.values(this.colonies).forEach(colony => {
                    colony.mobiles.forEach(mobile => {
                        if (mobile.target === food) {
                            mobile.target = null;
                            mobile.activity = 'wandering';
                        }
                    });
                });
                return false; // Remove the food
            }
            return true; // Keep the food
        });
        
        // Clear food conflict fight location if no active conflicts
        if (this.activeFightLocation && this.activeFightLocation.type === 'food-conflict') {
            let hasActiveConflict = false;
            for (const food of this.foodPieces) {
                const seekersNearFood = [];
                Object.values(this.colonies).forEach(colony => {
                    colony.mobiles.forEach(mobile => {
                        if (mobile.target === food && mobile.activity === 'seeking_food') {
                            const dx = mobile.x - food.x;
                            const dy = mobile.y - food.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < 20) seekersNearFood.push(colony);
                        }
                    });
                });
                // Check if different colonies are competing
                const uniqueColonies = new Set(seekersNearFood);
                if (uniqueColonies.size > 1) {
                    hasActiveConflict = true;
                    break;
                }
            }
            if (!hasActiveConflict) {
                this.activeFightLocation = null;
            }
        }
    }
    
    updateMobileMovement(mobile, colony, deltaTime) {
        if (mobile.activity === 'fighting_spider' && mobile.target) {
            // Move toward spider in coordinated formation
            const spider = mobile.target;
            if (!spider || !this.spider) {
                mobile.activity = 'wandering';
                mobile.target = null;
                return;
            }
            
            const dx = spider.x - mobile.x;
            const dy = spider.y - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Form a ring around spider
            if (dist > 20) {
                mobile.vx = (dx / dist) * 2;
                mobile.vy = (dy / dist) * 2;
            } else if (dist < 15) {
                // Too close, back off slightly
                mobile.vx = -(dx / dist) * 0.5;
                mobile.vy = -(dy / dist) * 0.5;
            } else {
                // Circle around
                mobile.vx += dy * 0.05;
                mobile.vy += -dx * 0.05;
            }
        } else if (mobile.activity === 'chasing_intruder' && mobile.target) {
            // Chase intruder (territorial defense)
            const intruder = mobile.target;
            
            // Check if intruder still exists
            const intruderColony = mobile.chasingColony;
            if (!intruderColony || !intruderColony.mobiles.includes(intruder)) {
                mobile.activity = 'wandering';
                mobile.target = null;
                return;
            }
            
            const dx = intruder.x - mobile.x;
            const dy = intruder.y - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Chase the intruder
            if (dist > 5) {
                mobile.vx = (dx / dist) * 1.8;
                mobile.vy = (dy / dist) * 1.8;
            }
            
            // Close enough to interact
            if (dist < 8) {
                // Try to steal food if intruder has it
                if (intruder.carryingFood && !mobile.carryingFood && Math.random() < 0.1) {
                    intruder.carryingFood = false;
                    mobile.carryingFood = true;
                    mobile.activity = 'carrying_food';
                    mobile.target = colony;
                    this.addEvent(`${colony.color} sandking stole food from intruder!`, 'info');
                    return;
                }
                
                // Attack if colony is hostile
                if (colony.hostility > 50 && Math.random() < 0.05) {
                    const intruderIndex = intruderColony.mobiles.indexOf(intruder);
                    if (intruderIndex > -1) {
                        intruderColony.mobiles.splice(intruderIndex, 1);
                        intruderColony.population--;
                        this.addEvent(`${colony.color} colony killed an intruder!`, 'danger');
                        mobile.activity = 'wandering';
                        mobile.target = null;
                    }
                    return;
                }
            }
            
            // Stop chasing if intruder escaped territory
            const dxHome = colony.castleX - intruder.x;
            const dyHome = colony.castleY - intruder.y;
            const distFromTerritory = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
            
            if (distFromTerritory > 120) {
                mobile.activity = 'wandering';
                mobile.target = null;
            }
        } else if (mobile.isIntruder && mobile.intruderTarget) {
            // Intruder tries to flee back home
            const homeColony = mobile.intruderTarget;
            const dx = homeColony.castleX - mobile.x;
            const dy = homeColony.castleY - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Run home
            if (dist > 50) {
                mobile.vx = (dx / dist) * 2;
                mobile.vy = (dy / dist) * 2;
            } else {
                // Made it home safely
                mobile.isIntruder = false;
                mobile.intruderTarget = null;
                mobile.activity = mobile.carryingFood ? 'carrying_food' : 'wandering';
            }
        } else if (mobile.activity === 'carrying_spider_piece' && mobile.target) {
            // Return to castle with spider piece
            const dx = mobile.target.castleX - mobile.x;
            const dy = mobile.target.castleY - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 5) {
                mobile.vx = (dx / dist) * 1.2;
                mobile.vy = (dy / dist) * 1.2;
            }
        } else if (mobile.activity === 'attacking' && mobile.target) {
            // Move aggressively toward target castle
            const dx = mobile.target.castleX - mobile.x;
            const dy = mobile.target.castleY - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 5) {
                mobile.vx = (dx / dist) * 2.5; // Faster movement during attack
                mobile.vy = (dy / dist) * 2.5;
            }
        } else if (mobile.activity === 'defending' && mobile.target) {
            // Defenders engage attackers
            const dx = mobile.target.castleX - mobile.x;
            const dy = mobile.target.castleY - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Move toward battle zone
            if (dist > 20) {
                mobile.vx = (dx / dist) * 2;
                mobile.vy = (dy / dist) * 2;
            } else {
                // Circle around battle zone
                mobile.vx += (Math.random() - 0.5) * 0.5;
                mobile.vy += (Math.random() - 0.5) * 0.5;
            }
        } else if (mobile.activity === 'seeking_food' && mobile.target) {
            // Move toward food
            const dx = mobile.target.x - mobile.x;
            const dy = mobile.target.y - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 5) {
                mobile.vx = (dx / dist) * 1.5;
                mobile.vy = (dy / dist) * 1.5;
            }
        } else if (mobile.activity === 'carrying_food' && mobile.target) {
            // Return to castle
            const dx = mobile.target.castleX - mobile.x;
            const dy = mobile.target.castleY - mobile.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 15) {
                // Reached castle - deliver food
                mobile.carryingFood = false;
                mobile.activity = 'wandering';
                mobile.target = null;
            } else {
                mobile.vx = (dx / dist) * 1.2;
                mobile.vy = (dy / dist) * 1.2;
            }
        } else {
            // Normal wandering behavior near castle
            const dx = colony.castleX - mobile.x;
            const dy = colony.castleY - mobile.y;
            const distToHome = Math.sqrt(dx * dx + dy * dy);
            
            // If agitated, move more erratically and return home more urgently
            if (mobile.agitated) {
                // Urgent return home after panic
                if (distToHome > 80) {
                    mobile.vx += (dx / distToHome) * 0.08; // Stronger pull home
                    mobile.vy += (dy / distToHome) * 0.08;
                } else {
                    // Still panicked, erratic movement
                    mobile.vx += (Math.random() - 0.5) * 0.3;
                    mobile.vy += (Math.random() - 0.5) * 0.3;
                }
            } else {
                // Normal behavior
                // If too far from castle, move back
                if (distToHome > 100) {
                    mobile.vx += (dx / distToHome) * 0.02;
                    mobile.vy += (dy / distToHome) * 0.02;
                } else {
                    // Random wandering
                    mobile.vx += (Math.random() - 0.5) * 0.1;
                    mobile.vy += (Math.random() - 0.5) * 0.1;
                }
            }
        }
        
        // Limit velocity
        const speed = Math.sqrt(mobile.vx * mobile.vx + mobile.vy * mobile.vy);
        const maxSpeed = mobile.carryingFood ? 1.5 : 2;
        if (speed > maxSpeed) {
            mobile.vx = (mobile.vx / speed) * maxSpeed;
            mobile.vy = (mobile.vy / speed) * maxSpeed;
        }
        
        // Check if mobile is in wet spot (acts like mud)
        let inWetSpot = false;
        if (this.wetSpots) {
            for (const spot of this.wetSpots) {
                const dx = mobile.x - spot.x;
                const dy = mobile.y - spot.y;
                const distToSpot = Math.sqrt(dx * dx + dy * dy);
                
                if (distToSpot < spot.radius) {
                    inWetSpot = true;
                    break;
                }
            }
        }
        
        // Apply velocity with agitation-based speed boost and wet spot penalty
        let speedMultiplier = mobile.agitated ? (1.5 + this.agitationLevel / 100) : 1.0;
        if (inWetSpot) {
            speedMultiplier *= 0.5; // 50% speed reduction in wet spots (mud effect)
        }
        mobile.x += mobile.vx * deltaTime * 60 * speedMultiplier;
        mobile.y += mobile.vy * deltaTime * 60 * speedMultiplier;
        
        // Apply friction (stronger when agitated to simulate panic exhaustion, even stronger in wet spots)
        const dragFactor = inWetSpot ? 0.85 : (mobile.agitated ? 0.92 : 0.95);
        mobile.vx *= dragFactor;
        mobile.vy *= dragFactor;
        
        // Keep within canvas bounds
        mobile.x = Math.max(10, Math.min(790, mobile.x));
        mobile.y = Math.max(10, Math.min(590, mobile.y));
    }
    
    updateSafety() {
        // Calculate overall danger level based on:
        // 1. Average hostility of colonies
        // 2. Size of sandkings
        // 3. Population
        
        let avgHostility = 0;
        let avgSize = 0;
        let totalPop = 0;
        
        Object.values(this.colonies).forEach(colony => {
            avgHostility += colony.hostility;
            avgSize += colony.mawSize;
            totalPop += colony.population;
        });
        
        avgHostility /= 4;
        avgSize /= 4;
        
        // Safety calculation
        this.safetyLevel = 100 - (avgHostility * 0.4) - (avgSize * 5) - (totalPop * 0.1);
        this.safetyLevel = Math.max(0, Math.min(100, this.safetyLevel));
        
        // Trigger events based on safety level
        if (this.safetyLevel < 30 && Math.random() < 0.01) {
            this.addEvent('You hear scratching sounds from the tank walls...', 'danger');
        }
        
        if (this.safetyLevel < 15 && Math.random() < 0.005) {
            this.addEvent('The sandkings are growing dangerously large and hostile!', 'danger');
        }
    }
    
    checkGameOver() {
        // Game over conditions
        
        // 1. Sandkings have grown too large and hostile
        if (this.safetyLevel <= 0) {
            this.gameOver('The sandkings have broken free! They overwhelm the house, and you become their next meal. The colonies carve twisted versions of your terrified face into their ever-growing castles.');
            return;
        }
        
        // 2. All colonies died (player wins but it's hollow)
        const totalPopulation = Object.values(this.colonies).reduce((sum, c) => sum + c.population, 0);
        if (totalPopulation === 0) {
            this.gameOver('All the sandkings have perished from neglect. The tank sits empty and silent. You have survived, but at what cost?');
            return;
        }
        
        // 3. Survived for 2 years (730 days) - Victory!
        if (this.gameDay >= 730) {
            this.gameOver('You have survived 2 years with the sandkings! They remain contained, their faces carved in your likeness. You have proven yourself a worthy god to these alien creatures. Victory!', true);
            return;
        }
    }
    
    addEvent(message, type = 'info') {
        const log = document.getElementById('event-log');
        const entry = document.createElement('div');
        entry.className = `event-entry ${type}`;
        entry.textContent = `Day ${Math.floor(this.gameDay)}: ${message}`;
        
        log.insertBefore(entry, log.firstChild);
        
        // Keep only last 20 events
        while (log.children.length > 20) {
            log.removeChild(log.lastChild);
        }
        
        this.events.push({ day: this.gameDay, message, type });
    }
    
    gameOver(message, victory = false) {
        this.gameRunning = false;
        
        const overlay = document.getElementById('game-over-overlay');
        const title = document.getElementById('game-over-title');
        const messageEl = document.getElementById('game-over-message');
        
        title.textContent = victory ? 'VICTORY!' : 'GAME OVER';
        title.style.color = victory ? '#6bcf7f' : '#ff6b6b';
        messageEl.textContent = message;
        
        overlay.classList.remove('hidden');
    }
    
    restart() {
        window.location.reload();
    }
    
    render() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Apply tank shake effect
        if (this.tankShaking && this.shakeIntensity > 0) {
            ctx.save();
            const offsetX = (Math.random() - 0.5) * this.shakeIntensity;
            const offsetY = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(offsetX, offsetY);
        }
        
        // Clear canvas with sandy brown base (darker for contrast)
        ctx.fillStyle = '#5A4A38';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw static sand texture (only if initialized)
        if (this.sandParticles) {
            this.sandParticles.forEach(particle => {
                ctx.fillStyle = particle.color;
                ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
            });
        }
        
        // Draw subtle darker patches for depth (only if initialized)
        if (this.sandPatches) {
            ctx.fillStyle = 'rgba(70, 60, 50, 0.15)';
            this.sandPatches.forEach(patch => {
                ctx.beginPath();
                ctx.moveTo(patch.points[0].x, patch.points[0].y);
                for (let i = 1; i < patch.points.length; i++) {
                    ctx.lineTo(patch.points[i].x, patch.points[i].y);
                }
                ctx.closePath();
                ctx.fill();
            });
        }
        
        // Draw rock veins
        if (this.rockVeins) {
            this.rockVeins.forEach(vein => {
                ctx.strokeStyle = vein.color;
                ctx.lineWidth = vein.thickness;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(vein.x1, vein.y1);
                ctx.lineTo(vein.x2, vein.y2);
                ctx.stroke();
            });
        }
        
        // Draw dark imperfections
        if (this.darkSpots) {
            this.darkSpots.forEach(spot => {
                ctx.fillStyle = `rgba(50, 40, 30, ${spot.opacity})`;
                ctx.beginPath();
                ctx.moveTo(spot.points[0].x, spot.points[0].y);
                for (let i = 1; i < spot.points.length; i++) {
                    ctx.lineTo(spot.points[i].x, spot.points[i].y);
                }
                ctx.closePath();
                ctx.fill();
            });
        }
        
        // Draw sand disturbances (where mobiles have walked)
        if (this.sandDisturbances) {
            this.sandDisturbances = this.sandDisturbances.filter(disturbance => {
                disturbance.opacity *= 0.97; // Fade over time
                
                if (disturbance.opacity > 0.05) {
                    ctx.fillStyle = `rgba(60, 50, 40, ${disturbance.opacity})`;
                    ctx.beginPath();
                    ctx.arc(disturbance.x, disturbance.y, disturbance.radius, 0, Math.PI * 2);
                    ctx.fill();
                    return true;
                }
                return false; // Remove faded disturbances
            });
        }
        
        // Draw wet spots from spray tool
        if (this.wetSpots) {
            this.wetSpots.forEach(spot => {
                const darkenAmount = spot.wetness * 0.6; // Max 60% darker when fully wet
                ctx.fillStyle = `rgba(30, 25, 20, ${darkenAmount})`;
                ctx.beginPath();
                ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        // Draw food pieces
        this.foodPieces.forEach(food => {
            ctx.fillStyle = food.color || '#dd9966';
            
            // Draw falling animation with shadow
            if (food.falling || food.bouncing) {
                const heightOffset = food.falling 
                    ? (1 - food.fallProgress) * 80 
                    : Math.abs(food.bounceVelocity) * 0.05; // Small bounce offset
                
                // Draw shadow (ellipse that grows as item gets closer)
                const shadowSize = food.size * (food.falling ? (1 + food.fallProgress * 0.5) : 1.2);
                const shadowOpacity = food.falling ? (0.2 + food.fallProgress * 0.2) : 0.3;
                ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
                ctx.beginPath();
                ctx.ellipse(food.targetX, food.targetY, shadowSize * 0.8, shadowSize * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw falling/bouncing item at offset position
                ctx.save();
                ctx.translate(food.x, food.y - heightOffset);
                ctx.rotate(food.fallRotation);
                
                ctx.fillStyle = food.color || '#dd9966';
                ctx.fillRect(-food.size / 2, -food.size / 2, food.size, food.size);
                
                // Add glow for special foods
                if (food.type === 'treat' || food.type === 'meat') {
                    ctx.fillStyle = food.color.replace(')', ', 0.3)').replace('rgb', 'rgba');
                    ctx.fillRect(-food.size, -food.size, food.size * 2, food.size * 2);
                }
                
                ctx.restore();
                return;
            }
            
            // Live food moves
            if (food.isLive && food.alive) {
                // Find nearby threats (mobiles hunting it)
                let nearestThreat = null;
                let minThreatDist = Infinity;
                
                Object.values(this.colonies).forEach(colony => {
                    colony.mobiles.forEach(mobile => {
                        if (mobile.target === food && mobile.activity === 'seeking_food') {
                            const dx = mobile.x - food.x;
                            const dy = mobile.y - food.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist < minThreatDist) {
                                minThreatDist = dist;
                                nearestThreat = { x: mobile.x, y: mobile.y };
                            }
                        }
                    });
                });
                
                // Flee from nearest threat
                if (nearestThreat && minThreatDist < 80) {
                    const dx = food.x - nearestThreat.x;
                    const dy = food.y - nearestThreat.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Panic movement - faster when closer
                    const panicFactor = 1 + (80 - minThreatDist) / 40;
                    food.vx += (dx / dist) * 0.8 * panicFactor;
                    food.vy += (dy / dist) * 0.8 * panicFactor;
                    
                    // Add erratic movement when panicked
                    food.vx += (Math.random() - 0.5) * 0.5;
                    food.vy += (Math.random() - 0.5) * 0.5;
                } else {
                    // Random wandering when no threats
                    food.vx += (Math.random() - 0.5) * 0.3;
                    food.vy += (Math.random() - 0.5) * 0.3;
                }
                
                // Apply movement with increased speed
                food.x += food.vx;
                food.y += food.vy;
                
                // Damping
                food.vx *= 0.92;
                food.vy *= 0.92;
                
                // Speed limit
                const speed = Math.sqrt(food.vx * food.vx + food.vy * food.vy);
                const maxSpeed = 4;
                if (speed > maxSpeed) {
                    food.vx = (food.vx / speed) * maxSpeed;
                    food.vy = (food.vy / speed) * maxSpeed;
                }
                
                // Bounce off walls with fear
                if (food.x < 15 || food.x > 785) {
                    food.vx *= -0.8;
                    food.x = Math.max(15, Math.min(785, food.x));
                }
                if (food.y < 15 || food.y > 585) {
                    food.vy *= -0.8;
                    food.y = Math.max(15, Math.min(585, food.y));
                }
                
                // Draw as wiggling worm/lizard
                const time = Date.now() / 100;
                const wiggleSpeed = time + (food.x + food.y) * 0.1; // Unique per food
                const length = 12; // Length of the worm/lizard
                const segments = 6; // Number of segments to draw
                
                ctx.strokeStyle = food.color;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Calculate movement direction
                const direction = Math.atan2(food.vy, food.vx);
                
                ctx.beginPath();
                for (let i = 0; i < segments; i++) {
                    const segmentOffset = (i / segments) * length;
                    const wiggle = Math.sin(wiggleSpeed + i * 0.5) * 2;
                    
                    // Calculate position along the body
                    const perpAngle = direction + Math.PI / 2;
                    const x = food.x - Math.cos(direction) * segmentOffset + Math.cos(perpAngle) * wiggle;
                    const y = food.y - Math.sin(direction) * segmentOffset + Math.sin(perpAngle) * wiggle;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                
                // Draw head (slightly larger)
                ctx.fillStyle = food.color;
                ctx.beginPath();
                ctx.arc(food.x, food.y, 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(food.x - food.size / 2, food.y - food.size / 2, food.size, food.size);
            }
            
            // Add glow for special foods
            if (food.type === 'treat' || food.type === 'meat') {
                ctx.fillStyle = food.color.replace(')', ', 0.3)');
                ctx.fillRect(food.x - food.size, food.y - food.size, food.size * 2, food.size * 2);
            }
        });
        
        // Draw each colony
        Object.values(this.colonies).forEach(colony => {
            this.renderColony(colony);
        });
        
        // Draw spider
        if (this.spider) {
            this.renderSpider(this.spider);
        }
        
        // Draw spider pieces
        this.spiderPieces.forEach(piece => {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(piece.x - 3, piece.y - 3, 6, 6);
            if (!piece.claimed) {
                // Pulsing unclaimed pieces
                const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(255, 100, 100, ${pulse * 0.5})`;
                ctx.fillRect(piece.x - 4, piece.y - 4, 8, 8);
            }
        });
        
        // Draw battle effects
        this.battles.forEach(battle => {
            const time = (Date.now() - battle.startTime) / 100;
            
            if (battle.phase === 'marching') {
                // Draw arrow showing attack direction
                const startX = battle.attacker.castleX;
                const startY = battle.attacker.castleY;
                const endX = battle.defender.castleX;
                const endY = battle.defender.castleY;
                
                ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(time) * 0.3})`;
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Draw attacking mobiles as they march
                battle.attackers.forEach((mobile, i) => {
                    const size = Math.max(2, Math.floor(mobile.size));
                    // Attacking color with glow
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
                    ctx.fillRect(mobile.x - size, mobile.y - size, size * 2, size * 2);
                    
                    // Pulsing glow
                    ctx.fillStyle = `rgba(255, 50, 50, ${0.3 + Math.sin(time + i * 0.5) * 0.2})`;
                    ctx.fillRect(mobile.x - size - 2, mobile.y - size - 2, size * 2 + 4, size * 2 + 4);
                });
            } else if (battle.phase === 'fighting') {
                // Draw intense battle zone
                const x = battle.defender.castleX;
                const y = battle.defender.castleY;
                
                // Multiple pulsing rings
                for (let i = 0; i < 3; i++) {
                    const offset = i * 15;
                    ctx.strokeStyle = `rgba(255, ${100 - i * 30}, ${100 - i * 30}, ${0.6 - i * 0.2 + Math.sin(time + i) * 0.3})`;
                    ctx.lineWidth = 4 - i;
                    ctx.beginPath();
                    ctx.arc(x, y, 30 + offset + Math.sin(time * 2 + i) * 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                // Draw combat particles
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 * i / 8) + time * 0.5;
                    const radius = 35 + Math.sin(time * 3 + i) * 10;
                    const px = x + Math.cos(angle) * radius;
                    const py = y + Math.sin(angle) * radius;
                    ctx.fillStyle = `rgba(255, 200, 0, ${0.6 + Math.sin(time * 4 + i) * 0.4})`;
                    ctx.fillRect(px - 2, py - 2, 4, 4);
                }
                
                // Draw attackers (red with aggressive indicators)
                battle.attackers.forEach((mobile, i) => {
                    const size = Math.max(2, Math.floor(mobile.size));
                    
                    // Aggressive red color
                    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
                    ctx.fillRect(mobile.x - size, mobile.y - size, size * 2, size * 2);
                    
                    // Add "angry" visual
                    ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
                    ctx.fillRect(mobile.x - size - 1, mobile.y - size - 2, 2, 2);
                    ctx.fillRect(mobile.x + size - 1, mobile.y - size - 2, 2, 2);
                });
                
                // Draw defenders (blue with defensive stance)
                battle.defenders.forEach((mobile, i) => {
                    const size = Math.max(2, Math.floor(mobile.size));
                    
                    // Defensive blue color
                    ctx.fillStyle = 'rgba(50, 100, 255, 1)';
                    ctx.fillRect(mobile.x - size, mobile.y - size, size * 2, size * 2);
                    
                    // Add shield visual
                    ctx.strokeStyle = 'rgba(100, 150, 255, 0.9)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(mobile.x - size - 1, mobile.y - size - 1, size * 2 + 2, size * 2 + 2);
                });
                
                // Show combat stats
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = '8px monospace';
                ctx.fillText(`⚔️ ${battle.attackers.length} vs ${battle.defenders.length}`, x - 30, y - 50);
            }
        });
        
        // Draw drag preview for tools
        if (this.isDragging && (this.currentTool === 'feed' || this.currentTool === 'treat')) {
            ctx.strokeStyle = '#ffdd66';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.dragStartX, this.dragStartY);
            ctx.lineTo(this.dragCurrentX, this.dragCurrentY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Preview where food will land
            ctx.fillStyle = 'rgba(255, 221, 102, 0.5)';
            ctx.fillRect(this.dragCurrentX - 5, this.dragCurrentY - 5, 10, 10);
        }
        
        // Draw lighting effect (red glow)
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        gradient.addColorStop(0, 'rgba(50, 10, 10, 0)');
        gradient.addColorStop(1, 'rgba(20, 5, 5, 0.5)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Restore context if shake was applied
        if (this.tankShaking && this.shakeIntensity > 0) {
            ctx.restore();
        }
        
        // Draw magnifier overlay (always after main render)
        this.renderMagnifier();
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        // Calculate distance from point (px, py) to line segment (x1,y1)-(x2,y2)
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            // Line segment is actually a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }
        
        // Calculate projection of point onto line segment
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t)); // Clamp to segment
        
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }
    
    renderMagnifier() {
        if (!this.highlightFights || !this.activeFightLocation) {
            this.magnifierOverlay.classList.add('hidden');
            return;
        }
        
        // Show magnifier overlay
        this.magnifierOverlay.classList.remove('hidden');
        
        const magCtx = this.magnifierCtx;
        const magCanvas = this.magnifierCanvas;
        const zoom = 2.5; // Magnification level
        const viewSize = 300 / zoom; // Area to capture (120x120 at 2.5x zoom)
        
        const centerX = this.activeFightLocation.x;
        const centerY = this.activeFightLocation.y;
        
        // Clear magnifier canvas
        magCtx.fillStyle = '#5A4A38';
        magCtx.fillRect(0, 0, magCanvas.width, magCanvas.height);
        
        // Calculate source rectangle (area to magnify from main canvas)
        const srcX = centerX - viewSize / 2;
        const srcY = centerY - viewSize / 2;
        
        // Save state and set up zoom
        magCtx.save();
        magCtx.translate(magCanvas.width / 2, magCanvas.height / 2);
        magCtx.scale(zoom, zoom);
        magCtx.translate(-centerX, -centerY);
        
        // Draw sand texture in magnified area
        if (this.sandParticles) {
            this.sandParticles.forEach(particle => {
                if (particle.x >= srcX && particle.x <= srcX + viewSize &&
                    particle.y >= srcY && particle.y <= srcY + viewSize) {
                    magCtx.fillStyle = particle.color;
                    magCtx.fillRect(particle.x, particle.y, particle.size, particle.size);
                }
            });
        }
        
        // Draw relevant game elements in magnified view
        // Food pieces in view
        this.foodPieces.forEach(food => {
            if (Math.abs(food.x - centerX) < viewSize && Math.abs(food.y - centerY) < viewSize) {
                magCtx.fillStyle = food.color || '#dd9966';
                magCtx.beginPath();
                magCtx.arc(food.x, food.y, 4, 0, Math.PI * 2);
                magCtx.fill();
            }
        });
        
        // Mobiles in combat
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                if (Math.abs(mobile.x - centerX) < viewSize && Math.abs(mobile.y - centerY) < viewSize) {
                    const size = Math.max(2, Math.floor(mobile.size));
                    
                    // Draw with glow if fighting
                    if (mobile.activity === 'seeking_food' || mobile.warParty) {
                        magCtx.fillStyle = `rgba(255, 100, 100, 0.4)`;
                        magCtx.fillRect(mobile.x - size - 2, mobile.y - size - 2, size * 2 + 4, size * 2 + 4);
                    }
                    
                    magCtx.fillStyle = colony.color;
                    magCtx.fillRect(mobile.x - size, mobile.y - size, size * 2, size * 2);
                    
                    // Carrying food indicator
                    if (mobile.carryingFood) {
                        magCtx.fillStyle = '#dd9966';
                        magCtx.fillRect(mobile.x - 1, mobile.y - size - 3, 2, 2);
                    }
                }
            });
        });
        
        magCtx.restore();
        
        // Draw crosshair at center
        magCtx.strokeStyle = 'rgba(78, 205, 196, 0.6)';
        magCtx.lineWidth = 1;
        magCtx.beginPath();
        magCtx.moveTo(magCanvas.width / 2 - 10, magCanvas.height / 2);
        magCtx.lineTo(magCanvas.width / 2 + 10, magCanvas.height / 2);
        magCtx.moveTo(magCanvas.width / 2, magCanvas.height / 2 - 10);
        magCtx.lineTo(magCanvas.width / 2, magCanvas.height / 2 + 10);
        magCtx.stroke();
    }
    
    generateSandTexture() {
        // Generate static sand texture once per game (unique each time)
        const sandColors = ['#6B5449', '#705A4B', '#5A4236', '#5A4540', '#6A5040'];
        
        this.sandParticles = [];
        for (let i = 0; i < 400; i++) {
            this.sandParticles.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                size: Math.random() < 0.7 ? 1 : 2,
                color: sandColors[Math.floor(Math.random() * sandColors.length)]
            });
        }
        
        this.sandPatches = [];
        for (let i = 0; i < 30; i++) {
            // Create irregular polygon patches
            const centerX = Math.random() * 800;
            const centerY = Math.random() * 600;
            const size = 10 + Math.random() * 30;
            const points = [];
            const numPoints = 5 + Math.floor(Math.random() * 4); // 5-8 points
            
            for (let p = 0; p < numPoints; p++) {
                const angle = (Math.PI * 2 * p / numPoints) + (Math.random() - 0.5) * 0.8;
                const distance = size * (0.6 + Math.random() * 0.4); // Vary distance
                points.push({
                    x: centerX + Math.cos(angle) * distance,
                    y: centerY + Math.sin(angle) * distance
                });
            }
            
            this.sandPatches.push({ points });
        }
        
        // Add rock veins (random lines across the sand)
        this.rockVeins = [];
        const veinCount = 3 + Math.floor(Math.random() * 4); // 3-6 veins
        for (let i = 0; i < veinCount; i++) {
            const startX = Math.random() * 800;
            const startY = Math.random() * 600;
            const angle = Math.random() * Math.PI * 2;
            const length = 50 + Math.random() * 150;
            const thickness = 2 + Math.random() * 4;
            
            this.rockVeins.push({
                x1: startX,
                y1: startY,
                x2: startX + Math.cos(angle) * length,
                y2: startY + Math.sin(angle) * length,
                thickness: thickness,
                color: '#5A4A3A' // Dark brown rock
            });
        }
        
        // Add dark imperfections/spots (irregular shapes)
        this.darkSpots = [];
        const spotCount = 10 + Math.floor(Math.random() * 15); // 10-24 spots
        for (let i = 0; i < spotCount; i++) {
            const centerX = Math.random() * 800;
            const centerY = Math.random() * 600;
            const size = 5 + Math.random() * 15;
            const points = [];
            const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
            
            for (let p = 0; p < numPoints; p++) {
                const angle = (Math.PI * 2 * p / numPoints) + (Math.random() - 0.5) * 1.0;
                const distance = size * (0.5 + Math.random() * 0.5);
                points.push({
                    x: centerX + Math.cos(angle) * distance,
                    y: centerY + Math.sin(angle) * distance
                });
            }
            
            this.darkSpots.push({
                points,
                opacity: 0.2 + Math.random() * 0.3
            });
        }
        
        // Track sand disturbances (where mobiles walk)
        this.sandDisturbances = [];
    }
    
    renderSpider(spider) {
        const ctx = this.ctx;
        const time = Date.now() / 100;
        
        // Draw falling animation with shadow
        if (spider.falling || spider.bouncing) {
            const heightOffset = spider.falling 
                ? (1 - spider.fallProgress) * 80 
                : Math.abs(spider.bounceVelocity) * 0.05;
            
            // Draw shadow (ellipse that grows as spider gets closer)
            const shadowSize = spider.size * (spider.falling ? (1 + spider.fallProgress * 0.5) : 1.2);
            const shadowOpacity = spider.falling ? (0.3 + spider.fallProgress * 0.3) : 0.4;
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
            ctx.beginPath();
            ctx.ellipse(spider.targetX, spider.targetY, shadowSize * 0.9, shadowSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw falling spider at offset position
            ctx.save();
            ctx.translate(spider.x, spider.y - heightOffset);
            ctx.rotate(spider.fallRotation);
            
            // Spider body
            ctx.fillStyle = '#654321';
            ctx.fillRect(-spider.size / 2, -spider.size / 2, spider.size, spider.size);
            
            // Spider legs (8 legs) - simpler during fall
            ctx.strokeStyle = '#543210';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i / 8);
                const legLength = spider.size + 8;
                const startX = Math.cos(angle) * spider.size / 2;
                const startY = Math.sin(angle) * spider.size / 2;
                const endX = Math.cos(angle) * legLength;
                const endY = Math.sin(angle) * legLength;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            
            ctx.restore();
            return;
        }
        
        // Spider body
        ctx.fillStyle = '#654321';
        ctx.fillRect(spider.x - spider.size / 2, spider.y - spider.size / 2, spider.size, spider.size);
        
        // Spider legs (8 legs)
        ctx.strokeStyle = '#543210';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) + Math.sin(time + i) * 0.2;
            const legLength = spider.size + 10;
            const startX = spider.x + Math.cos(angle) * spider.size / 2;
            const startY = spider.y + Math.sin(angle) * spider.size / 2;
            const endX = spider.x + Math.cos(angle) * legLength;
            const endY = spider.y + Math.sin(angle) * legLength;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        
        // Danger aura
        const auraPulse = Math.sin(time) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(200, 0, 0, ${auraPulse * 0.6})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(spider.x, spider.y, spider.size + 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // Health bar
        const barWidth = 30;
        const barHeight = 4;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(spider.x - barWidth / 2, spider.y - spider.size - 10, barWidth, barHeight);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(spider.x - barWidth / 2, spider.y - spider.size - 10, barWidth * (spider.health / spider.maxHealth), barHeight);
        
        // Show attacking sandkings forming coordinated ring
        let attackerCount = 0;
        Object.values(this.colonies).forEach(colony => {
            colony.mobiles.forEach(mobile => {
                if (mobile.activity === 'fighting_spider') {
                    attackerCount++;
                    const dx = spider.x - mobile.x;
                    const dy = spider.y - mobile.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Draw attack lines when close
                    if (dist < 25) {
                        ctx.strokeStyle = 'rgba(255, 200, 0, 0.3)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(mobile.x, mobile.y);
                        ctx.lineTo(spider.x, spider.y);
                        ctx.stroke();
                    }
                }
            });
        });
        
        // Show spider name and attacker count
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px monospace';
        ctx.fillText(`${spider.name}`, spider.x - 20, spider.y - spider.size - 30);
        
        if (attackerCount > 0) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
            ctx.fillText(`⚔️ ${attackerCount}`, spider.x - 15, spider.y - spider.size - 20);
        }
    }
    
    renderColony(colony) {
        const ctx = this.ctx;
        const colorMap = {
            red: '#ff4444',
            white: '#eeeeee',
            black: '#2a2a2a',  // Dark gray instead of pure black to reduce harsh contrast
            orange: '#ff9944'
        };
        const baseColor = colorMap[colony.color];
        
        // Draw castle structure with progressive building
        const buildScale = Math.min(1, colony.buildingProgress / 100);
        
        // Draw walls
        ctx.fillStyle = '#3a2a2a';
        colony.walls.forEach(wall => {
            if (buildScale > 0.2) {
                const scaledW = wall.w * buildScale;
                const scaledH = wall.h * buildScale;
                ctx.fillRect(
                    colony.castleX + wall.x,
                    colony.castleY + wall.y,
                    scaledW,
                    scaledH
                );
                
                // Add color accent
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    colony.castleX + wall.x,
                    colony.castleY + wall.y,
                    scaledW,
                    scaledH
                );
            }
        });
        
        // Draw towers
        colony.towers.forEach((tower, i) => {
            const towerBuild = Math.max(0, (buildScale - 0.3) / 0.7);
            if (towerBuild > 0) {
                const scaledW = tower.w * towerBuild;
                const scaledH = tower.h * towerBuild;
                
                // Tower base
                ctx.fillStyle = '#4a3a3a';
                ctx.fillRect(
                    colony.castleX + tower.x,
                    colony.castleY + tower.y,
                    scaledW,
                    scaledH
                );
                
                // Tower accent
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    colony.castleX + tower.x,
                    colony.castleY + tower.y,
                    scaledW,
                    scaledH
                );
                
                // Tower top detail
                if (buildScale > 0.7) {
                    ctx.fillStyle = baseColor;
                    ctx.fillRect(
                        colony.castleX + tower.x + 1,
                        colony.castleY + tower.y - 2,
                        scaledW - 2,
                        2
                    );
                }
            }
        });
        
        // Draw central keep/gate
        if (buildScale > 0.4) {
            ctx.fillStyle = '#2a1a1a';
            ctx.fillRect(
                colony.castleX - 8,
                colony.castleY - 8,
                16,
                16
            );
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(
                colony.castleX - 8,
                colony.castleY - 8,
                16,
                16
            );
        }
        
        // Draw face carving on main tower (top-left)
        if (colony.faceQuality > 20 && buildScale > 0.6) {
            this.renderFace(colony, baseColor);
        }
        
        // Draw maw location indicator (pulsing)
        const mawPulse = 0.3 + Math.sin(Date.now() / 1000) * 0.1;
        ctx.fillStyle = `rgba(100, 0, 0, ${mawPulse})`;
        ctx.beginPath();
        ctx.arc(colony.castleX, colony.castleY, colony.mawSize * 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Show war preparation indicator
        if (colony.preparingWar) {
            const warPulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(255, 0, 0, ${warPulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(colony.castleX, colony.castleY, 50 + warPulse * 10, 0, Math.PI * 2);
            ctx.stroke();
            
            // Warning symbol
            ctx.fillStyle = `rgba(255, 200, 0, ${warPulse})`;
            ctx.font = '16px monospace';
            ctx.fillText('⚠', colony.castleX - 8, colony.castleY - 60);
        }
        
        // Draw mobiles (skip war party members, they're drawn separately)
        colony.mobiles.forEach(mobile => {
            // Skip if in war party (they're rendered in battle effects)
            if (mobile.warParty) return;
            
            // Check if mobile is over dark area and create disturbance
            if (this.darkSpots && Math.random() < 0.1) {
                this.darkSpots.forEach(spot => {
                    // Simple point-in-polygon test using bounding box approximation
                    const centerX = spot.points.reduce((sum, p) => sum + p.x, 0) / spot.points.length;
                    const centerY = spot.points.reduce((sum, p) => sum + p.y, 0) / spot.points.length;
                    const dx = mobile.x - centerX;
                    const dy = mobile.y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Use rough distance check (fast approximation)
                    if (dist < 15) {
                        // Create sand disturbance
                        this.sandDisturbances.push({
                            x: mobile.x + (Math.random() - 0.5) * 3,
                            y: mobile.y + (Math.random() - 0.5) * 3,
                            radius: 2 + Math.random() * 2,
                            opacity: 0.3
                        });
                    }
                });
            }
            
            // Check rock veins too
            if (this.rockVeins && Math.random() < 0.15) {
                this.rockVeins.forEach(vein => {
                    const distToVein = this.distanceToLineSegment(
                        mobile.x, mobile.y,
                        vein.x1, vein.y1,
                        vein.x2, vein.y2
                    );
                    
                    if (distToVein < vein.thickness + 2) {
                        // Create disturbance on rock vein
                        this.sandDisturbances.push({
                            x: mobile.x + (Math.random() - 0.5) * 4,
                            y: mobile.y + (Math.random() - 0.5) * 4,
                            radius: 1.5 + Math.random() * 1.5,
                            opacity: 0.4
                        });
                    }
                });
            }
            
            const size = Math.max(1, Math.floor(mobile.size));
            let color = baseColor;
            
            // Special rendering for spider fighters
            if (mobile.activity === 'fighting_spider') {
                color = 'rgba(255, 200, 0, 1)'; // Golden color for united force
            }
            
            // Show intruders with warning color
            if (mobile.isIntruder) {
                const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                color = `rgba(255, 100, 100, ${pulse})`; // Pulsing red
            }
            
            // Show chasers with aggressive color
            if (mobile.activity === 'chasing_intruder') {
                color = 'rgba(255, 150, 0, 1)'; // Orange for aggression
            }
            
            ctx.fillStyle = color;
            
            // Draw as a simple pixel when tiny
            if (size < 2) {
                ctx.fillRect(Math.floor(mobile.x), Math.floor(mobile.y), size, size);
            } else {
                // More detailed sprite when larger
                // Body
                ctx.fillRect(
                    Math.floor(mobile.x) - size / 2,
                    Math.floor(mobile.y) - size / 2,
                    size,
                    size
                );
                
                // Add legs if big enough
                if (size >= 4) {
                    const legSize = Math.max(1, Math.floor(size / 3));
                    const legOffset = size / 2;
                    
                    // Left legs
                    ctx.fillRect(mobile.x - legOffset - 2, mobile.y - 1, legSize, legSize);
                    ctx.fillRect(mobile.x - legOffset - 2, mobile.y + 1, legSize, legSize);
                    
                    // Right legs
                    ctx.fillRect(mobile.x + legOffset + 1, mobile.y - 1, legSize, legSize);
                    ctx.fillRect(mobile.x + legOffset + 1, mobile.y + 1, legSize, legSize);
                }
                
                // Show if carrying food
                if (mobile.carryingFood) {
                    ctx.fillStyle = '#dd9966';
                    ctx.fillRect(mobile.x - 2, mobile.y - size / 2 - 3, 3, 2);
                }
                
                // Show if carrying spider piece
                if (mobile.carryingSpiderPiece) {
                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(mobile.x - 2, mobile.y - size / 2 - 4, 4, 3);
                }
            }
        });
    }
    
    renderFace(colony, baseColor) {
        const ctx = this.ctx;
        const faceScale = colony.faceQuality / 100;
        const faceX = colony.castleX - 15;
        const faceY = colony.castleY - 25;
        
        ctx.fillStyle = baseColor;
        
        // Draw face based on style
        switch (colony.faceStyle) {
            case 'benevolent':
                // Peaceful, kind face
                // Eyes
                ctx.fillRect(faceX + 2, faceY + 2, 2, 2);
                ctx.fillRect(faceX + 8, faceY + 2, 2, 2);
                // Gentle smile
                ctx.fillRect(faceX + 2, faceY + 8, 2, 2);
                ctx.fillRect(faceX + 8, faceY + 8, 2, 2);
                ctx.fillRect(faceX + 4, faceY + 7, 4, 2);
                break;
                
            case 'grotesque':
                // Twisted, angry face
                // Angry eyes
                ctx.fillRect(faceX + 1, faceY + 2, 3, 2);
                ctx.fillRect(faceX + 8, faceY + 2, 3, 2);
                // Jagged frown
                ctx.fillRect(faceX + 2, faceY + 9, 2, 2);
                ctx.fillRect(faceX + 5, faceY + 8, 2, 3);
                ctx.fillRect(faceX + 8, faceY + 9, 2, 2);
                // Extra details for hostility
                ctx.fillRect(faceX + 0, faceY + 0, 2, 2);
                ctx.fillRect(faceX + 10, faceY + 0, 2, 2);
                break;
                
            case 'fearful':
                // Scared, worried face
                // Wide eyes
                ctx.fillRect(faceX + 2, faceY + 1, 2, 3);
                ctx.fillRect(faceX + 8, faceY + 1, 2, 3);
                // Small worried mouth
                ctx.fillRect(faceX + 4, faceY + 9, 4, 2);
                ctx.fillRect(faceX + 3, faceY + 8, 2, 2);
                ctx.fillRect(faceX + 7, faceY + 8, 2, 2);
                break;
                
            case 'adoring':
                // Happy, loving face
                // Bright eyes
                ctx.fillRect(faceX + 2, faceY + 2, 2, 2);
                ctx.fillRect(faceX + 8, faceY + 2, 2, 2);
                // Hearts or sparkles
                ctx.fillRect(faceX + 0, faceY + 0, 2, 2);
                ctx.fillRect(faceX + 10, faceY + 0, 2, 2);
                // Big smile
                ctx.fillRect(faceX + 1, faceY + 8, 2, 2);
                ctx.fillRect(faceX + 9, faceY + 8, 2, 2);
                ctx.fillRect(faceX + 3, faceY + 7, 6, 2);
                break;
                
            default:
                // Neutral face
                ctx.fillRect(faceX + 2, faceY + 2, 2, 2);
                ctx.fillRect(faceX + 8, faceY + 2, 2, 2);
                ctx.fillRect(faceX + 3, faceY + 8, 6, 2);
        }
        
        // Face quality affects detail
        if (faceScale > 0.7) {
            // Add extra detail for high quality
            ctx.fillStyle = `rgba(${colony.color === 'white' ? '238, 238, 238' : '255, 68, 68'}, 0.5)`;
            ctx.fillRect(faceX - 1, faceY - 1, 14, 13);
        }
    }
    
    updateUI() {
        // Update stats
        document.getElementById('day-counter').textContent = Math.floor(this.gameDay);
        document.getElementById('food-supply').textContent = Math.floor(this.foodSupply);
        
        // Update safety level
        const safetyEl = document.getElementById('safety-level');
        if (this.safetyLevel > 70) {
            safetyEl.textContent = 'SAFE';
            safetyEl.style.color = '#6bcf7f';
        } else if (this.safetyLevel > 40) {
            safetyEl.textContent = 'CAUTION';
            safetyEl.style.color = '#ffd93d';
        } else if (this.safetyLevel > 20) {
            safetyEl.textContent = 'DANGER';
            safetyEl.style.color = '#ff9944';
        } else {
            safetyEl.textContent = 'CRITICAL';
            safetyEl.style.color = '#ff4444';
        }
        
        // Update colony stats
        Object.entries(this.colonies).forEach(([color, colony]) => {
            const colonyStatEl = document.querySelector(`.colony-stat[data-color="${color}"]`);
            const isDead = colony.population === 0;
            
            // Update population
            document.getElementById(`${color}-population`).textContent = colony.population;
            
            // Add/remove death state
            if (isDead) {
                colonyStatEl.classList.add('dead');
                // Add skull if not already present
                if (!colonyStatEl.querySelector('.death-icon')) {
                    const skull = document.createElement('div');
                    skull.className = 'death-icon';
                    skull.textContent = '☠';
                    colonyStatEl.appendChild(skull);
                }
            } else {
                colonyStatEl.classList.remove('dead');
                // Remove skull if present
                const skull = colonyStatEl.querySelector('.death-icon');
                if (skull) skull.remove();
            }
            
            // Size description based on actual mobile size
            const avgSize = colony.mobiles.reduce((sum, m) => sum + m.size, 0) / colony.mobiles.length || 1;
            let sizeDesc = 'Microscopic';
            if (avgSize > 10) sizeDesc = 'Large';
            else if (avgSize > 7) sizeDesc = 'Medium';
            else if (avgSize > 4) sizeDesc = 'Small';
            else if (avgSize > 2) sizeDesc = 'Tiny';
            document.getElementById(`${color}-size`).textContent = isDead ? 'Dead' : sizeDesc;
            
            // Mood with confidence indicator
            const moodText = isDead ? 'Extinct' : colony.mood.charAt(0).toUpperCase() + colony.mood.slice(1);
            const confidenceIcon = isDead ? '' : (colony.confidence > 70 ? '↑' : colony.confidence < 30 ? '↓' : '•');
            document.getElementById(`${color}-mood`).textContent = `${moodText} ${confidenceIcon}`;
        });
        
        // Update environment display
        const tempEl = document.getElementById('temp-display');
        if (this.temperature > 70) {
            tempEl.textContent = 'Hot';
            tempEl.style.color = '#ff6b6b';
        } else if (this.temperature > 40) {
            tempEl.textContent = 'Warm';
            tempEl.style.color = '#ffd93d';
        } else {
            tempEl.textContent = 'Cool';
            tempEl.style.color = '#6bcf7f';
        }
        
        const humidEl = document.getElementById('humidity-display');
        if (this.humidity > 60) {
            humidEl.textContent = 'Humid';
            humidEl.style.color = '#6bcf7f';
        } else if (this.humidity > 30) {
            humidEl.textContent = 'Normal';
            humidEl.style.color = '#ffd93d';
        } else {
            humidEl.textContent = 'Dry';
            humidEl.style.color = '#ff6b6b';
        }
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new SandkingGame();
});
