import fs from 'node:fs';
// Sets KEY=value lines in an .env file, replacing an existing active line and keeping everything else.
export function setEnvKeys(file, kv) {
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(kv)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(file, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n');
}
export const readEnv = (file) => Object.fromEntries((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
