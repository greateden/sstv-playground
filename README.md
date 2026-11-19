# SSTV Playground

Send a picture through sound. Robot 36 turns a 320 × 240 image into a 37-second audio signal. Another device listens and rebuilds the picture, two rows at a time.

No dependencies, accounts or cloud services. Images and sound stay in your browser.

## Start

Use Node.js 20 or later.

```sh
npm start
```

Open `http://localhost:3000` on your Mac. On your phone, open the network address printed in the terminal. Both devices must be on the same Wi-Fi. Use a trusted local network.

1. On the Mac, press **Listen** and allow microphone access.
2. On the phone, choose an image and press **Play sound**. Start at low volume.
3. Watch the picture appear on the Mac.

**Test locally** checks the encoder and decoder without a microphone. You can also save or open WAV files and save received images as PNG.

## Receive on your phone

Browsers require trusted HTTPS for microphone access on a network address. Plain HTTP still supports sending and opening audio files.

To use HTTPS on your own devices, install [mkcert](https://github.com/FiloSottile/mkcert) using Homebrew:

```sh
brew install mkcert
mkcert -install
mkdir -p certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 127.0.0.1 YOUR_MAC_IP
npm start -- --https
```

Replace `YOUR_MAC_IP` with the actual Wi-Fi IP printed by `npm start` (for example, `192.168.1.42`). Stop the HTTP server first with Ctrl+C.

On iPhone, AirDrop **only** `rootCA.pem` from the folder shown by `mkcert -CAROOT`. Install the profile in Settings and enable full trust under General → About → Certificate Trust Settings. Open the printed HTTPS address (port 3443). Do not share `rootCA-key.pem` or the server key. Remove the trusted CA/profile when you no longer need it. If your Mac's IP changes, generate a new server certificate.

## Code

- `public/sstv.js`: Robot 36 encoding, decoding and WAV export
- `public/app.js`: browser controls
- `public/mic.js`: microphone capture
- `server.js`: local HTTP or HTTPS server

Run `npm test` to check audio round trips and WAV format. The decoder is experimental and works best with clear audio. Cross-app and physical speaker-to-microphone compatibility have not yet been verified. Robot 36 is lossy, so fine detail will blur.

Protocol timing: [Robot 36](https://sstv.org.uk/docs/modes/detail/robot-r36/). Microphone requirements: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
