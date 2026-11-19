// Send small blocks to the decoder without forwarding microphone sound to speakers.
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.block = new Float32Array(2048); this.used=0; }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples) for (const s of samples) {
      this.block[this.used++]=s;
      if (this.used===this.block.length) {
        this.port.postMessage(this.block,[this.block.buffer]);
        this.block=new Float32Array(2048); this.used=0;
      }
    }
    return true;
  }
}
registerProcessor('capture',Capture);
