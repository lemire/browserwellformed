#!/usr/bin/env node

// Benchmark for String.toWellFormed() in Node.js
// Uses a 1024-character string with some lone surrogates

console.log(`Node.js version: ${process.version}`);

// Check if toWellFormed is supported
if (typeof String.prototype.toWellFormed !== 'function') {
  console.error('Error: Your Node.js version does not support String.toWellFormed() yet.');
  console.error('Update to Node.js 20+ or use --experimental-specifier-resolution if needed.');
  process.exit(1);
}

const Benchmark = require('benchmark');

// Helper to generate a pseudo-random string with lone surrogates
function pseudoRandomString(len) {
  let str = '';
  // simple 32-bit LCG seeded by Math.random()
  let seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const rand = seed % 100;
    if (rand < 5) { // 5% chance of lone high surrogate
      str += String.fromCharCode(0xD800 + (seed % 1024));
    } else if (rand < 10) { // 5% chance of lone low surrogate
      str += String.fromCharCode(0xDC00 + (seed % 1024));
    } else { // 90% normal ASCII
      str += String.fromCharCode(32 + (seed % 95)); // printable ASCII
    }
  }
  return str;
}

// Generate 1024-char string
const str = pseudoRandomString(1024);
console.log(`Generated string of length: ${str.length}`);

// Check if it's well-formed (should have some lone surrogates)
function isWellFormed(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) { // high surrogate
      if (i + 1 >= str.length || str.charCodeAt(i + 1) < 0xDC00 || str.charCodeAt(i + 1) > 0xDFFF) {
        return false; // lone high surrogate
      }
      i++; // skip the low surrogate
    } else if (code >= 0xDC00 && code <= 0xDFFF) { // low surrogate without high
      return false;
    }
  }
  return true;
}

console.log(`Original string is well-formed: ${isWellFormed(str)}`);

// Run benchmark using Benchmark.js
console.log('\nRunning benchmark...');

const suite = new Benchmark.Suite();

suite.add('String.toWellFormed()', function() {
  str.toWellFormed();
}, { minSamples: 5 });

suite.on('cycle', function(event) {
  const name = event.target.name;
  const hz = event.target.hz || 0;
  const ms = hz > 0 ? 1000 / hz : Infinity;
  const bytes = str.length * 2; // UTF-16 bytes
  const mbps = hz > 0 ? (bytes * hz / (1024*1024)) : 0;
  const gibps = hz > 0 ? (bytes * hz / (1024**3)) : 0;
  const moeMs = event.target.stats.moe * 1000;
  const relError = isFinite(ms) ? (moeMs / ms) * 100 : 0;
  const msDisplay = isFinite(ms) ? Number(ms).toPrecision(3) : '∞';
  console.log(`${name.padEnd(32)} ${msDisplay} ms (±${relError.toFixed(2)}%) → ${mbps.toFixed(2)} MiB/s (${gibps.toFixed(2)} GiB/s)`);
});

suite.on('complete', function() {
  console.log('\nBenchmark complete.');
  
  // Test the result
  const wellFormed = str.toWellFormed();
  console.log(`\nResult string is well-formed: ${isWellFormed(wellFormed)}`);
  console.log(`Result length: ${wellFormed.length}`);
});

suite.run();