// ────────────────────────────────────────────────────────────────────────────
// 1. tiny utilities
// ────────────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => lerp(a, b, 1 - Math.pow(1 - t, 3));
const toast = (msg, ms = 1400) => {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
};

// ────────────────────────────────────────────────────────────────────────────
// shared state for both render paths
// ────────────────────────────────────────────────────────────────────────────
const state = {
  scene: 0,
  pal: 0,
  yaw: 0.4, pitch: 0.2,
  camZ: 0,
  auto: true,
  zoom: 1.0,
  detail: 0.8,
  quality: 1.0,
  audioOn: false,
  audioLevel: 0,
  helpOpen: true,
  renderer: '—',
};

const NUM_PALS = 8;
const NUM_SCENES = 6;
const SCENE_NAMES = ['mandelbox','mandelbulb','kaleido','menger','tunnel','wraps'];

const dragging = { on: false, lx: 0, ly: 0 };
let animFrameId = null;

// ────────────────────────────────────────────────────────────────────────────
// 2. shared controls (pointer / wheel / keyboard)
// ────────────────────────────────────────────────────────────────────────────
function setupControls(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    dragging.on = true; dragging.lx = e.clientX; dragging.ly = e.clientY;
    canvas.classList.add('dragging'); state.auto = false; updateMode();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging.on = false; canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch(_){}
  });
  canvas.addEventListener('pointermove', (e) => {
    if(!dragging.on) return;
    const dx = (e.clientX - dragging.lx) / window.innerWidth;
    const dy = (e.clientY - dragging.ly) / window.innerHeight;
    dragging.lx = e.clientX; dragging.ly = e.clientY;
    state.yaw   += dx * 2.5;
    state.pitch = clamp(state.pitch - dy * 2.0, -1.3, 1.3);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.zoom = clamp(state.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.2, 5.0);
    $('v-zoom').textContent = state.zoom.toFixed(2);
  }, { passive: false });
}

function updateMode(){ $('v-mode').textContent = state.auto ? 'auto' : 'manual'; }

function setScene(i){
  state.scene = ((i % NUM_SCENES) + NUM_SCENES) % NUM_SCENES;
  $('v-scene').textContent = SCENE_NAMES[state.scene];
  $('v-pal').textContent   = String(state.pal + 1).padStart(2, '0');
  toast('scene: ' + SCENE_NAMES[state.scene]);
  document.querySelectorAll('#vbar .seg').forEach((el, idx) => {
    el.classList.toggle('on', idx === state.scene);
  });
  flash();
}
function setPal(i){
  state.pal = ((i % NUM_PALS) + NUM_PALS) % NUM_PALS;
  $('v-pal').textContent = String(state.pal + 1).padStart(2, '0');
  toast('palette ' + (state.pal + 1));
}
function flash(){
  const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}

window.addEventListener('keydown', (e) => {
  if(state.helpOpen && e.key !== '?' && e.key !== 'h' && e.key !== 'Escape') return;
  if(e.key === ' '){ state.auto = !state.auto; updateMode(); toast(state.auto ? 'auto-orbit on' : 'auto-orbit off'); e.preventDefault(); }
  else if(e.key === 'p'){ setPal(state.pal + 1); }
  else if(e.key === 'm'){ toggleAudio(); }
  else if(e.key === 'f'){ toggleFs(); }
  else if(e.key === '?' || e.key === '/'){ showHelp(true); }
  else if(e.key === 'h' || e.key === 'Escape'){ showHelp(false); }
  else if(e.key === '+' || e.key === '='){ state.zoom = clamp(state.zoom * 0.92, 0.2, 5.0); $('v-zoom').textContent = state.zoom.toFixed(2); }
  else if(e.key === '-' || e.key === '_'){ state.zoom = clamp(state.zoom * 1.08, 0.2, 5.0); $('v-zoom').textContent = state.zoom.toFixed(2); }
  else if(e.key === '['){ state.detail = clamp(state.detail - 0.1, 0.4, 1.4); $('v-detail').textContent = Math.round(state.detail*128); }
  else if(e.key === ']'){ state.detail = clamp(state.detail + 0.1, 0.4, 1.4); $('v-detail').textContent = Math.round(state.detail*128); }
  else if(/^[1-6]$/.test(e.key)){ setScene(parseInt(e.key, 10) - 1); }
  else if(e.key === 'q'){ state.quality = clamp(state.quality - 0.05, 0.5, 1.0); }
  else if(e.key === 'w'){ state.quality = clamp(state.quality + 0.05, 0.5, 1.0); }
});

function showHelp(on){
  state.helpOpen = on;
  $('panel-help').style.display = on ? 'block' : 'none';
}
$('start').addEventListener('click', () => {
  showHelp(false);
  if(!state.audioOn) toggleAudio();
  startRenderer();
}, { once: true });

