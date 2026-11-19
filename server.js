import { createServer as http } from 'node:http';
import { createServer as https } from 'node:https';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/sstv.js', ['sstv.js', 'text/javascript']],
  ['/mic.js', ['mic.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']]
]);
const secure = process.argv.includes('--https');
const port = Number(process.env.PORT || (secure ? 3443 : 3000));
const serve = (req, res) => {
  const file = files.get(req.url?.split('?')[0]);
  if (!file || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404).end(); return;
  }
  res.writeHead(200, {
    'Content-Type': `${file[1]}; charset=utf-8`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'microphone=(self), camera=()'
  });
  res.end(req.method === 'HEAD' ? undefined : readFileSync(new URL(`./public/${file[0]}`, import.meta.url)));
};
const server = secure ? https({ key: readFileSync('certs/key.pem'), cert: readFileSync('certs/cert.pem') }, serve) : http(serve);
server.listen(port, '0.0.0.0', () => {
  const scheme = secure ? 'https' : 'http';
  console.log(`Mac: ${scheme}://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses || []) if (a.family === 'IPv4' && !a.internal) console.log(`Phone: ${scheme}://${a.address}:${port}`);
  }
});
