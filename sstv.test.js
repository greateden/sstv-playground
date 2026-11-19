import test from 'node:test';
import assert from 'node:assert/strict';
import { W,H,encode,wav,Decoder } from './public/sstv.js';
const palette=[[255,255,255],[255,255,0],[0,255,255],[0,255,0],[255,0,255],[255,0,0],[0,0,255],[0,0,0]];
const pixels=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++)pixels.set([...palette[Math.floor(x/40)],255],(y*W+x)*4);
for(const rate of [44100,48000])for(const delay of [0,0.1234,0.333333,0.5123])test(`Robot 36 round trip at ${rate} Hz, delay ${delay}s`,()=>{
  const samples=encode(pixels,rate);
  const d=new Decoder(rate);
  d.push(new Float32Array(Math.round(rate*delay)));
  for(let i=0;i<samples.length;i+=2048)d.push(samples.subarray(i,i+2048));
  assert.equal(d.rows,H); assert.equal(d.done,true);
  let error=0,n=0;
  for(let y=0;y<H;y+=7)for(let x=20;x<W;x+=40)for(let c=0;c<3;c++){const i=(y*W+x)*4+c;error+=Math.abs(d.image[i]-pixels[i]);n++;}
  assert.ok(error/n<12,`Mean colour error: ${error/n}`);
});
test('WAV header and duration',()=>{const a=encode(pixels);const b=wav(a);const v=new DataView(b);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint32(40,true),a.length*2);assert.equal(a.length,1773120);});
