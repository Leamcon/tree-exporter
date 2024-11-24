import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const EXTENSION_ID = 'tree-exporter';

export function activate(context: vscode.ExtensionContext) {
    console.log(`${EXTENSION_ID} is now active`);

    let disposable = vscode.commands.registerCommand(`${EXTENSION_ID}.generateTree`, async () => {
        try {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            
            const tree = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating file tree...",
                cancellable: false
            }, async () => {
                return await generateTree(workspaceRoot);
            });

            const document = await vscode.workspace.openTextDocument({
                content: tree,
                language: 'plaintext'
            });

            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage('File tree generated successfully');
        } catch (error) {
            console.error('Error generating file tree:', error);
            vscode.window.showErrorMessage(`Failed to generate file tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function generateTree(rootPath: string, prefix: string = ''): Promise<string> {
    try {
        let output = '';
        const items = await fs.promises.readdir(rootPath);
    
        // Sort items: directories first, then files
        const sortedItems = await Promise.all(
            items.map(async (item) => {
                const itemPath = path.join(rootPath, item);
                const stats = await fs.promises.stat(itemPath);
                return {
                    name: item,
                    isDirectory: stats.isDirectory()
                };
            })
        ).then(items => 
            items.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            })
        );

        for (let i = 0; i < sortedItems.length; i++) {
            const item = sortedItems[i];
            const itemPath = path.join(rootPath, item.name);
            const isLast = i === sortedItems.length - 1;

            // Skip node_modules, .git, and compiled files
            if (item.name === 'node_modules' || 
                item.name === '.git' || 
                item.name.endsWith('.class') ||
                item.name === 'out') {
                continue;
            }

            output += `${prefix}${isLast ? '└── ' : '├── '}${item.name}\n`;

            if (item.isDirectory) {
                output += await generateTree(
                    itemPath,
                    `${prefix}${isLast ? '    ' : '│   '}`
                );
            }
        }

        return output;
    } catch (error) {
        console.error(`Error processing directory ${rootPath}:`, error);
        throw error; // Re-throw to be handled by the caller
    }
}

export function deactivate() {
    console.log(`${EXTENSION_ID} is now deactivated`);
}