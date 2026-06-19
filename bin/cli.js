#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { Command } from 'commander';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const program = new Command();
const fontDir = path.resolve(__dirname, '../fonts/ttf');
const cssSource = path.resolve(__dirname, '../ui-font.css');
const homeDir = os.homedir();
const vscodeCssTarget = path.join(homeDir, '.vscode', 'vscode-config-ui-font.css');

function listFonts() {
  if (!fs.existsSync(fontDir)) {
    console.error('Font directory not found:', fontDir);
    process.exit(1);
  }
  return fs.readdirSync(fontDir).filter((name) => name.toLowerCase().endsWith('.ttf'));
}

function resolveFontRequest(value) {
  if (!value) {
    return ['all'];
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function findFonts(requested) {
  const available = listFonts();
  const normalized = requested.flatMap((item) => {
    const lower = item.toLowerCase();
    if (lower === 'all') {
      return available;
    }
    const exact = available.find((name) => name.toLowerCase() === lower || path.basename(name, '.ttf').toLowerCase() === lower);
    if (exact) {
      return [exact];
    }
    const fuzzy = available.filter((name) => path.basename(name, '.ttf').toLowerCase().includes(lower));
    return fuzzy;
  });
  return [...new Set(normalized)];
}

function copyFont(fontFile) {
  const from = path.join(fontDir, fontFile);
  const targetDir = path.join(homeDir, '.local', 'share', 'fonts');
  fs.mkdirSync(targetDir, { recursive: true });
  const dest = path.join(targetDir, fontFile);
  fs.copyFileSync(from, dest);
  console.log(`Installed ${fontFile} → ${dest}`);
}

function installFonts(fontRequest = ['all']) {
  const fonts = findFonts(fontRequest);
  if (!fonts.length) {
    console.error('No matching fonts found for:', fontRequest.join(', '));
    console.error('Use `vscode-config list-fonts` to see available fonts.');
    process.exit(1);
  }

  const platform = os.platform();
  if (platform !== 'linux' && platform !== 'darwin') {
    console.warn('Automatic font install is supported only on Linux and macOS.');
    console.warn('You can still copy font files manually from', fontDir);
  }

  fonts.forEach(copyFont);

  if (platform === 'linux') {
    const result = spawnSync('fc-cache', ['-f'], { stdio: 'inherit' });
    if (result.status === 0) {
      console.log('Font cache refreshed.');
    } else {
      console.warn('Could not refresh font cache automatically. Run `fc-cache -f` manually if needed.');
    }
  }
}

function copyCss() {
  if (!fs.existsSync(cssSource)) {
    console.error('CSS source file not found:', cssSource);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(vscodeCssTarget), { recursive: true });
  fs.copyFileSync(cssSource, vscodeCssTarget);
  console.log(`Copied UI CSS to ${vscodeCssTarget}`);
}

function installExtensions(extensions) {
  const codeCommand = process.platform === 'win32' ? 'code.cmd' : 'code';
  const command = codeCommand;
  extensions.forEach((extension) => {
    console.log(`Installing VS Code extension: ${extension}`);
    const result = spawnSync(command, ['--install-extension', extension], { stdio: 'inherit' });
    if (result.status !== 0) {
      console.warn(`Failed to install extension ${extension}. You can install it manually with \`code --install-extension ${extension}\`.`);
    }
  });
}

function openVSCode() {
  const codeCommand = process.platform === 'win32' ? 'code.cmd' : 'code';
  const result = spawnSync(codeCommand, ['.'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.warn('Could not open VS Code automatically. Please open VS Code manually.');
  }
}

program
  .name('vscode-config')
  .description('VS Code profile installer for JetBrains fonts and VS Code UI setup')
  .version('1.0.0');

program
  .command('list-fonts')
  .description('Show all available JetBrains Mono font variants in the repo')
  .action(() => {
    listFonts().forEach((font) => console.log(font));
  });

program
  .command('install-fonts')
  .description('Install selected JetBrains Mono fonts into the local system')
  .option('-f, --fonts <fonts>', 'Comma-separated font names or `all` to install all variants', 'all')
  .action((options) => {
    const requested = resolveFontRequest(options.fonts);
    installFonts(requested);
  });

program
  .command('setup')
  .description('Install all fonts, copy VS Code custom CSS, and optionally install helper extensions')
  .option('-e, --install-extensions', 'Install recommended VS Code extensions automatically', false)
  .option('-o, --open', 'Open VS Code after setup', false)
  .action((options) => {
    installFonts(['all']);
    copyCss();
    if (options.installExtensions) {
      installExtensions(['be5invis.vscode-custom-css', 'esbenp.prettier-vscode', 'eamodio.gitlens']);
    }
    console.log('Setup completed.');
    console.log('- Enable `vscode_custom_css.imports` in your VS Code settings if needed.');
    console.log(`- Custom CSS file is available at ${vscodeCssTarget}`);
    if (options.open) {
      openVSCode();
    }
  });

program
  .command('install-global')
  .description('Install this CLI tool globally using npm')
  .action(() => {
    const root = path.resolve(__dirname, '..');
    console.log('Installing package globally from', root);
    const result = spawnSync('npm', ['install', '-g', '.'], {
      cwd: root,
      stdio: 'inherit',
    });
    if (result.error || result.status !== 0) {
      console.error('Global installation failed. You may need to run with sudo or adjust permissions.');
      process.exit(result.status || 1);
    }
    console.log('Global installation completed successfully.');
  });

program.parse(process.argv);
