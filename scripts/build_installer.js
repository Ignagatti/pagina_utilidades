import { createWindowsInstaller } from 'electron-winstaller';
import path from 'path';
import fs from 'fs';

async function buildInstaller() {
  const rootPath = path.resolve('.');
  const appDirectory = path.join(rootPath, 'release', 'Nuvexa-win32-x64');
  const outputDirectory = path.join(rootPath, 'release', 'installer');
  const iconPath = path.join(rootPath, 'build', 'icon.ico');

  if (!fs.existsSync(appDirectory)) {
    console.error('App directory not found:', appDirectory);
    process.exit(1);
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  console.log('Creando instalador oficial de Windows para Nuvexa...');
  
  await createWindowsInstaller({
    appDirectory: appDirectory,
    outputDirectory: outputDirectory,
    authors: 'Ignacio Gatti',
    exe: 'Nuvexa.exe',
    setupExe: 'NuvexaSetup.exe',
    setupIcon: iconPath,
    iconUrl: 'https://raw.githubusercontent.com/Ignagatti/pagina_utilidades/main/public/favicon.ico',
    noMsi: true,
    description: 'Nuvexa - Herramientas digitales. Privadas. En un solo lugar.',
    title: 'Nuvexa'
  });

  console.log('✅ ¡Instalador NuvexaSetup.exe creado exitosamente en release/installer/ !');
}

buildInstaller().catch((err) => {
  console.error('Error al generar instalador:', err);
  process.exit(1);
});
