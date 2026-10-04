// Compile the MIT-licensed Keyman reference as data. Never execute source code.
import fs from 'node:fs';
import crypto from 'node:crypto';
const sourcePath = new URL('../data/mozhi/reference/mozhi_malayalam.kmn', import.meta.url);
const outputPath = new URL('../data/mozhi/mozhi-2.v1.json', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const ranges = [];
const rules = [];

function atoms(expression) {
  const output = [];
  const re =
    /"([^"]*)"|dk\(key_(\d+)\)|any\(range_(\d+)\)|index\(range_(\d+),\s*(\d+)\)|(context)|(nul)/gy;
  let cursor = 0;
  while (cursor < expression.length) {
    if (/\s/.test(expression[cursor])) {
      cursor++;
      continue;
    }
    re.lastIndex = cursor;
    const m = re.exec(expression);
    if (!m) throw new Error(`Unsupported expression: ${expression.slice(cursor)}`);
    if (m[1] !== undefined) output.push(...Array.from(m[1], (c) => c.codePointAt(0)));
    else if (m[2]) output.push(-1 - Number(m[2]));
    else if (m[3]) output.push(-1000 - Number(m[3]));
    else if (m[4]) output.push(-3000 - Number(m[4]) * 100 - Number(m[5]));
    else if (m[6]) output.push(-2000);
    cursor = re.lastIndex;
  }
  return output;
}

for (const [i, raw] of source.split(/\r?\n/).entries()) {
  const line = raw.trim();
  const store = line.match(/^store\(range_(\d+)\)\s+(.*)$/);
  if (store) {
    const chars = [];
    let expand = false;
    for (const part of store[2].matchAll(/'([^']*)'|(\.\.)/g)) {
      if (part[2]) {
        expand = true;
        continue;
      }
      const literals = Array.from(part[1], (c) => c.codePointAt(0));
      if (expand) {
        const start = chars.at(-1);
        const end = literals.shift();
        for (let cp = start + 1; cp <= end; cp++) chars.push(cp);
        expand = false;
      }
      chars.push(...literals);
    }
    ranges[Number(store[1])] = chars;
  } else if (
    !line ||
    line.startsWith('c ') ||
    line === 'c' ||
    line.startsWith('store(') ||
    line.startsWith('begin ') ||
    line.startsWith('group(')
  ) {
    continue;
  } else {
    const match = line.match(/^(.*?)\s*\+\s+(.*?)\s+>\s+(.*)$/);
    if (!match) throw new Error(`Unsupported line ${i + 1}: ${line}`);
    const key = atoms(match[2]);
    if (key.length !== 1) throw new Error(`Multiple keys at ${i + 1}`);
    rules.push({ c: atoms(match[1]), k: key[0], o: atoms(match[3]), line: i + 1 });
  }
}
// Keyman gives longer context precedence; source order breaks equal-length ties.
rules.sort((a, b) => b.c.length - a.c.length || a.line - b.line);
const data =
  JSON.stringify({
    schemaVersion: 1,
    scheme: 'mozhi-2',
    version: '1.0.0',
    referenceVersion: '3.2.6',
    source: 'https://github.com/keymanapp/keyboards/tree/master/release/m/mozhi_malayalam',
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    ranges,
    rules,
  }) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== data)
    throw new Error(
      'Mozhi data differs. Run node scripts/compile-mozhi.mjs and review the change.',
    );
} else fs.writeFileSync(outputPath, data);
console.log(
  `Mozhi 2: ${rules.length} rules, ${ranges.length} character stores${process.argv.includes('--check') ? ' verified' : ' compiled'}.`,
);