function toggleFs(){
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

// ────────────────────────────────────────────────────────────────────────────
// 3. audio (WebAudio) — shared
// ────────────────────────────────────────────────────────────────────────────
let ctx = null, masterGain = null, analyser = null, analyserData = null, lfo = null;
function toggleAudio(){
  if(!state.audioOn){
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if(ctx.state === 'suspended') ctx.resume();

      const freqs = [55, 82.5, 110];
      const oscs = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sawtooth' : 'triangle';
        o.frequency.value = f;
        o.detune.value = (i - 1) * 7;
        return o;
      });
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 1.4;
      masterGain = ctx.createGain(); masterGain.gain.value = 0.0;
      analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      oscs.forEach(o => o.connect(filt));
      filt.connect(masterGain).connect(analyser).connect(ctx.destination);
      oscs.forEach(o => o.start());

      lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
      lfo.connect(lfoGain).connect(filt.frequency);
      lfo.start();

      masterGain.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 1.2);
      state.audioOn = true;
      $('v-audio').textContent = 'on';
      toast('audio on');
    } catch(err){
      console.warn('audio failed', err);
      toast('audio unavailable');
    }
  } else {
    if(masterGain && ctx){
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.3);
      setTimeout(() => state.audioOn && toast('audio off'), 320);
    }
    state.audioOn = false;
    $('v-audio').textContent = 'off';
  }
}

function readAudio(){
  if(!analyser) return 0;
  analyser.getByteFrequencyData(analyserData);
  let s = 0;
  for(let i=0;i<analyserData.length;i++) s += analyserData[i];
  return (s / (analyserData.length * 255));
}

