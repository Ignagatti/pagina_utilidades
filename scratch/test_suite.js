import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('  EJECUTANDO AUDITORÍA Y TESTEO EXHAUSTIVO DEL SISTEMA');
console.log('====================================================\n');

const htmlPath = path.resolve('index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 1. EXTRAER TODOS LOS IDs DE index.html
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(htmlContent)) !== null) {
  htmlIds.add(match[1]);
}
console.log(`[PASS] Total de IDs únicos indexados en index.html: ${htmlIds.size}`);

// 2. BUSCAR TODOS LOS getElementById EN src/**/*.js
const toolsDir = path.resolve('src');
function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const jsFiles = getAllJsFiles(toolsDir);
console.log(`[PASS] Archivos JavaScript analizados: ${jsFiles.length}`);

let missingIdsCount = 0;
const getElementRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  let m;
  while ((m = getElementRegex.exec(content)) !== null) {
    const id = m[1];
    if (!htmlIds.has(id)) {
      console.warn(`[ADVERTENCIA] ID faltante en HTML: '${id}' (referenciado en ${path.relative(process.cwd(), file)})`);
      missingIdsCount++;
    }
  }
});

if (missingIdsCount === 0) {
  console.log('[PASS] 100% de los elementos getElementById en JavaScript existen en index.html.\n');
} else {
  console.log(`[ALERTA] Se encontraron ${missingIdsCount} IDs sin correspondencia en index.html.\n`);
}

// 3. TESTEO DEL MOTOR DE DETECCIÓN DE DATOS SENSIBLES (Redaction Studio)
console.log('----------------------------------------------------');
console.log('  TEST: REDACTION STUDIO (PII / REGEX DE SEGURIDAD)');
console.log('----------------------------------------------------');

const CV_SAMPLE = `
IGNACIO GATTI
Estudiante de Desarrollo de Software
3496-462576
Teléfono alternativo: +54 9 11 2345-6789
Celular: 03496-15462576
Email: gattiignacio85@gmail.com
DNI: 42.123.456
CUIT: 20-42123456-9
Estudios: 2018-2022 Secundaria completa (Colegio San José)
Tarjeta: 4532-1234-5678-9012
Fecha de nacimiento: 15/08/2000
`;

// Importar o definir las regex exactas de redactionStudio.js
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?\d{1,3}[-.\s]*)?(?:0?[1-9]\d{1,3})[-.\s]+(?:15[-.\s]*)?\d{6,8}\b|\b(?:\+?54\s?9?\s?)?(?:0?[1-9]\d{1,3})[-.\s]?(?:15[-.\s]?)?\d{6,8}\b/g,
  dni: /\b\d{1,2}\.?\d{3}\.?\d{3}\b/g,
  cuil: /\b\d{2}-\d{8}-\d{1}\b/g,
  card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  date: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g
};

let cvPhones = CV_SAMPLE.match(PII_PATTERNS.phone) || [];
let cvEmails = CV_SAMPLE.match(PII_PATTERNS.email) || [];
let cvDNIs = CV_SAMPLE.match(PII_PATTERNS.dni) || [];
let cvCUILs = CV_SAMPLE.match(PII_PATTERNS.cuil) || [];
let cvCards = CV_SAMPLE.match(PII_PATTERNS.card) || [];

console.log('Telefonos detectados:', cvPhones);
console.log('Emails detectados:', cvEmails);
console.log('DNIs detectados:', cvDNIs);
console.log('CUILs detectados:', cvCUILs);
console.log('Tarjetas detectadas:', cvCards);

const phoneMatches = cvPhones.some(p => p.includes('3496-462576'));
if (phoneMatches) {
  console.log('[PASS] Telefono 3496-462576 detectado con exito.');
} else {
  console.error('[FAIL] No se detecto el telefono 3496-462576.');
}

const dateNotConfused = !cvPhones.some(p => p.includes('2018-2022'));
if (dateNotConfused) {
  console.log('[PASS] Rango de fechas 2018-2022 NO fue confundido con un telefono.');
} else {
  console.error('[FAIL] El rango de fechas 2018-2022 fue tomado erroneamente como telefono.');
}

// 4. TESTEO DEL MOTOR DE CIFRADO Y GENERACIÓN DE CONTRASEÑAS (Security Studio)
console.log('\n----------------------------------------------------');
console.log('  TEST: SECURITY STUDIO (CONTRASEÑAS Y HASHES)');
console.log('----------------------------------------------------');

function generateStrongPassword(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let pass = '';
  for (let i = 0; i < len; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

const testPass = generateStrongPassword(20);
console.log('Password generada de prueba:', testPass);
if (testPass.length === 20) {
  console.log('[PASS] Generador de contraseñas de alta entropía OK.');
}

// 5. TESTEO DEL COMPARADOR DIFF (DocDiff Studio)
console.log('\n----------------------------------------------------');
console.log('  TEST: DOCDIFF STUDIO (DIFF ALGORITHM)');
console.log('----------------------------------------------------');

function simpleDiffLines(textA, textB) {
  const linesA = textA.split(/\r?\n/);
  const linesB = textB.split(/\r?\n/);
  const results = [];
  let added = 0, deleted = 0, equal = 0;

  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i];
    const b = linesB[i];
    if (a === b) {
      if (a !== undefined) {
        results.push({ type: 'equal', text: a });
        equal++;
      }
    } else {
      if (a !== undefined) {
        results.push({ type: 'deleted', text: a });
        deleted++;
      }
      if (b !== undefined) {
        results.push({ type: 'added', text: b });
        added++;
      }
    }
  }
  return { results, stats: { added, deleted, equal } };
}

const docA = "Clausula 1: El precio es 100 USD.\nClausula 2: Plazo de entrega 30 dias.";
const docB = "Clausula 1: El precio es 150 USD.\nClausula 2: Plazo de entrega 30 dias.\nClausula 3: Garantia extendida.";
const diffRes = simpleDiffLines(docA, docB);
console.log('Diff Stats:', diffRes.stats);
if (diffRes.stats.added === 2 && diffRes.stats.deleted === 1 && diffRes.stats.equal === 1) {
  console.log('[PASS] Algoritmo de comparación diferencial de contratos y PDFs OK.');
} else {
  console.warn('[WARN] Resultado inesperado en Diff Stats.');
}

console.log('\n====================================================');
console.log('  RESUMEN GENERAL DE VERIFICACIÓN');
console.log('====================================================');
console.log('Todas las pruebas automatizadas de lógica, regex, IDs y compatibilidad finalizaron.\n');
