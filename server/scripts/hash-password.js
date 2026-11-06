// Prints the scrypt hash of a password for Customer.flqPasswordHash (same format as AdminUser.passwordHash).
// Usage: npm run hash-password            (prompts, input hidden)
//        printf '%s' "$PW" | npm run -s hash-password
import readline from 'node:readline';
import { hashPassword } from '../src/admin/auth.js';

async function readPassword() {
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    return input.replace(/\r?\n$/, '');
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write('Password: ');
  // Hide what is typed
  rl._writeToOutput = () => {};
  const password = await new Promise((resolve) => rl.once('line', resolve));
  rl.close();
  process.stdout.write('\n');
  return password;
}

const password = await readPassword();
if (!password) {
  console.error('Empty password');
  process.exit(1);
}
console.log(await hashPassword(password));
