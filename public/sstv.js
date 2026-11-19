// Robot 36: 320 × 240, VIS 8, 150 ms per line. Times are in milliseconds.
export const W = 320, H = 240, RATE = 48000;
const clamp = x => Math.max(0, Math.min(255, x));
const tone = x => 1500 + clamp(x) * 800 / 255;
const level = f => clamp((f - 1500) * 255 / 800);
const bits = [1200, 1300, 1300, 1300, 1100, 1300, 1300, 1300, 1100, 1200];

export function encode(rgba, rate = RATE) {
  if (rgba.length !== W * H * 4) throw new Error('Expected a 320 × 240 image.');
  const audio = new Float32Array(Math.ceil(rate * 36.94));
  let time = 0, n = 0, phase = 0;
  function emit(f, ms) {
    time += ms;
    const end = Math.round(time * rate / 1000), step = 2 * Math.PI * f / rate;
    while (n < end) {
      audio[n++] = 0.65 * Math.sin(phase);
      phase = (phase + step) % (2 * Math.PI);
    }
  }
  function colour(x, y) {
    const i = (y * W + x) * 4, [r,g,b] = rgba.subarray(i, i+3);
    return [0.299*r + 0.587*g + 0.114*b, 128 + 0.5*r - 0.418688*g - 0.081312*b, 128 - 0.168736*r - 0.331264*g + 0.5*b];
  }
  emit(1900, 300); emit(1200, 10); emit(1900, 300);
  for (const f of bits) emit(f, 30);
  for (let y = 0; y < H; y++) {
    emit(1200, 9); emit(1500, 3);
    for (let x = 0; x < W; x++) emit(tone(colour(x,y)[0]), 88/W);
    emit(y % 2 ? 2300 : 1500, 4.5); emit(1900, 1.5);
    const c = y % 2 ? 2 : 1, a = y & ~1;
    for (let x = 0; x < W; x++) emit(tone((colour(x,a)[c]+colour(x,a+1)[c])/2), 44/W);
  }
  emit(1900, 20); // Give live receivers time to finish the final row.
  return audio;
}

export function wav(samples, rate = RATE) {
  const b = new ArrayBuffer(44 + samples.length*2), v = new DataView(b);
  const str = (p,s) => [...s].forEach((c,i) => v.setUint8(p+i,c.charCodeAt(0)));
  str(0,'RIFF'); v.setUint32(4,b.byteLength-8,true); str(8,'WAVE'); str(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,rate,true); v.setUint32(28,rate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  str(36,'data'); v.setUint32(40,samples.length*2,true);
  samples.forEach((s,i) => v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,s))*32767),true));
  return b;
}

// Estimate the instantaneous frequency from interpolated zero crossings.
// This compact decoder prefers clean, close-range audio over noisy radio signals.
export class Decoder {
  constructor(rate, onRows = () => {}) {
    this.rate = rate; this.onRows = onRows;
    this.f = new Float32Array(Math.ceil(rate*90));
    this.image = new Uint8ClampedArray(W*H*4);
    this.n = 0; this.ready = 0; this.cross = -1; this.prev = 0; this.dc = 0;
    this.search = 0; this.leader = 0; this.gap = 0; this.candidate = null;
    this.start = null; this.rows = 0; this.done = false;
  }
  push(samples) {
    if (this.done) return;
    const f = this.f, rate = this.rate;
    for (const raw of samples) {
      if (this.n >= f.length) { this.done = true; throw new Error('No complete image within 90 seconds. Try again.'); }
      const i = this.n++;
      this.dc += 0.003 * (raw-this.dc);
      const s = raw-this.dc, p = this.prev;
      if ((p < 0 && s >= 0) || (p > 0 && s <= 0)) {
        const t = i-1 + p/(p-s), d = t-this.cross;
        if (this.cross >= 0) {
          const hz = rate/(2*d);
          f.fill(hz >= 700 && hz <= 3500 ? hz : 0, Math.max(0,Math.ceil(this.cross)),Math.ceil(t));
          this.ready = Math.ceil(t);
        }
        this.cross = t;
      }
      this.prev = s;
    }
    this.read();
  }
  at(t) { return this.f[Math.round(t*this.rate/1000)] || 0; }
  mean(t, ms) {
    let sum = 0, count = 0;
    for (let i = Math.max(0,Math.round(t*this.rate/1000)); i < Math.round((t+ms)*this.rate/1000); i++) {
      sum += this.f[i] || 0; count++;
    }
    return count ? sum/count : 0;
  }
  read() {
    const available = this.ready*1000/this.rate;
    while (this.start === null && this.search+1 < available) {
      if (this.candidate !== null) {
        const t = this.candidate;
        if (available < t+302) return;
        const valid = bits.every((hz,i) => Math.abs(this.mean(t+i*30+7,16)-hz)<65);
        if (valid) { this.start = t+300; break; }
        this.candidate = null;
      }
      const t = this.search++, hz = this.mean(t,1);
      if (Math.abs(hz-1900)<100) { this.leader++; this.gap=0; }
      else if (this.leader >= 180 && Math.abs(hz-1200)<100) {
        this.candidate=t; this.leader=0; this.gap=0;
      } else if (++this.gap > 3) this.leader=0;
    }
    while (this.start !== null && this.rows < H && available >= this.start+154) {
      // Refine each sync-to-porch edge to limit horizontal drift.
      const expected = this.start+9;
      let edge = expected, best = -Infinity;
      for (let t=expected-4; t<=expected+4; t+=0.1) {
        const score = -Math.abs(this.mean(t-4,3)-1200)-Math.abs(this.mean(t+0.4,1.5)-1500);
        if (score > best) { best=score; edge=t; }
      }
      const start = best > -200 ? edge-9 : this.start;
      const y = new Float32Array(W), c = new Float32Array(W);
      for (let x=0;x<W;x++) {
        y[x]=level(this.at(start+12+(x+0.5)*88/W));
        c[x]=level(this.at(start+106+(x+0.5)*44/W))-128;
      }
      if (this.rows % 2 === 0) { this.y = y; this.cr = c; }
      else {
        for (let k=0;k<2;k++) for (let x=0;x<W;x++) {
          const l=k?y[x]:this.y[x], cr=this.cr[x], cb=c[x], i=((this.rows-1+k)*W+x)*4;
          this.image[i]=l+1.402*cr; this.image[i+1]=l-0.714136*cr-0.344136*cb;
          this.image[i+2]=l+1.772*cb; this.image[i+3]=255;
        }
        this.onRows(this.image,this.rows+1);
      }
      this.rows++; this.start=start+150;
    }
    if (this.rows === H) this.done=true;
  }
  finish() {
    // Add a short tone so the last samples can be processed after the final scan.
    this.push(Float32Array.from({length:Math.ceil(this.rate*0.02)},(_,i)=>0.1*Math.sin(i*2*Math.PI*1900/this.rate)));
    return this.rows;
  }
}
