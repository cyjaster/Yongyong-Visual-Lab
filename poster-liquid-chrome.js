/**
 * Yongyong Visual Lab (实验版) - Holographic Liquid Chrome Generator & Interactive Mercury Engine
 * 酸性全息液态水银交互引擎：
 * 1. 100% 过程式 WebGL GPU 着色器，模拟虹彩液态水银 (Molten Mercury & Liquid Chrome)
 * 2. 具备实时光标流体拨动、涡流搅拌、点击冲击波与表面张力阻尼回弹
 * 3. 保持现有静态离线渲染 API 100% 兼容 (renderToCanvas / getCachedCanvas / regenerate)
 */
(() => {
  let cachedCanvas = null;
  let cachedSeed = 0;

  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform float u_seed;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform vec2 u_velocity;
    uniform vec2 u_gravityOffset;
    uniform float u_disturbance;
    uniform vec4 u_click; // x, y, age, intensity
    uniform float u_mode;  // 0.0 = static export poster, 1.0 = interactive stage atmosphere

    mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
    }

    vec2 hash2(vec2 p) {
      p = vec2(dot(p, vec2(127.1 + u_seed * 11.3, 311.7 + u_seed * 7.1)),
               dot(p, vec2(269.5 + u_seed * 5.3, 183.3 + u_seed * 9.7)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float gnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                     dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                 mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                     dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
    }

    // Viscous molten chrome height field with organic gyroid folds + interactive cursor disturbance
    float liquidChrome(vec2 p, vec2 mPos, float aspect) {
      p -= u_gravityOffset * u_mode;
      // 1. 光标扰动与涡流推力 (Cursor Disturbance & Swirl Vortex)
      vec2 toM = p - mPos;
      float distM = length(toM);
      float mouseInfluence = exp(-distM * distM * 3.6) * u_disturbance;

      // 旋涡切向力 (Tangential vortex swirl)
      vec2 swirl = vec2(-toM.y, toM.x) * 1.6;
      vec2 push = u_velocity * 4.2;
      vec2 flow = (push + swirl * (dot(u_velocity, swirl) * 0.4 + 0.25)) * mouseInfluence;

      // 点击震荡冲击波 (Expanding ring wave)
      float clickRing = 0.0;
      if (u_click.z >= 0.0 && u_click.z < 2.5) {
        vec2 clickPos = (u_click.xy - vec2(0.5)) * vec2(aspect, 1.0) * 4.2;
        float dClick = length(p - clickPos);
        float ringWave = sin(dClick * 18.0 - u_click.z * 11.0);
        float ringMask = exp(-abs(dClick - u_click.z * 1.6) * 3.2) * exp(-u_click.z * 1.1);
        clickRing = ringWave * ringMask * u_click.w * 0.65;
        flow += (p - clickPos) * clickRing * 0.4;
      }

      p += flow;

      // 2. 基础流体波形 (Organic Gyroid Waveforms)
      float t = u_time * 0.18;
      vec2 drift = vec2(sin(t * 0.6), cos(t * 0.45)) * 0.22;

      // Layer 1: Slow swirling currents
      vec2 q = vec2(
        gnoise(p * 0.7 + drift + vec2(1.2, 3.4)),
        gnoise(p * 0.7 - drift + vec2(7.8, 2.1))
      );

      // Layer 2: Medium viscous waves and vortices
      vec2 r = vec2(
        gnoise(p * 1.1 + 1.6 * q + vec2(3.3 + t * 0.25, 8.5)),
        gnoise(p * 1.1 + 1.6 * q + vec2(4.9, 1.6 - t * 0.2))
      );

      vec2 wp = p + 1.4 * r;

      // Fluid gyroid waveforms (smooth liquid tubes and crevices)
      float w1 = sin(wp.x * 2.1 + cos(wp.y * 1.9 + q.x * 2.5));
      float w2 = cos(wp.y * 2.3 + sin(wp.x * 2.0 + r.y * 2.5));
      float w3 = sin((wp.x * 0.8 + wp.y * 1.2) * 1.8 + gnoise(wp * 1.4) * 1.5);

      float h = (w1 * 0.42 + w2 * 0.38 + w3 * 0.3);

      // Fine liquid tension wrinkles on slopes
      float fine = gnoise(wp * 3.2 + q * 1.8) * 0.14;
      h += fine;

      // Tubular metallic ridge shaping
      h = 1.0 - abs(h);
      h = pow(h, 1.35);

      // 光标附近的水面同心涟漪 (Interference ripples around touch)
      float ripple = sin(distM * 22.0 - u_time * 6.5) * mouseInfluence * 0.26;
      h += ripple + clickRing * 0.3;

      return h;
    }

    void main() {
      vec2 uv = v_uv;
      uv.y = 1.0 - uv.y;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = (uv - vec2(0.5, 0.5)) * vec2(aspect, 1.0) * 4.2;
      vec2 mPos = (u_mouse - vec2(0.5, 0.5)) * vec2(aspect, 1.0) * 4.2;

      // Normal estimation via finite differences
      float eps = 0.015;
      float h0  = liquidChrome(p, mPos, aspect);
      float hx1 = liquidChrome(p + vec2(eps, 0.0), mPos, aspect);
      float hx2 = liquidChrome(p - vec2(eps, 0.0), mPos, aspect);
      float hy1 = liquidChrome(p + vec2(0.0, eps), mPos, aspect);
      float hy2 = liquidChrome(p - vec2(0.0, eps), mPos, aspect);

      vec3 normal = normalize(vec3((hx2 - hx1) / (2.0 * eps), (hy2 - hy1) / (2.0 * eps), 0.62));
      vec3 viewDir = vec3(0.0, 0.0, 1.0);

      // Optical Fresnel
      float NdotV = clamp(dot(normal, viewDir), 0.0, 1.0);
      float fresnel = pow(1.0 - NdotV, 2.5);

      // Studio Key & Rim Lights
      vec3 l1 = normalize(vec3(0.5, 0.75, 1.1));
      vec3 l2 = normalize(vec3(-0.7, -0.5, 0.9));
      vec3 l3 = normalize(vec3(-0.1, 0.9, 0.8));
      vec3 l4 = normalize(vec3(0.8, -0.6, 0.7));

      float spec1 = pow(max(dot(reflect(-l1, normal), viewDir), 0.0), 48.0);
      float spec2 = pow(max(dot(reflect(-l2, normal), viewDir), 0.0), 22.0);
      float spec3 = pow(max(dot(reflect(-l3, normal), viewDir), 0.0), 80.0);
      float spec4 = pow(max(dot(reflect(-l4, normal), viewDir), 0.0), 32.0);

      // 材质调配：展台环境流体更偏冷峻深邃黑钛 (Dark Titanium)，海报导出偏高亮银 (Bright Silver)
      vec3 deepIndigo = mix(vec3(0.11, 0.17, 0.28), vec3(0.06, 0.09, 0.12), u_mode * 0.7);
      vec3 midSteel   = mix(vec3(0.58, 0.70, 0.85), vec3(0.32, 0.42, 0.50), u_mode * 0.6);
      vec3 silverBody = mix(vec3(0.82, 0.90, 0.98), vec3(0.65, 0.75, 0.82), u_mode * 0.4);

      vec3 col = mix(deepIndigo, midSteel, smoothstep(0.05, 0.65, h0));
      col = mix(col, silverBody, smoothstep(0.45, 0.95, h0));

      // Soft Iridescent Thin-Film Interference (酸性全息虹彩薄膜干涉)
      float phase = h0 * 2.4 + normal.x * 2.0 - normal.y * 1.6 + fresnel * 2.4 + u_time * 0.05;
      
      // Refined spectral palette: Pearl Pink, Cyan-Aqua, Amber Gold, Violet
      vec3 rainbow = 0.52 + 0.48 * cos(6.28318 * (phase * 0.72 + vec3(0.12, 0.42, 0.78)));
      rainbow = mix(silverBody, rainbow, 0.85);

      // Rainbow shines on grazing angles and reflective slopes
      float iridMask = smoothstep(0.18, 0.82, fresnel * 0.95 + spec2 * 0.5);
      col = mix(col, rainbow, iridMask * 0.75);

      // Crisp specular glints (liquid chrome sheen)
      col += vec3(1.0, 1.0, 1.0) * spec1 * 1.1;
      col += vec3(0.95, 0.98, 1.0) * spec3 * 0.9;
      col += rainbow * spec2 * 0.75;
      col += vec3(0.85, 0.92, 1.0) * spec4 * 0.5;

      // 焦散光网增强 (Molten Mercury Caustics)
      float causticPhase = h0 * 13.0 - u_time * 1.6;
      float caustics = pow(max(0.0, sin(causticPhase) * cos(causticPhase * 0.8 + normal.x * 2.8)), 6.0);
      col += vec3(0.92, 0.98, 1.0) * caustics * (0.28 + u_disturbance * 0.75);

      // 波浪斜切面棱镜色散 (Prism Chromatic Dispersion)
      vec3 dispersion = vec3(
        sin(h0 * 5.5 + 0.0),
        sin(h0 * 5.5 + 2.09),
        sin(h0 * 5.5 + 4.18)
      ) * 0.5 + 0.5;
      col += dispersion * pow(length(normal.xy), 2.2) * 0.42 * (0.35 + u_disturbance * 0.85);

      // 光标直接交互区域的光学激活：指尖划过产生全息彩虹色光晕
      float distM = length(p - mPos);
      float cursorGlow = exp(-distM * distM * 3.0) * (u_disturbance * 0.85 + 0.25);
      col += rainbow * cursorGlow * 0.65;
      col += vec3(0.9, 1.0, 0.95) * spec1 * cursorGlow * 0.55;

      // Ambient occlusion in deep folds
      float ao = smoothstep(0.04, 0.45, h0);
      col *= (0.5 + 0.5 * ao);

      // Film tonemap
      col = pow(col, vec3(0.96));

      // 展台模式暗角过渡，与页面边缘自然交融
      if (u_mode > 0.5) {
        float vignette = smoothstep(1.8, 0.5, length((uv - vec2(0.5)) * vec2(aspect, 1.0)));
        col *= mix(0.82, 1.0, vignette);
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('LiquidChrome shader error: ' + err);
    }
    return s;
  }

  function createProgram(gl) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('LiquidChrome link error: ' + gl.getProgramInfoLog(prog));
    }
    return { prog, vs, fs };
  }

  // --- 1. 静态离线生成 (用于海报导出与背景纹理，100% 保持原有签名) ---
  function renderToCanvas(w = 900, h = 1200, seed = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));

    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true })
            || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });

    if (!gl) {
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#111927');
      grad.addColorStop(0.3, '#7494b9');
      grad.addColorStop(0.5, '#e4f1fc');
      grad.addColorStop(0.7, '#c29bc9');
      grad.addColorStop(1, '#9fd6e8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      return canvas;
    }

    try {
      const { prog, vs, fs } = createProgram(gl);
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
      ]), gl.STATIC_DRAW);

      const aPos = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const setU = (name, fn) => {
        const loc = gl.getUniformLocation(prog, name);
        if (loc !== null) fn(loc);
      };

      setU('u_resolution', l => gl.uniform2f(l, canvas.width, canvas.height));
      setU('u_seed', l => gl.uniform1f(l, Number(seed) || 0.0));
      setU('u_time', l => gl.uniform1f(l, 0.0));
      setU('u_mouse', l => gl.uniform2f(l, 0.5, 0.5));
      setU('u_velocity', l => gl.uniform2f(l, 0.0, 0.0));
      setU('u_gravityOffset', l => gl.uniform2f(l, 0.0, 0.0));
      setU('u_disturbance', l => gl.uniform1f(l, 0.0));
      setU('u_click', l => gl.uniform4f(l, 0.5, 0.5, -1.0, 0.0));
      setU('u_mode', l => gl.uniform1f(l, 0.0));

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      return canvas;
    } catch (e) {
      console.warn('Liquid chrome WebGL render error:', e);
      return canvas;
    }
  }

  function getCachedCanvas(w = 900, h = 1200, seed = 0) {
    if (!cachedCanvas || cachedCanvas.width !== w || cachedCanvas.height !== h || cachedSeed !== seed) {
      cachedCanvas = renderToCanvas(w, h, seed);
      cachedSeed = seed;
    }
    return cachedCanvas;
  }

  // --- 2. 实时交互式液态水银引擎 (Interactive Mercury Fluid Engine) ---
  class InteractiveFluidStage {
    constructor(canvas, stageElement) {
      this.canvas = canvas;
      this.stage = stageElement;
      this.gl = canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: false })
             || canvas.getContext('experimental-webgl', { antialias: true, alpha: true });

      if (!this.gl) {
        console.warn('WebGL not supported for interactive liquid chrome');
        return;
      }

      this.initGL();
      this.initEvents();
      this.state = {
        mouse: { x: 0.5, y: 0.5 },
        targetMouse: { x: 0.5, y: 0.5 },
        velocity: { x: 0, y: 0 },
        disturbance: 0.0,
        click: { x: 0.5, y: 0.5, age: -1.0, intensity: 0.0 },
        lastTime: performance.now(),
        running: false,
        elapsed: 0
      };

      this.resize();
      this.start();
    }

    initGL() {
      const gl = this.gl;
      const { prog, vs, fs } = createProgram(gl);
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
      ]), gl.STATIC_DRAW);

      const aPos = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      this.uniforms = {
        u_resolution: gl.getUniformLocation(prog, 'u_resolution'),
        u_seed: gl.getUniformLocation(prog, 'u_seed'),
        u_time: gl.getUniformLocation(prog, 'u_time'),
        u_mouse: gl.getUniformLocation(prog, 'u_mouse'),
        u_velocity: gl.getUniformLocation(prog, 'u_velocity'),
        u_gravityOffset: gl.getUniformLocation(prog, 'u_gravityOffset'),
        u_disturbance: gl.getUniformLocation(prog, 'u_disturbance'),
        u_click: gl.getUniformLocation(prog, 'u_click'),
        u_mode: gl.getUniformLocation(prog, 'u_mode')
      };
    }

    initEvents() {
      const stage = this.stage;

      const updatePointer = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const normX = Math.min(1.0, Math.max(0.0, (e.clientX - rect.left) / rect.width));
        const normY = Math.min(1.0, Math.max(0.0, (e.clientY - rect.top) / rect.height));

        const dx = normX - this.state.targetMouse.x;
        const dy = normY - this.state.targetMouse.y;
        const speed = Math.hypot(dx, dy);

        this.state.targetMouse.x = normX;
        this.state.targetMouse.y = normY;
        this.state.velocity.x += dx * 2.8;
        this.state.velocity.y += dy * 2.8;
        this.state.disturbance = Math.min(1.0, this.state.disturbance + speed * 12.0);

        if (!this.state.running) this.start();
      };

      stage.addEventListener('pointermove', updatePointer, { passive: true });
      stage.addEventListener('pointerenter', () => this.start(), { passive: true });

      stage.addEventListener('pointerdown', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        this.state.click = {
          x: normX,
          y: normY,
          age: 0.0,
          intensity: 1.0
        };
        this.state.disturbance = Math.min(1.0, this.state.disturbance + 0.6);
        if (!this.state.running) this.start();
      }, { passive: true });

      window.addEventListener('resize', () => { this.resize(); this.start(); }, { passive: true });
      window.addEventListener('visual-lab-gravity', event => this.setGravity(event.detail));
      // The existing motion controller owns system preferences and tab visibility.
      new MutationObserver(() => { this.resize(); this.start(); }).observe(document.body, { attributes: true, attributeFilter: ['data-ambient', 'data-motion-tier'] });
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      const lite = document.body.dataset.motionTier === 'lite';
      const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
      const scale = lite ? Math.min(1, 720 / Math.max(rect.width || 800, rect.height || 600)) : 1;
      const w = Math.round((rect.width || 800) * dpr * scale);
      const h = Math.round((rect.height || 600) * dpr * scale);

      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.hasRendered = false;
        if (this.gl) this.gl.viewport(0, 0, w, h);
      }
    }

    start() {
      if (!this.gl || this.state.running) return;
      this.state.lastTime = performance.now();
      this.lastDraw = -Infinity;
      this.state.running = true;
      this.loop();
    }

    setGravity({ x, y, active }) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      this.gravity = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), active };
      this.gravityFlow ??= { x: 0, y: 0 };
      this.gravityOffset ??= { x: 0, y: 0 };
      if (!active) this.gravityFlow.x = this.gravityFlow.y = 0;
      if (active) this.start();
    }

    loop() {
      if (!this.state.running) return;

      if (document.hidden || (document.body.dataset.ambient !== 'on' && !this.gravity?.active)) {
        if (!this.hasRendered && !document.hidden) { this.render(0); this.hasRendered = true; }
        this.state.running = false;
        return;
      }

      const now = performance.now();
      const dt = Math.min(0.1, (now - this.state.lastTime) / 1000);
      this.state.lastTime = now;
      if (document.body.dataset.ambientEditing === 'true') {
        requestAnimationFrame(() => this.loop());
        return;
      }
      this.state.elapsed += dt;
      const elapsedTime = this.state.elapsed;
      if (document.body.dataset.motionTier === 'lite' && now - (this.lastDraw ?? -Infinity) < 1000 / 24) {
        requestAnimationFrame(() => this.loop());
        return;
      }

      // 弹簧阻尼插值鼠标
      this.state.mouse.x += (this.state.targetMouse.x - this.state.mouse.x) * 0.14;
      this.state.mouse.y += (this.state.targetMouse.y - this.state.mouse.y) * 0.14;

      // 速度与能量自然衰减
      this.state.velocity.x *= 0.88;
      this.state.velocity.y *= 0.88;
      this.state.disturbance *= 0.945;

      if (this.gravity?.active) {
        const flowDt = Math.min(.1, (now - (this.lastDraw ?? now - 16)) / 1000);
        this.gravityFlow.x += (this.gravity.x - this.gravityFlow.x) * .12;
        this.gravityFlow.y += (this.gravity.y - this.gravityFlow.y) * .12;
        this.gravityOffset.x += this.gravityFlow.x * flowDt * .5;
        this.gravityOffset.y += this.gravityFlow.y * flowDt * .5;
      }

      // 点击冲击波推进
      if (this.state.click.age >= 0.0) {
        this.state.click.age += dt * 1.6;
        if (this.state.click.age > 2.5) {
          this.state.click.age = -1.0;
        }
      }

      this.render(elapsedTime);
      this.lastDraw = now;
      this.hasRendered = true;

      // Continue the ambient flow even after pointer disturbance has settled.
      requestAnimationFrame(() => this.loop());
    }

    render(time) {
      const gl = this.gl;
      if (!gl) return;

      gl.useProgram(this.prog);

      const u = this.uniforms;
      gl.uniform2f(u.u_resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.u_seed, 42.0);
      gl.uniform1f(u.u_time, time);
      gl.uniform2f(u.u_mouse, this.state.mouse.x, this.state.mouse.y);
      gl.uniform2f(u.u_velocity, this.state.velocity.x, this.state.velocity.y);
      gl.uniform2f(u.u_gravityOffset, this.gravityOffset?.x || 0, this.gravityOffset?.y || 0);
      gl.uniform1f(u.u_disturbance, this.state.disturbance);
      gl.uniform4f(u.u_click, this.state.click.x, this.state.click.y, this.state.click.age, this.state.click.intensity);
      gl.uniform1f(u.u_mode, 1.0); // 展台环境深邃模式

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  // 全局注册与挂载 API
  window.posterLiquidChrome = {
    renderToCanvas,
    getCachedCanvas,
    regenerate(w = 900, h = 1200) {
      cachedSeed = Math.random() * 100;
      cachedCanvas = renderToCanvas(w, h, cachedSeed);
      return cachedCanvas;
    },
    attachInteractiveStage(canvas, stageElement) {
      return new InteractiveFluidStage(canvas, stageElement);
    }
  };

  // 页面加载完成后自动寻找并挂载展台液态水银流体
  function initAutoMount() {
    const backdrops = document.querySelectorAll('.interactive-fluid-backdrop');
    backdrops.forEach((backdrop) => {
      const canvas = backdrop.querySelector('.interactive-fluid-canvas');
      const stage = backdrop.closest('.app-shell');
      if (canvas && stage && !canvas._fluidInstance) {
        canvas._fluidInstance = window.posterLiquidChrome.attachInteractiveStage(canvas, stage);
      } else if (canvas && canvas._fluidInstance) {
        canvas._fluidInstance.resize();
        canvas._fluidInstance.start();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoMount);
  } else {
    initAutoMount();
  }

  window.addEventListener('visual-lab-mode-change', () => {
    setTimeout(initAutoMount, 60);
  });
})();
