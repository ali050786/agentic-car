import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * A dependency-free WebGL "silk aurora": domain-warped fbm noise mapped onto
 * the landing palette. It is ~2KB of GLSL instead of pulling in three.js for a
 * single full-screen quad.
 *
 * Perf guards: renders at a reduced resolution, pauses when off-screen or when
 * the tab is hidden, and draws a single still frame for reduced-motion users.
 * Falls back to CSS gradients if WebGL is unavailable.
 */

const VERT = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uFade;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
  float t = uTime * 0.045;
  vec2 m = (uMouse - 0.5) * 0.35;

  vec2 q = vec2(fbm(p * 1.4 + vec2(0.0, t)), fbm(p * 1.4 + vec2(5.2, -t)));
  vec2 r = vec2(fbm(p * 1.8 + 3.0 * q + vec2(1.7 + m.x, 9.2) + t * 1.3), fbm(p * 1.8 + 3.0 * q + vec2(8.3, 2.8 + m.y) - t));
  float f = fbm(p * 1.6 + 2.6 * r);

  vec3 ink    = vec3(0.024, 0.024, 0.04);
  vec3 blue   = vec3(0.31, 0.55, 1.0);
  vec3 violet = vec3(0.61, 0.42, 1.0);
  vec3 cyan   = vec3(0.24, 0.90, 0.96);
  vec3 coral  = vec3(1.0, 0.48, 0.54);

  vec3 col = mix(ink, blue, smoothstep(0.25, 0.85, f) * 0.85);
  col = mix(col, violet, smoothstep(0.35, 1.0, length(q)) * 0.7);
  col = mix(col, cyan, smoothstep(0.62, 0.95, r.x) * 0.45);
  col = mix(col, coral, smoothstep(0.7, 1.0, r.y * f * 1.6) * 0.35);

  // Silk highlights along the warp field
  float silk = pow(abs(sin((f + r.x) * 9.0 + t * 4.0)), 18.0);
  col += silk * 0.12 * mix(cyan, violet, uv.x);

  // Fade into the page: strongest at the top, gone toward the bottom and edges
  float fade = mix(1.0, smoothstep(0.0, 0.75, uv.y) * (1.0 - 0.55 * pow(abs(uv.x - 0.5) * 2.0, 2.0)), uFade);
  col = mix(ink, col, fade * 0.95);

  // Vignette + gentle dithering to avoid banding
  col *= 0.85 + 0.15 * smoothstep(1.2, 0.2, length(p));
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** `fade`: 1 = dissolve toward the bottom/edges (hero), 0 = fill the whole box (CTA panels). */
export const ShaderBackdrop: React.FC<{ className?: string; intensity?: number; fade?: number }> = ({ className = '', intensity = 1, fade = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) { setFailed(true); return; }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[ShaderBackdrop]', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { setFailed(true); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setFailed(true); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    gl.uniform1f(gl.getUniformLocation(prog, 'uFade'), fade);

    const scale = 0.5; // render at half-res; the output is soft anyway
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    let raf = 0;
    const start = performance.now() - 20000; // start mid-flow, not at t=0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (reduce) {
      gl.uniform1f(uTime, 24);
      gl.uniform2f(uMouse, 0.5, 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      // Free GPU objects but keep the context: StrictMode re-runs this effect on
      // the same canvas, and a lost context cannot be recovered.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [reduce, fade]);

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true" style={{ opacity: intensity }}>
      {failed ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 10%, rgba(79,140,255,0.35), transparent 70%), radial-gradient(50% 45% at 75% 5%, rgba(155,107,255,0.3), transparent 70%), radial-gradient(40% 30% at 55% 30%, rgba(62,230,245,0.12), transparent 70%)',
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      )}
    </div>
  );
};
