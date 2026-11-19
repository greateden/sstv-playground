import { W,H,RATE,encode,wav,Decoder } from './sstv.js';
const $ = id => document.getElementById(id);
const source=$('source').getContext('2d',{willReadFrequently:true}), received=$('received').getContext('2d');
const colours=['#fff','#ff0','#0ff','#0f0','#f0f','#f00','#00f','#111'];
colours.forEach((c,i)=>{source.fillStyle=c;source.fillRect(i*40,0,40,240);});
source.fillStyle='#121714';source.fillRect(35,78,250,84);source.fillStyle='#fff';source.font='25px Georgia';source.textAlign='center';source.fillText('Hello, world.',160,112);source.font='12px monospace';source.fillText('ROBOT 36 / SSTV',160,139);
let samples, url, session=null, busy=false;
function signal(){return samples ??= encode(source.getImageData(0,0,W,H).data);}
function audioURL(){return url ??= URL.createObjectURL(new Blob([wav(signal())],{type:'audio/wav'}));}
$('image').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const u=URL.createObjectURL(file), img=new Image();
  try{img.src=u;await img.decode();const scale=Math.min(W/img.width,H/img.height);source.fillStyle='#000';source.fillRect(0,0,W,H);source.drawImage(img,(W-img.width*scale)/2,(H-img.height*scale)/2,img.width*scale,img.height*scale);$('player').pause();$('player').removeAttribute('src');$('player').load();if(url)URL.revokeObjectURL(url);url=samples=null;$('tx').textContent='Image ready.';}catch(err){$('tx').textContent=err.message;}finally{URL.revokeObjectURL(u);}
};
$('play').onclick=async()=>{try{const p=$('player');if(!p.getAttribute('src'))p.src=audioURL();p.currentTime=0;await p.play();$('tx').textContent='Transmitting…';}catch(e){$('tx').textContent=e.message;}};
$('player').onended=()=>{$('tx').textContent='Transmission finished.';};
function save(href,name){const a=document.createElement('a');a.href=href;a.download=name;a.click();}
$('save').onclick=()=>save(audioURL(),'robot36.wav');
$('download').onclick=()=>save($('received').toDataURL('image/png'),'received.png');
function newDecoder(rate){received.clearRect(0,0,W,H);$('progress').value=0;$('download').disabled=true;return new Decoder(rate,(pixels,rows)=>{received.putImageData(new ImageData(pixels,W,H),0,0);$('progress').value=rows;$('rx').textContent=`Received ${rows} of ${H} rows.`;$('download').disabled=false;});}
function controls(active){busy=active;$('listen').disabled=$('loop').disabled=$('audio').disabled=active;$('stop').disabled=!session;}
async function stop(message){const s=session;session=null;if(s){s.node?.disconnect();s.stream?.getTracks().forEach(t=>t.stop());if(s.ctx.state!=='closed')await s.ctx.close();}controls(false);if(message)$('rx').textContent=message;}
$('stop').onclick=()=>stop('Reception stopped.');
$('listen').onclick=async()=>{
  if(busy)return;
  if(!navigator.mediaDevices?.getUserMedia){$('rx').textContent='Microphone needs HTTPS or localhost. See the README for phone setup.';return;}
  controls(true);
  try{
    const ctx=new AudioContext();session={ctx};await ctx.resume();
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});session.stream=stream;
    await ctx.audioWorklet.addModule('mic.js');const node=new AudioWorkletNode(ctx,'capture');session.node=node;
    const decoder=newDecoder(ctx.sampleRate), filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1750;filter.Q.value=0.7;
    node.port.onmessage=e=>{if(session?.node!==node)return;try{decoder.push(e.data);if(decoder.done)void stop('Image received.');}catch(err){void stop(err.message);}};
    ctx.createMediaStreamSource(stream).connect(filter).connect(node);node.connect(ctx.destination);$('stop').disabled=false;$('rx').textContent='Listening for Robot 36…';
  }catch(e){await stop(e.message);}
};
async function decode(samples,rate){const d=newDecoder(rate);for(let i=0;i<samples.length&&!d.done;i+=Math.round(rate/4)){d.push(samples.subarray(i,i+Math.round(rate/4)));await new Promise(r=>setTimeout(r,0));}d.finish();$('rx').textContent=d.done&&d.rows===H?'Image received.':`Incomplete signal: ${d.rows} of ${H} rows.`;}
$('loop').onclick=async()=>{if(busy)return;controls(true);try{await decode(signal(),RATE);}catch(e){$('rx').textContent=e.message;}finally{controls(false);}};
$('audio').onchange=async e=>{const file=e.target.files[0];if(!file||busy)return;controls(true);let ctx;try{if(file.size>30*1024*1024)throw new Error('Choose an audio file under 30 MB.');ctx=new AudioContext();const audio=await ctx.decodeAudioData(await file.arrayBuffer());await decode(audio.getChannelData(0),audio.sampleRate);}catch(err){$('rx').textContent=err.message;}finally{if(ctx)await ctx.close();controls(false);e.target.value='';}};
