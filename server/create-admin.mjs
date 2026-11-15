
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(serverDir, '.local-db.json');

if (!fs.existsSync(dbPath)) {
  throw new Error('Local database file not found.');
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

if (!Array.isArray(db.users)) {
  throw new Error('Database users array is missing.');
}

const email = 'admin@grocerai.dev';
const passwordHash = await bcrypt.hash('Admin@123', 10);

let admin = db.users.find(
  user => user.email?.toLowerCase() === email
);

if (admin) {
  admin.name = 'Store Admin';
  admin.role = 'admin';
  admin.passwordHash = passwordHash;
  admin.addresses ??= [];
  console.log('Existing admin account updated.');
} else {
  db.users.push({
    id: crypto.randomUUID(),
    name: 'Store Admin',
    email,
    passwordHash,
    role: 'admin',
    addresses: []
  });
  console.log('New admin account created.');
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

console.log('Admin setup successful.');
console.log('Email: admin@grocerai.dev');
console.log('Password: Admin@123');
