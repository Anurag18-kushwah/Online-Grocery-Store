// Hand-pick the best photo for every product:   npm run photos:pick   then open http://localhost:4400
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createPicker } from '../lib/photoPicker.js';

const dir = process.env.PHOTO_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/images/products');
const port = Number(process.env.PICKER_PORT) || 4400;
createPicker({ dir }).listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}`;
  console.log(`\nPhoto picker is running: ${url}\n(Press Ctrl+C when you are done. The app itself does not need to be stopped.)\n`);
  try { spawn(process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open', process.platform === 'win32' ? ['/c', 'start', '', url] : [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* open the URL manually */ }
});
