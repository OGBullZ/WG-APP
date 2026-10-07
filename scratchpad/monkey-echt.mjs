// Breiter Lauf gegen die UNVERÄNDERTE App mit dem tieferen Affen (Formular-Züge). Ergebnis als Zusammenfassung am Ende.
import { execSync } from 'child_process';
const lauf = (a, b, s) => { try { return { rot: false, out: execSync(`node scratchpad/monkey.mjs ${a} ${b} ${s}`, { stdio: 'pipe', timeout: 2400000 }).toString() }; } catch (e) { return { rot: true, out: String(e.stdout || '') + String(e.stderr || '') }; } };
const e = lauf(100, 129, 250);
console.log(e.out);
console.log(e.rot ? 'ECHT: es gibt Funde' : 'ECHT: keine Funde');
console.log('ENDE');
