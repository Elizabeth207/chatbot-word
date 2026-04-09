#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const checks = [
  {
    name: 'Node.js & npm',
    check: async () => {
      const { stdout } = await execAsync('node --version');
      const { stdout: npmv } = await execAsync('npm --version');
      return `✓ Node ${stdout.trim()}, npm ${npmv.trim()}`;
    }
  },
  {
    name: 'Tesseract.js',
    check: async () => {
      try {
        await import('tesseract.js');
        return '✓ Tesseract.js instalado';
      } catch (e) {
        return '✗ Tesseract.js NO instalado - Ejecuta: npm install tesseract.js';
      }
    }
  },
  {
    name: 'pdf2pic',
    check: async () => {
      try {
        await import('pdf2pic');
        return '✓ pdf2pic instalado';
      } catch (e) {
        return '✗ pdf2pic NO instalado - Ejecuta: npm install pdf2pic';
      }
    }
  },
  {
    name: 'Poppler (CRÍTICO para OCR)',
    check: async () => {
      try {
        await execAsync('pdftoppm --version');
        return '✓ Poppler instalado y en PATH';
      } catch (e) {
        return '✗ POPPLER NO ENCONTRADO - REQUERIDO para OCR\n   Lee: POPPLER_SETUP.md para instalarlo';
      }
    }
  }
];

async function runChecks() {
  console.log('\n🔍 Verificando dependencias del sistema...\n');
  
  for (const check of checks) {
    try {
      const result = await check.check();
      console.log(`${check.name}: ${result}`);
    } catch (e) {
      console.log(`${check.name}: ✗ ERROR - ${e.message}`);
    }
  }
  
  console.log('\n✅ Si todos los checks pasan, puedes ejecutar:');
  console.log('   npm run dev\n');
}

runChecks();