// ────────────────────────────────────────────────────────────────────────────
// 4. film grain (procedural canvas, shared)
// ────────────────────────────────────────────────────────────────────────────
const grainCv = $('grain');
let grainCtx = null;
function resizeGrain(){
  grainCv.width  = Math.floor(window.innerWidth  * 0.5);
  grainCv.height = Math.floor(window.innerHeight * 0.5);
  grainCv.style.width  = window.innerWidth  + 'px';
  grainCv.style.height = window.innerHeight + 'px';
  grainCtx = grainCv.getContext('2d');
}
function stepGrain(){
  if(!grainCtx) return;
  grainCtx.globalCompositeOperation = 'source-over';
  grainCtx.globalAlpha = 0.85;
  grainCtx.drawImage(grainCv, 0, 1);
  const w = grainCv.width;
  for(let x=0;x<w;x++){
    const v = (Math.random() * 60) | 0;
    grainCtx.fillStyle = `rgba(${v},${v},${v},0.6)`;
    grainCtx.fillRect(x, 0, 1, 1);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. FPS / stats (shared)
// ────────────────────────────────────────────────────────────────────────────
let last = performance.now(), acc = 0, frames = 0, fpsEMA = 0;
const fpsEl = $('v-fps'), msEl = $('v-ms'), itsEl = $('v-its'), qualEl = $('v-qual');

// ────────────────────────────────────────────────────────────────────────────
// 6. WebGPU Renderer (primary path)
// ────────────────────────────────────────────────────────────────────────────
async function initWebGPU(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU not available');

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) throw new Error('no WebGPU adapter found');

  const device = await adapter.requestDevice();
  let gpuName = 'WebGPU GPU';
  try {
    gpuName = (adapter.info?.vendor || '') + ' ' + (adapter.info?.architecture || '');
    if (!gpuName.trim()) throw 0;
  } catch(_) {
    // fallback: some browsers don't expose adapter.info
  }
  state.renderer = gpuName.trim().slice(0, 36);
  $('v-gpu').textContent = state.renderer;

  const format = navigator.gpu.getPreferredCanvasFormat();
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('canvas webgpu context failed');

  // ── resize ──
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 0.5); // Optimization: render at half resolution to boost FPS
    W = Math.floor(window.innerWidth  * DPR);
    H = Math.floor(window.innerHeight * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    context.configure({
      device, format,
      alphaMode: 'opaque',
    });
    resizeGrain();
  }
  window.addEventListener('resize', resize);
  resize();

  // ── uniform buffer ──
  const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniformArray = new Float32Array(256 / 4);
  uniformArray.fill(0);

  // ── WGSL shader ──
  const shaderCode = getWGSLShader();
  const shader = device.createShaderModule({ code: shaderCode });

  // ── pipeline ──
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
    ],
  });

  // ── render loop ──
  let camTargetX = 0, camTargetY = 0;

  function frame(now) {
    const dt = (now - last) / 1000; last = now;
    acc += dt; frames++;
    if(acc >= 0.4){
      fpsEMA = frames / acc;
      fpsEl.textContent = fpsEMA.toFixed(0);
      msEl.textContent  = (1000 / Math.max(1, fpsEMA)).toFixed(1);
      itsEl.textContent = (fpsEMA * 90 * state.quality).toFixed(0);
      if (qualEl) qualEl.textContent = state.quality.toFixed(2);
      acc = 0; frames = 0;
    }

    if(state.auto){
      state.yaw   += dt * 0.18;
      state.pitch = Math.sin(now * 0.0002) * 0.4;
      state.camZ  = Math.sin(now * 0.00015) * 0.8;
    }
    camTargetX = smooth(camTargetX, state.yaw, 0.08);
    camTargetY = smooth(camTargetY, state.pitch, 0.08);

    const lvl = state.audioOn ? readAudio() : 0;
    state.audioLevel = smooth(state.audioLevel, lvl, 0.12);

    if(fpsEMA < 30) state.quality = clamp(state.quality - 0.1, 0.35, 1.0);
    else if(fpsEMA > 50) state.quality = clamp(state.quality + 0.02, 0.35, 1.0);

    // fill uniforms
    uniformArray[0] = W;
    uniformArray[1] = H;
    uniformArray[2] = now * 0.001;
    uniformArray[3] = state.zoom;
    uniformArray[4] = camTargetX;
    uniformArray[5] = camTargetY;
    uniformArray[6] = state.camZ;
    uniformArray[7] = state.pal;
    uniformArray[8] = state.scene;
    uniformArray[9] = 90 * state.quality;
    uniformArray[10] = state.detail;
    uniformArray[11] = state.audioLevel;
    device.queue.writeBuffer(uniformBuffer, 0, uniformArray.buffer, uniformArray.byteOffset, 256);

    // render pass
    const textureView = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);

    stepGrain();

    if (window.self !== window.top) {
      setTimeout(() => { animFrameId = requestAnimationFrame(frame); }, 100);
    } else {
      animFrameId = requestAnimationFrame(frame);
    }
  }

  animFrameId = requestAnimationFrame(frame);
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. WGSL Shader Source
// ────────────────────────────────────────────────────────────────────────────
function getWGSLShader() {
  return `
struct Uniforms {
  res: vec2<f32>,
  time: f32,
  zoom: f32,
  cam: vec3<f32>,
  pal: i32,
  g_scene: i32,
  steps: f32,
  detail: f32,
  audio: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VOut {
  @builtin(position) pos: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VOut {
  var out: VOut;
  let x = f32(i32(idx) - 1);
  let y = f32(i32(idx & 1u) * 2 - 1);
  out.pos = vec4<f32>(x, y, 0.0, 1.0);
  return out;
}

fn hash11(p: f32) -> f32 {
  var h = fract(p * 0.1031);
  h = h * (h + 33.33);
  h = h * (h + h);
  return fract(h);
}
fn hash21(p: vec2<f32>) -> f32 {
  var p3 = vec3<f32>(p.x, p.y, 0.0) * 0.1031;
  p3 = fract(p3);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
fn vnoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u2 = f * f * (3.0 - 2.0 * f);
  let a = mix(hash21(i + vec2<f32>(0.0, 0.0)), hash21(i + vec2<f32>(1.0, 0.0)), u2.x);
  let b = mix(hash21(i + vec2<f32>(0.0, 1.0)), hash21(i + vec2<f32>(1.0, 1.0)), u2.x);
  return mix(a, b, u2.y);
}

fn rotY(a: f32) -> mat2x2<f32> {
  let c = cos(a); let s = sin(a);
  return mat2x2<f32>(c, s, -s, c);
}
fn rotX(a: f32) -> mat2x2<f32> {
  let c = cos(a); let s = sin(a);
  return mat2x2<f32>(c, -s, s, c);
}

fn camPos() -> vec3<f32> {
  let r = mix(3.5, 6.0, 1.0 - clamp(u.zoom * 0.2, 0.0, 1.0));
  let th = u.cam.x;
  let ph = u.cam.y;
  let center = vec3<f32>(0.0, u.cam.z * 0.5, 0.0);
  return center + vec3<f32>(r * cos(ph) * cos(th), r * sin(ph), r * cos(ph) * sin(th));
}
fn lookAt(ro: vec3<f32>, ta: vec3<f32>) -> mat3x3<f32> {
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3<f32>(0.0, 1.0, 0.0)));
  let up = cross(rt, fw);
  return mat3x3<f32>(rt, up, fw);
}

fn deMandelbox(p_: vec3<f32>) -> f32 {
  var p = p_;
  let offset = p;
  var dr = 1.0;
  let scale = 2.5;
  for (var i = 0; i < 8; i++) {
    p = clamp(p, vec3<f32>(-1.0), vec3<f32>(1.0)) * 2.0 - p;
    let r2 = dot(p, p);
    if (r2 < 0.5) {
      p *= 4.0; dr *= 4.0 * scale;
    } else if (r2 < 1.0) {
      p /= r2; dr /= r2 * r2 * r2;
    }
    p = scale * p + offset;
    dr = dr * abs(scale) + 1.0;
  }
  return (length(p) - 0.001) / abs(dr);
}

fn deMandelbulb(p_: vec3<f32>) -> f32 {
  var z = p_;
  var dr = 1.0;
  var r = 0.0;
  let power = 8.0 + 1.0 * sin(u.time * 0.07);
  for (var i = 0; i < 7; i++) {
    r = length(z);
    if (r > 2.0) { break; }
    let th = acos(z.z / r);
    let ph = atan2(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;
    let zr = pow(r, power);
    let th2 = th * power;
    let ph2 = ph * power;
    z = zr * vec3<f32>(sin(th2) * cos(ph2), sin(th2) * sin(ph2), cos(th2)) + p_;
  }
  return 0.5 * log(r) * r / dr;
}

fn deKaleido(p_: vec3<f32>) -> f32 {
  var p = abs(p_) - 0.35;
  let m = rotY(u.time * 0.13);
  p.xz = m * p.xz;
  var d = length(p) - 0.5;
  for (var i = 0; i < 5; i++) {
    p = abs(p) - 0.25;
    let m1 = rotX(0.7);
    p.xy = m1 * p.xy;
    let m2 = rotY(0.7);
    p.yz = m2 * p.yz;
    d = min(d, length(p) - 0.3 - 0.05 * sin(u.time * 0.5));
  }
  return d;
}

fn deMenger(p_: vec3<f32>) -> f32 {
  var p = p_;
  var d = max(abs(p.x) - 1.0, max(abs(p.y) - 1.0, abs(p.z) - 1.0));
  var s = 1.0;
  for (var i = 0; i < 4; i++) {
    let a = (p * s) - 2.0 * floor((p * s) / 2.0) - 1.0;
    s *= 3.0;
    let r = abs(1.0 - 3.0 * abs(a));
    let c = (min(max(r.x, r.y), min(max(r.y, r.z), max(r.z, r.x))) - 1.0) / s;
    d = max(d, c);
  }
  return d;
}

fn deTunnel(p_: vec3<f32>) -> f32 {
  let q = p_.xy + 0.3 * vec2<f32>(sin(p_.z * 0.6 + u.time), cos(p_.z * 0.6 - u.time));
  var d = abs(length(q) - 1.25) - 0.25;
  d = max(d, abs(p_.z) - 12.0);
  return d;
}

fn deWraps(p_: vec3<f32>) -> f32 {
  var p = p_;
  let m1 = rotX(u.time * 0.15);
  p.xy = m1 * p.xy;
  let m2 = rotY(u.time * 0.11);
  p.xz = m2 * p.xz;
  var q = p;
  q = sin(q * 1.5 + u.time * 0.4);
  let d = length(q) - 1.1;
  return d * 0.6;
}

fn sceneDE(p: vec3<f32>) -> f32 {
  if (u.g_scene == 0) { return deMandelbox(p); }
  if (u.g_scene == 1) { return deMandelbulb(p); }
  if (u.g_scene == 2) { return deKaleido(p); }
  if (u.g_scene == 3) { return deMenger(p); }
  if (u.g_scene == 4) { return deTunnel(p); }
  return deWraps(p);
}

fn palCosmic(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p) + t * 0.3;
  let a = vec3<f32>(0.5); let b = vec3<f32>(0.5);
  let c = vec3<f32>(1.0); let d = vec3<f32>(0.0, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * k + d));
}
fn palLava(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p) + t * 0.5;
  let k4 = 0.5 + 0.5 * sin(k * 4.0);
  let k8 = 0.5 + 0.5 * sin(k * 8.0);
  return mix(vec3<f32>(0.05, 0.0, 0.0), vec3<f32>(1.0, 0.5, 0.05), k4)
       + 0.15 * vec3<f32>(1.0, 0.9, 0.6) * pow(k8, 8.0);
}
fn palVapor(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p.xy) + t * 0.4;
  return vec3<f32>(0.5 + 0.5 * sin(k * 3.0), 0.5 + 0.5 * sin(k * 3.0 + 2.0), 0.5 + 0.5 * sin(k * 3.0 + 4.0));
}
fn palOcean(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p) - t * 0.3;
  return mix(vec3<f32>(0.0, 0.1, 0.2), vec3<f32>(0.2, 0.8, 0.9), clamp(k * 0.5 + 0.5, 0.0, 1.0));
}
fn palPlasma(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = dot(p, vec3<f32>(0.3, 0.5, 0.7)) + t;
  return 0.5 + 0.5 * cos(6.28318 * k + vec3<f32>(0.0, 2.0, 4.0));
}
fn palMono(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p) * 0.6 + t * 0.2;
  return vec3<f32>(smoothstep(0.0, 1.0, k), smoothstep(0.0, 1.0, k * 1.2), smoothstep(0.0, 1.0, k * 1.4));
}
fn palBone(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p) + t * 0.4;
  return mix(vec3<f32>(0.95, 0.93, 0.85), vec3<f32>(0.3, 0.2, 0.15), clamp(k * 0.5 + 0.4, 0.0, 1.0));
}
fn palAcid(p: vec3<f32>, t: f32) -> vec3<f32> {
  let k = length(p) + t * 0.5;
  return mix(vec3<f32>(0.05, 0.4, 0.0), vec3<f32>(0.6, 1.0, 0.1), 0.5 + 0.5 * sin(k * 5.0));
}
fn doPal(p: vec3<f32>, t: f32) -> vec3<f32> {
  if (u.pal == 0) { return palCosmic(p, t); }
  if (u.pal == 1) { return palLava(p, t); }
  if (u.pal == 2) { return palVapor(p, t); }
  if (u.pal == 3) { return palOcean(p, t); }
  if (u.pal == 4) { return palPlasma(p, t); }
  if (u.pal == 5) { return palMono(p, t); }
  if (u.pal == 6) { return palBone(p, t); }
  return palAcid(p, t);
}

fn march(ro: vec3<f32>, rd: vec3<f32>, pos: ptr<function, vec3<f32>>) -> f32 {
  var t: f32 = 0.0;
  for (var i = 0; i < 160; i++) {
    if (f32(i) >= u.steps) { break; }
    *pos = ro + rd * t;
    let d = sceneDE(*pos);
    if (d < 0.001 * u.detail) { return t; }
    if (t > 30.0) { break; }
    t += d * select(1.0, 1.0 - 0.25 * u.audio, u.audio > 0.0);
  }
  return -1.0;
}
fn calcNormal(p: vec3<f32>) -> vec3<f32> {
  let e = vec2<f32>(0.001, 0.0);
  return normalize(vec3<f32>(
    sceneDE(p + e.xyy) - sceneDE(p - e.xyy),
    sceneDE(p + e.yxy) - sceneDE(p - e.yxy),
    sceneDE(p + e.yyx) - sceneDE(p - e.yyx)));
}
fn calcAO(p: vec3<f32>, n: vec3<f32>) -> f32 {
  var a = 0.0; var w = 1.0;
  for (var i = 1; i < 4; i++) {
    let d = 0.02 * f32(i);
    a += w * (d - sceneDE(p + n * d));
    w *= 0.7;
  }
  return clamp(1.0 - 1.5 * a, 0.0, 1.0);
}
fn calcShadow(ro: vec3<f32>, rd: vec3<f32>) -> f32 {
  var res = 1.0; var t = 0.05;
  for (var i = 0; i < 20; i++) {
    let h = sceneDE(ro + rd * t);
    if (h < 0.0001) { return 0.0; }
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.02, 0.4);
    if (t > 6.0) { break; }
  }
  return clamp(res, 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = (pos.xy - 0.5 * u.res.xy) / u.res.y;

  let ro = camPos();
  let ta = vec3<f32>(0.0, u.cam.z * 0.5, 0.0);
  let camMat = lookAt(ro, ta);
  let rd = normalize(camMat * vec3<f32>(uv, 1.4));

  var sky = mix(vec3<f32>(0.02, 0.02, 0.04), vec3<f32>(0.12, 0.10, 0.18), smoothstep(-0.2, 0.6, rd.y));
  sky += 0.06 * vec3<f32>(1.0, 0.6, 0.4) * pow(max(0.0, dot(rd, normalize(vec3<f32>(0.4, 0.2, 0.6)))), 32.0);

  var col = sky;
  var hitPos = vec3<f32>(0.0);
  let t = march(ro, rd, &hitPos);
  if (t > 0.0) {
    let n = calcNormal(hitPos);
    let ld = normalize(vec3<f32>(0.6, 0.8, 0.4));
    let diff = max(0.0, dot(n, ld));
    let sh = calcShadow(hitPos + n * 0.002, ld);
    let occ = calcAO(hitPos, n);
    let fres = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);

    var base = doPal(hitPos * 0.5, u.time * 0.05 + f32(u.g_scene) * 0.13);
    var lit = base * (0.25 + 0.75 * diff * sh) * occ;
    var spec = vec3<f32>(1.0, 0.9, 0.8) * pow(max(0.0, dot(reflect(-ld, n), -rd)), 24.0) * sh;
    var refl = sky * fres * 0.6;
    col = lit + spec + refl;

    let fog = 1.0 - exp(-0.04 * t * t);
    col = mix(col, sky, fog);
    col += vec3<f32>(1.0, 0.4, 0.2) * fres * 0.4;
  }

  var dust = 0.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i) / 3.0;
    let dp = ro + rd * mix(0.4, 6.0, fi);
    dust += 0.012 * vnoise(dp.xy * 4.0 + u.time * 0.3) * (1.0 - fi);
  }
  col += vec3<f32>(0.9, 0.7, 0.5) * dust * (0.3 + 0.7 * u.audio);

  let g = (hash21(pos.xy + u.time) - 0.5) * 0.04;
  col += g;
  col = col / (col + 1.0);
  col = pow(col, vec3<f32>(1.0 / 2.2));

  let v = (pos.xy / u.res.xy) - 0.5;
  col *= 1.0 - dot(v, v) * 1.2;

  return vec4<f32>(col, 1.0);
}
`;
}

