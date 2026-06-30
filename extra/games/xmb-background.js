/* xmb-background.js - Core Canvas Engine for XMB wave animations and ambient light blooms */

(function() {
  class XMBBackground {
    constructor() {
      this.canvas = document.getElementById('xmb-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.width = 0;
      this.height = 0;
      this.devicePixelRatio = window.devicePixelRatio || 1;

      // Interaction State
      this.mouse = { x: 0, y: 0, currentX: 0, currentY: 0 };
      this.scroll = { y: 0, currentY: 0 };

      // Themes configuration (RGB colors for smooth interpolation)
      this.themes = {
        playtime: {
          base: { r: 3, g: 5, b: 8, a: 1 },
          glowPrimary: { r: 251, g: 191, b: 36, a: 0.12 }, // gold
          glowSecondary: { r: 6, g: 182, b: 212, a: 0.12 }, // cyan
          waveColor1: { r: 251, g: 191, b: 36, a: 0.08 },
          waveColor2: { r: 6, g: 182, b: 212, a: 0.06 }
        },
        favorites: {
          base: { r: 3, g: 4, b: 7, a: 1 },
          glowPrimary: { r: 139, g: 92, b: 246, a: 0.14 }, // purple
          glowSecondary: { r: 236, g: 72, b: 153, a: 0.1 }, // pink
          waveColor1: { r: 139, g: 92, b: 246, a: 0.08 },
          waveColor2: { r: 236, g: 72, b: 153, a: 0.06 }
        },
        home: {
          base: { r: 3, g: 5, b: 8, a: 1 },
          glowPrimary: { r: 16, g: 124, b: 187, a: 0.12 }, // blue
          glowSecondary: { r: 139, g: 92, b: 246, a: 0.1 }, // purple
          waveColor1: { r: 16, g: 124, b: 187, a: 0.08 },
          waveColor2: { r: 139, g: 92, b: 246, a: 0.06 }
        }
      };

      // Current color state (initialized to playtime)
      this.currentColors = JSON.parse(JSON.stringify(this.themes.playtime));
      this.targetTheme = 'playtime';
      this.colorInterpolationSpeed = 0.04;

      // Mathematical Sine Waves Config
      this.waves = [
        { y: 0.55, amplitude: 50, frequency: 0.0015, phase: 0, speed: 0.003, scaleY: 1 },
        { y: 0.60, amplitude: 35, frequency: 0.0025, phase: Math.PI / 4, speed: -0.002, scaleY: 1.2 },
        { y: 0.50, amplitude: 25, frequency: 0.0035, phase: Math.PI / 2, speed: 0.004, scaleY: 0.8 }
      ];

      // Console Symbol Particles (Circle, Cross, Triangle, Square)
      this.particles = [];
      this.particleCount = 20;

      this.init();
    }

    init() {
      this.resize();
      this.createParticles();

      // Listeners
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      window.addEventListener('scroll', () => this.handleScroll());

      // Start loop
      requestAnimationFrame((t) => this.tick(t));
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * this.devicePixelRatio;
      this.canvas.height = this.height * this.devicePixelRatio;
      this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    }

    createParticles() {
      this.particles = [];
      for (let i = 0; i < this.particleCount; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: Math.random() * 12 + 10,
          speedX: (Math.random() - 0.5) * 0.15,
          speedY: (Math.random() - 0.5) * 0.15 - 0.1, // slowly drift upwards
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.005,
          opacity: Math.random() * 0.02 + 0.01, // extremely faint atmosphere
          type: Math.floor(Math.random() * 4) // 0: Triangle, 1: Circle, 2: Cross, 3: Square
        });
      }
    }

    handleMouseMove(e) {
      // Normalize mouse coordinates to [-0.5, 0.5] range
      this.mouse.x = (e.clientX / this.width) - 0.5;
      this.mouse.y = (e.clientY / this.height) - 0.5;
    }

    handleScroll() {
      this.scroll.y = window.scrollY;
    }

    setTheme(themeName) {
      if (this.themes[themeName]) {
        this.targetTheme = themeName;
      }
    }

    // Helper: Linear Interpolation
    lerp(start, end, amt) {
      return (1 - amt) * start + amt * end;
    }

    // Helper: Interpolate color objects
    lerpColor(c1, c2, amt) {
      return {
        r: this.lerp(c1.r, c2.r, amt),
        g: this.lerp(c1.g, c2.g, amt),
        b: this.lerp(c1.b, c2.b, amt),
        a: this.lerp(c1.a, c2.a, amt)
      };
    }

    updateColors() {
      const targetColors = this.themes[this.targetTheme];
      const speed = this.colorInterpolationSpeed;

      this.currentColors.base = this.lerpColor(this.currentColors.base, targetColors.base, speed);
      this.currentColors.glowPrimary = this.lerpColor(this.currentColors.glowPrimary, targetColors.glowPrimary, speed);
      this.currentColors.glowSecondary = this.lerpColor(this.currentColors.glowSecondary, targetColors.glowSecondary, speed);
      this.currentColors.waveColor1 = this.lerpColor(this.currentColors.waveColor1, targetColors.waveColor1, speed);
      this.currentColors.waveColor2 = this.lerpColor(this.currentColors.waveColor2, targetColors.waveColor2, speed);
    }

    toRGBA(c) {
      return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`;
    }

    drawBaseGradient() {
      // Shifting background radial glow based on time and mouse
      const pulseX = this.width * 0.5 + (this.mouse.currentX * 150);
      const pulseY = this.height * 0.5 + (this.mouse.currentY * 150);

      // Render base canvas fill
      this.ctx.fillStyle = this.toRGBA(this.currentColors.base);
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Glow Bloom 1 (Gold/Primary)
      const grad1 = this.ctx.createRadialGradient(pulseX - 100, pulseY - 150, 0, pulseX - 100, pulseY - 150, this.width * 0.65);
      grad1.addColorStop(0, this.toRGBA(this.currentColors.glowPrimary));
      grad1.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = grad1;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Glow Bloom 2 (Cyan/Secondary)
      const grad2 = this.ctx.createRadialGradient(pulseX + 150, pulseY + 150, 0, pulseX + 150, pulseY + 150, this.width * 0.6);
      grad2.addColorStop(0, this.toRGBA(this.currentColors.glowSecondary));
      grad2.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = grad2;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawWaves() {
      this.waves.forEach((wave, idx) => {
        wave.phase += wave.speed;

        // Modulate average height with scroll coordinates (parallax)
        const scrollOffset = this.scroll.currentY * 0.15;
        const mouseOffset = this.mouse.currentY * 50;
        
        // Target vertical center
        const centerY = (this.height * wave.y) - scrollOffset + mouseOffset;
        
        // Dynamically adjust wave properties on scroll
        const scrollCompress = 1 + (this.scroll.currentY * 0.0003);
        const amplitude = wave.amplitude * (1 / scrollCompress);
        const frequency = wave.frequency * scrollCompress;

        this.ctx.beginPath();
        
        // Render sine wave points
        const startY = centerY + Math.sin(wave.phase) * amplitude;
        this.ctx.moveTo(0, startY);

        for (let x = 0; x < this.width; x += 15) {
          const angle = (x * frequency) + wave.phase;
          const y = centerY + Math.sin(angle) * amplitude;
          this.ctx.lineTo(x, y);
        }

        // Draw line down to bottom of canvas to create a solid gradient fill ribbon
        this.ctx.lineTo(this.width, this.height);
        this.ctx.lineTo(0, this.height);
        this.ctx.closePath();

        // Alternate fill gradients
        const grad = this.ctx.createLinearGradient(0, centerY - amplitude, 0, this.height);
        const waveColor = idx % 2 === 0 ? this.currentColors.waveColor1 : this.currentColors.waveColor2;
        grad.addColorStop(0, this.toRGBA(waveColor));
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // Stroke line of the wave for neon ribbon highlight
        this.ctx.beginPath();
        this.ctx.moveTo(0, startY);
        for (let x = 0; x < this.width; x += 15) {
          const angle = (x * frequency) + wave.phase;
          const y = centerY + Math.sin(angle) * amplitude;
          this.ctx.lineTo(x, y);
        }
        this.ctx.strokeStyle = `rgba(${Math.round(waveColor.r)}, ${Math.round(waveColor.g)}, ${Math.round(waveColor.b)}, ${waveColor.a * 1.5})`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      });
    }

    drawParticles() {
      this.particles.forEach(p => {
        // Drift movement
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        // Mouse Parallax reaction
        const px = p.x + (this.mouse.currentX * 30);
        const py = p.y - (this.scroll.currentY * 0.08) + (this.mouse.currentY * 30);

        // Wrapping boundaries
        if (p.x < -20) p.x = this.width + 20;
        if (p.x > this.width + 20) p.x = -20;
        if (p.y < -20) p.y = this.height + 20;
        if (p.y > this.height + 20) p.y = -20;

        this.ctx.save();
        this.ctx.translate(px, py);
        this.ctx.rotate(p.rotation);
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity})`;
        this.ctx.lineWidth = 1.5;

        // Draw distinct console shapes
        this.ctx.beginPath();
        if (p.type === 0) {
          // Triangle
          this.ctx.moveTo(0, -p.size / 2);
          this.ctx.lineTo(p.size / 2, p.size / 2);
          this.ctx.lineTo(-p.size / 2, p.size / 2);
          this.ctx.closePath();
          this.ctx.stroke();
        } else if (p.type === 1) {
          // Circle
          this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          this.ctx.stroke();
        } else if (p.type === 2) {
          // Cross
          const half = p.size / 2;
          this.ctx.moveTo(-half, -half);
          this.ctx.lineTo(half, half);
          this.ctx.moveTo(half, -half);
          this.ctx.lineTo(-half, half);
          this.ctx.stroke();
        } else {
          // Square
          const half = p.size / 2;
          this.ctx.strokeRect(-half, -half, p.size, p.size);
        }
        this.ctx.restore();
      });
    }

    tick(time) {
      if (!this.canvas) return;

      // Lerp interactions for smooth motion
      this.mouse.currentX = this.lerp(this.mouse.currentX, this.mouse.x, 0.06);
      this.mouse.currentY = this.lerp(this.mouse.currentY, this.mouse.y, 0.06);
      this.scroll.currentY = this.lerp(this.scroll.currentY, this.scroll.y, 0.08);

      // Perform updates
      this.updateColors();

      // Clear & redraw canvas
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.drawBaseGradient();
      this.drawWaves();
      this.drawParticles();

      requestAnimationFrame((t) => this.tick(t));
    }
  }

  // Bind to window to allow external theme calls from games.js
  document.addEventListener('DOMContentLoaded', () => {
    window.xmbBackground = new XMBBackground();
  });
})();
