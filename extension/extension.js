import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const fontsDir = path.join(__dirname, 'fonts', 'ttf');
const cssSource = path.join(__dirname, 'ui-font.css');
const homeDir = os.homedir();
const targetCss = path.join(homeDir, '.vscode', 'vscode-config-ui-font.css');

function listFonts() {
  const files = fs.readdirSync(fontsDir).filter((name) => name.toLowerCase().endsWith('.ttf'));
  return files;
}

function copyFont(fileName) {
  const source = path.join(fontsDir, fileName);
  const destDir = path.join(homeDir, '.local', 'share', 'fonts');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(source, path.join(destDir, fileName));
}

function installFonts(selected = []) {
  const fonts = selected.length ? selected : listFonts();
  fonts.forEach((font) => copyFont(font));
  try {
    execSync('fc-cache -f', { stdio: 'inherit' });
  } catch (error) {
    // ignore
  }
}

function copyCss() {
  fs.mkdirSync(path.dirname(targetCss), { recursive: true });
  fs.copyFileSync(cssSource, targetCss);
}

export function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-config.listFonts', async () => {
      const fonts = listFonts();
      vscode.window.showQuickPick(fonts, { canPickMany: false, placeHolder: 'Available JetBrains Mono fonts' });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-config.installFonts', async () => {
      const fonts = listFonts();
      const selection = await vscode.window.showQuickPick(fonts, { canPickMany: true, placeHolder: 'Select fonts to install' });
      if (!selection || !selection.length) {
        vscode.window.showInformationMessage('No fonts selected.');
        return;
      }
      installFonts(selection);
      vscode.window.showInformationMessage(`Installed ${selection.length} JetBrains Mono font(s).`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-config.setup', async () => {
      const installExtensions = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: 'Install recommended extensions?' });
      installFonts();
      copyCss();
      if (installExtensions === 'Yes') {
        const code = await vscode.commands.executeCommand('workbench.action.openGlobalSettings');
        vscode.window.showInformationMessage('Recommended extensions: vscode-custom-css, prettier-vscode, gitlens');
      }
      vscode.window.showInformationMessage('VS Code config setup complete. Enable custom CSS in settings if needed.');
    })
  );
}

export function deactivate() {}