// ────────────────────────────────────────────────────────────────────────────
// 8. WebGL2 Renderer (fallback path)
// ────────────────────────────────────────────────────────────────────────────
function initWebGL2(canvas) {
  const glOpts = {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };

  let gl = canvas.getContext('webgl2', glOpts);
  if (!gl) {
    gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' });
  }
  if (!gl) {
    $('v-gpu').textContent = 'no webgl2';
    return false;
  }

  const gpuStr = (gl.getParameter(gl.RENDERER) || 'unknown gpu').slice(0, 36);
  state.renderer = gpuStr;
  $('v-gpu').textContent = gpuStr;

  const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2  u_res;
uniform float u_time;
uniform float u_zoom;
uniform vec3  u_cam;
uniform int   u_pal;
uniform float u_steps;
uniform float u_detail;
uniform float u_audio;
uniform int   g_scene;

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u2=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i+vec2(0,0)),hash21(i+vec2(1,0)),u2.x),
             mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),u2.x), u2.y);
}
mat2 rotY(float a){ float c=cos(a),s=sin(a); return mat2(c,s,-s,c); }
mat2 rotX(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

vec3 camPos(){
  float r = mix(3.5, 6.0, 1.0 - clamp(u_zoom*0.2, 0.0, 1.0));
  float th = u_cam.x, ph = u_cam.y;
  vec3 center = vec3(0.0, u_cam.z * 0.5, 0.0);
  return center + vec3(r*cos(ph)*cos(th), r*sin(ph), r*cos(ph)*sin(th));
}
mat3 lookAt(vec3 ro, vec3 ta){
  vec3 fw=normalize(ta-ro), rt=normalize(cross(fw,vec3(0.,1.,0.))), up=cross(rt,fw);
  return mat3(rt,up,fw);
}

float deMandelbox(vec3 p){
  vec3 offset = p; float dr = 1.0; float scale = 2.5;
  for(int i=0;i<8;i++){
    p = clamp(p, -1.0, 1.0) * 2.0 - p;
    float r2 = dot(p,p);
    if(r2 < 0.5){ p *= 4.0; dr *= 4.0*scale; } else
    if(r2 < 1.0){ p /= r2; dr /= r2*r2*r2; }
    p = scale*p + offset;
    dr = dr*abs(scale) + 1.0;
  }
  return (length(p) - 0.001) / abs(dr);
}
float deMandelbulb(vec3 p){
  vec3 z = p; float dr = 1.0; float r = 0.0; float power = 8.0 + 1.0*sin(u_time*0.07);
  for(int i=0;i<7;i++){
    r = length(z);
    if(r > 2.0) break;
    float th = acos(z.z/r), ph = atan(z.y, z.x);
    dr = pow(r, power-1.0)*power*dr + 1.0;
    float zr = pow(r, power);
    th *= power; ph *= power;
    z = zr*vec3(sin(th)*cos(ph), sin(th)*sin(ph), cos(th)) + p;
  }
  return 0.5*log(r)*r/dr;
}
float deKaleido(vec3 p){
  p = abs(p) - 0.35;
  p.xz *= rotY(u_time*0.13);
  float d = length(p) - 0.5;
  for(int i=0;i<5;i++){
    p = abs(p) - 0.25;
    p.xy *= rotX(0.7); p.yz *= rotY(0.7);
    d = min(d, length(p) - 0.3 - 0.05*sin(u_time*0.5));
  }
  return d;
}
float deMenger(vec3 p){
  float d = max(abs(p.x)-1.0, max(abs(p.y)-1.0, abs(p.z)-1.0));
  float s = 1.0;
  for(int i=0;i<4;i++){
    vec3 a = mod(p*s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0*abs(a));
    float c = (min(max(r.x, r.y), min(max(r.y, r.z), max(r.z, r.x))) - 1.0) / s;
    d = max(d, c);
  }
  return d;
}
float deTunnel(vec3 p){
  vec2 q = p.xy + 0.3*vec2(sin(p.z*0.6 + u_time), cos(p.z*0.6 - u_time));
  float d = abs(length(q) - 1.25) - 0.25;
  d = max(d, abs(p.z) - 12.0);
  return d;
}
float deWraps(vec3 p){
  p.xy *= rotX(u_time*0.15);
  p.xz *= rotY(u_time*0.11);
  vec3 q = p;
  q = sin(q*1.5 + u_time*0.4);
  float d = length(q) - 1.1;
  return d*0.6;
}
float sceneDE(vec3 p){
  if(g_scene==0) return deMandelbox(p);
  if(g_scene==1) return deMandelbulb(p);
  if(g_scene==2) return deKaleido(p);
  if(g_scene==3) return deMenger(p);
  if(g_scene==4) return deTunnel(p);
  return deWraps(p);
}

vec3 palCosmic(vec3 p, float t){
  float k = length(p) + t*0.3;
  vec3 a = vec3(0.5); vec3 b = vec3(0.5); vec3 c = vec3(1.0); vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b*cos(6.28318*(c*k + d));
}
vec3 palLava(vec3 p, float t){
  float k = length(p) + t*0.5;
  return mix(vec3(0.05,0.0,0.0), vec3(1.0,0.5,0.05), 0.5+0.5*sin(k*4.0))
       + 0.15*vec3(1.0,0.9,0.6)*pow(0.5+0.5*sin(k*8.0), 8.0);
}
vec3 palVapor(vec3 p, float t){
  float k = length(p.xy) + t*0.4;
  return vec3(0.5+0.5*sin(k*3.0), 0.5+0.5*sin(k*3.0+2.0), 0.5+0.5*sin(k*3.0+4.0));
}
vec3 palOcean(vec3 p, float t){
  float k = length(p) - t*0.3;
  return mix(vec3(0.0,0.1,0.2), vec3(0.2,0.8,0.9), clamp(k*0.5+0.5, 0.0, 1.0));
}
vec3 palPlasma(vec3 p, float t){
  float k = dot(p, vec3(0.3,0.5,0.7)) + t;
  return 0.5 + 0.5*cos(6.28318*k + vec3(0.0, 2.0, 4.0));
}
vec3 palMono(vec3 p, float t){
  float k = length(p)*0.6 + t*0.2;
  return vec3(smoothstep(0.0,1.0,k), smoothstep(0.0,1.0,k*1.2), smoothstep(0.0,1.0,k*1.4));
}
vec3 palBone(vec3 p, float t){
  float k = length(p) + t*0.4;
  return mix(vec3(0.95,0.93,0.85), vec3(0.3,0.2,0.15), clamp(k*0.5+0.4, 0.0, 1.0));
}
vec3 palAcid(vec3 p, float t){
  float k = length(p) + t*0.5;
  return mix(vec3(0.05,0.4,0.0), vec3(0.6,1.0,0.1), 0.5+0.5*sin(k*5.0));
}
vec3 doPal(vec3 p, float t){
  if(u_pal==0) return palCosmic(p,t);
  if(u_pal==1) return palLava(p,t);
  if(u_pal==2) return palVapor(p,t);
  if(u_pal==3) return palOcean(p,t);
  if(u_pal==4) return palPlasma(p,t);
  if(u_pal==5) return palMono(p,t);
  if(u_pal==6) return palBone(p,t);
  return palAcid(p,t);
}

float march(vec3 ro, vec3 rd, out vec3 pos){
  float t = 0.0;
  for(int i=0;i<160;i++){
    if(float(i) >= u_steps) break;
    pos = ro + rd*t;
    float d = sceneDE(pos);
    if(d < 0.001*u_detail) return t;
    if(t > 30.0) break;
    t += d * (u_audio > 0.0 ? (1.0 - 0.25*u_audio) : 1.0);
  }
  return -1.0;
}
vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    sceneDE(p+vec3(e.x, e.y, 0.0)) - sceneDE(p-vec3(e.x, e.y, 0.0)),
    sceneDE(p+vec3(e.y, e.x, 0.0)) - sceneDE(p-vec3(e.y, e.x, 0.0)),
    sceneDE(p+vec3(e.y, 0.0, e.x)) - sceneDE(p-vec3(e.y, 0.0, e.x))));
}
float calcAO(vec3 p, vec3 n){
  float a=0.0, w=1.0;
  for(int i=1;i<4;i++){
    float d = 0.02*float(i);
    a += w*(d - sceneDE(p + n*d));
    w *= 0.7;
  }
  return clamp(1.0 - 1.5*a, 0.0, 1.0);
}
float calcShadow(vec3 ro, vec3 rd){
  float res=1.0, t=0.05;
  for(int i=0;i<20;i++){
    float h = sceneDE(ro + rd*t);
    if(h<0.0001) return 0.0;
    res = min(res, 8.0*h/t);
    t += clamp(h, 0.02, 0.4);
    if(t>6.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res.xy) / u_res.y;
  vec3 ro = camPos();
  vec3 ta = vec3(0.0, u_cam.z * 0.5, 0.0);
  mat3 cam = lookAt(ro, ta);
  vec3 rd = normalize(cam * vec3(uv, 1.4));

  vec3 sky = mix(vec3(0.02,0.02,0.04), vec3(0.12,0.10,0.18), smoothstep(-0.2, 0.6, rd.y));
  sky += 0.06*vec3(1.0,0.6,0.4) * pow(max(0.0, dot(rd, normalize(vec3(0.4,0.2,0.6)))), 32.0);

  vec3 col = sky;
  vec3 pos;
  float t = march(ro, rd, pos);
  if(t > 0.0){
    vec3 n = calcNormal(pos);
    vec3 ld = normalize(vec3(0.6, 0.8, 0.4));
    float diff = max(0.0, dot(n, ld));
    float sh = calcShadow(pos + n*0.002, ld);
    float occ = calcAO(pos, n);
    float fres = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);

    vec3 base = doPal(pos*0.5, u_time*0.05 + float(g_scene)*0.13);
    vec3 lit  = base * (0.25 + 0.75*diff*sh) * occ;
    vec3 spec = vec3(1.0, 0.9, 0.8) * pow(max(0.0, dot(reflect(-ld, n), -rd)), 24.0) * sh;
    vec3 refl = sky * fres * 0.6;
    col = lit + spec + refl;

    float fog = 1.0 - exp(-0.04*t*t);
    col = mix(col, sky, fog);
    col += vec3(1.0, 0.4, 0.2) * fres * 0.4;
  }

  float dust = 0.0;
  for(int i=0;i<3;i++){
    float fi = float(i)/3.0;
    vec3 p = ro + rd*mix(0.4, 6.0, fi);
    dust += 0.012 * vnoise(p.xy*4.0 + u_time*0.3) * (1.0 - fi);
  }
  col += vec3(0.9, 0.7, 0.5) * dust * (0.3 + 0.7*u_audio);

  float g = (hash21(gl_FragCoord.xy + u_time) - 0.5) * 0.04;
  col += g;
  col = col / (col + 1.0);
  col = pow(col, vec3(1.0/2.2));

  vec2 v = (gl_FragCoord.xy / u_res.xy) - 0.5;
  col *= 1.0 - dot(v, v) * 1.2;

  outColor = vec4(col, 1.0);
}
`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      const log = gl.getShaderInfoLog(s);
      console.error('shader compile error:\n' + log);
      throw new Error('shader compile: ' + log);
    }
    return s;
  }
  function link(vs, fs){
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      const log = gl.getProgramInfoLog(p);
      throw new Error('program link: ' + log);
    }
    return p;
  }

  const prog = link(compile(gl.VERTEX_SHADER, VS), compile(gl.FRAGMENT_SHADER, FS));
  gl.useProgram(prog);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1, 1,
     1,-1,  1, 1,  -1, 1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uLocs = {
    res:    gl.getUniformLocation(prog, 'u_res'),
    time:   gl.getUniformLocation(prog, 'u_time'),
    zoom:   gl.getUniformLocation(prog, 'u_zoom'),
    cam:    gl.getUniformLocation(prog, 'u_cam'),
    pal:    gl.getUniformLocation(prog, 'u_pal'),
    steps:   gl.getUniformLocation(prog, 'u_steps'),
    detail: gl.getUniformLocation(prog, 'u_detail'),
    audio:  gl.getUniformLocation(prog, 'u_audio'),
    scene:  gl.getUniformLocation(prog, 'g_scene'),
  };
  gl.uniform1i(uLocs.scene, 0);

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 0.5); // Optimization: render at half resolution to boost FPS
    W = Math.floor(window.innerWidth  * DPR);
    H = Math.floor(window.innerHeight * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uLocs.res, W, H);
    resizeGrain();
  }
  window.addEventListener('resize', resize);
  resize();

  let camTargetX = 0, camTargetY = 0;

  function frame(now) {
    const dt = (now - last) / 1000; last = now;
    acc += dt; frames++;
    if(acc >= 0.4){
      fpsEMA = frames / acc;
      fpsEl.textContent = fpsEMA.toFixed(0);
      msEl.textContent  = (1000 / Math.max(1, fpsEMA)).toFixed(1);
      itsEl.textContent = (fpsEMA * 90 * state.quality).toFixed(0);
      if (qualEl) qualEl.textContent = state.quality.toFixed(2);
      acc = 0; frames = 0;
    }

    if(state.auto){
      state.yaw   += dt * 0.18;
      state.pitch = Math.sin(now * 0.0002) * 0.4;
      state.camZ  = Math.sin(now * 0.00015) * 0.8;
    }
    camTargetX = smooth(camTargetX, state.yaw, 0.08);
    camTargetY = smooth(camTargetY, state.pitch, 0.08);

    const lvl = state.audioOn ? readAudio() : 0;
    state.audioLevel = smooth(state.audioLevel, lvl, 0.12);

    if(fpsEMA < 30) state.quality = clamp(state.quality - 0.1, 0.35, 1.0);
    else if(fpsEMA > 50) state.quality = clamp(state.quality + 0.02, 0.35, 1.0);

    gl.uniform1f(uLocs.time,  now * 0.001);
    gl.uniform1f(uLocs.zoom,  state.zoom);
    gl.uniform3f(uLocs.cam,   camTargetX, camTargetY, state.camZ);
    gl.uniform1i(uLocs.pal,   state.pal);
    gl.uniform1f(uLocs.steps, 90 * state.quality);
    gl.uniform1f(uLocs.detail, state.detail);
    gl.uniform1f(uLocs.audio, state.audioLevel);
    gl.uniform1i(uLocs.scene, state.scene);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    stepGrain();

    if (window.self !== window.top) {
      setTimeout(() => { animFrameId = requestAnimationFrame(frame); }, 100);
    } else {
      animFrameId = requestAnimationFrame(frame);
    }
  }

  animFrameId = requestAnimationFrame(frame);
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// 9. boot — try WebGPU first, WebGL2 fallback
// ────────────────────────────────────────────────────────────────────────────
const canvas = $('c');
setupControls(canvas);

async function startRenderer() {
  let ok = false;

  // WebGPU first — maps to Vulkan/D3D12/Metal = REAL GPU, not WebGL software fallback
  if (navigator.gpu) {
    try {
      ok = await initWebGPU(canvas);
      if (ok) console.log('[limits] using WebGPU (' + state.renderer + ')');
    } catch (e) {
      console.warn('[limits] WebGPU failed, falling back to WebGL2:', e.message);
    }
  }

  if (!ok) {
    ok = initWebGL2(canvas);
    if (ok) console.log('[limits] using WebGL2 (' + state.renderer + ')');
  }

  if (!ok) {
    document.body.innerHTML =
      '<div style="color:#e8e6df;font:14px ui-monospace,monospace;padding:24px;">' +
      'this scene needs WebGPU or WebGL 2.0. your browser/device does not have either.</div>';
    throw new Error('no render path available');
  }
}

setScene(0);

// expose for debug
window.LIMITS = { state };