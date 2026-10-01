/**
 * Yongyong Visual Lab - Holographic Liquid Chrome Generator (酸性全息液态镀铬着色器)
 * 100% Procedural WebGL GPU shader reproducing iridescent molten mercury / fluid liquid chrome.
 * Completely free of external copyrighted images.
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

    // Viscous molten chrome height field with organic gyroid folds + delicate rippling caustics
    float liquidChrome(vec2 p) {
      // Layer 1: Slow swirling currents
      vec2 q = vec2(
        gnoise(p * 0.7 + vec2(1.2, 3.4)),
        gnoise(p * 0.7 + vec2(7.8, 2.1))
      );

      // Layer 2: Medium viscous waves and vortices
      vec2 r = vec2(
        gnoise(p * 1.1 + 1.6 * q + vec2(3.3, 8.5)),
        gnoise(p * 1.1 + 1.6 * q + vec2(4.9, 1.6))
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
      return pow(h, 1.35);
    }

    void main() {
      vec2 uv = v_uv;
      uv.y = 1.0 - uv.y;
      vec2 p = (uv - vec2(0.5, 0.5)) * vec2(u_resolution.x / u_resolution.y, 1.0) * 4.2;

      // Normal estimation via finite differences
      float eps = 0.014;
      float h0 = liquidChrome(p);
      float hx1 = liquidChrome(p + vec2(eps, 0.0));
      float hx2 = liquidChrome(p - vec2(eps, 0.0));
      float hy1 = liquidChrome(p + vec2(0.0, eps));
      float hy2 = liquidChrome(p - vec2(0.0, eps));

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

      // Base Metallic Steel Blue & Midnight Crevices
      vec3 deepIndigo = vec3(0.11, 0.17, 0.28);
      vec3 midSteel   = vec3(0.58, 0.70, 0.85);
      vec3 silverBody = vec3(0.82, 0.90, 0.98);

      vec3 col = mix(deepIndigo, midSteel, smoothstep(0.05, 0.65, h0));
      col = mix(col, silverBody, smoothstep(0.45, 0.95, h0));

      // Soft Iridescent Thin-Film Interference (Pastel Rainbow Sheen)
      float phase = h0 * 2.4 + normal.x * 2.0 - normal.y * 1.6 + fresnel * 2.4;
      
      // Refined spectral palette: Pearl Pink, Cyan-Aqua, Amber Gold, Violet
      vec3 rainbow = 0.52 + 0.48 * cos(6.28318 * (phase * 0.72 + vec3(0.12, 0.42, 0.78)));
      rainbow = mix(silverBody, rainbow, 0.82);

      // Rainbow shines on grazing angles and reflective slopes
      float iridMask = smoothstep(0.18, 0.82, fresnel * 0.95 + spec2 * 0.5);
      col = mix(col, rainbow, iridMask * 0.72);

      // Crisp specular glints (liquid chrome sheen)
      col += vec3(1.0, 1.0, 1.0) * spec1 * 1.1;
      col += vec3(0.95, 0.98, 1.0) * spec3 * 0.9;
      col += rainbow * spec2 * 0.75;
      col += vec3(0.85, 0.92, 1.0) * spec4 * 0.5;

      // Ambient occlusion in deep folds
      float ao = smoothstep(0.04, 0.45, h0);
      col *= (0.5 + 0.5 * ao);

      // Film tonemap
      col = pow(col, vec3(0.96));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  function renderToCanvas(w = 900, h = 1200, seed = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));

    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true })
            || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });

    if (!gl) {
      // 2D Canvas Fallback if WebGL unavailable
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

    function createShader(glCtx, type, src) {
      const s = glCtx.createShader(type);
      glCtx.shaderSource(s, src);
      glCtx.compileShader(s);
      if (!glCtx.getShaderParameter(s, glCtx.COMPILE_STATUS)) {
        const err = glCtx.getShaderInfoLog(s);
        glCtx.deleteShader(s);
        throw new Error('LiquidChrome shader error: ' + err);
      }
      return s;
    }

    try {
      const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('LiquidChrome link error: ' + gl.getProgramInfoLog(prog));
      }

      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]), gl.STATIC_DRAW);

      const aPos = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, 'u_resolution');
      gl.uniform2f(uRes, canvas.width, canvas.height);

      const uSeed = gl.getUniformLocation(prog, 'u_seed');
      gl.uniform1f(uSeed, Number(seed) || 0.0);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Clean up WebGL resources
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

  window.posterLiquidChrome = {
    renderToCanvas,
    getCachedCanvas,
    regenerate(w = 900, h = 1200) {
      cachedSeed = Math.random() * 100;
      cachedCanvas = renderToCanvas(w, h, cachedSeed);
      return cachedCanvas;
    }
  };
})();
