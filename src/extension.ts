import * as vscode from 'vscode';
import { StoreProvider } from './storeProvider';
import { StoreItem } from './types';

export function activate(context: vscode.ExtensionContext) {
    const storeProvider = new StoreProvider(context);
    const treeView = vscode.window.createTreeView('devStoreExplorer', {
        treeDataProvider: storeProvider,
        dragAndDropController: storeProvider,
        showCollapseAll: true
    });

    // Get unique commands for suggestions
    const getCommandSuggestions = () => {
        const uniqueCommands = new Set<string>();
        storeProvider.getAllCommands().forEach(cmd => {
            uniqueCommands.add(cmd.command);
        });
        return Array.from(uniqueCommands);
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('dev-store.addSection', async () => {
            try {
                const label = await vscode.window.showInputBox({
                    prompt: 'Enter section name',
                    placeHolder: 'e.g., Project Name or Repository',
                    validateInput: text => !text.trim() ? 'Section name cannot be empty' : null
                });

                if (label) {
                    await storeProvider.addSection(label);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add section: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.addCommand', async (section: StoreItem) => {
            try {
                const label = await vscode.window.showInputBox({
                    prompt: 'Enter command label',
                    placeHolder: 'e.g., Start Dev Server',
                    validateInput: text => !text.trim() ? 'Command label cannot be empty' : null
                });

                if (label) {
                    const command = await vscode.window.showInputBox({
                        prompt: 'Enter command',
                        placeHolder: 'e.g., npm run dev',
                        validateInput: text => !text.trim() ? 'Command cannot be empty' : null
                    });

                    if (command) {
                        await storeProvider.addCommand(section.id, label, command);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.editItem', async (item: StoreItem) => {
            try {
                const label = await vscode.window.showInputBox({
                    prompt: 'Enter new label',
                    value: item.label,
                    validateInput: text => !text.trim() ? 'Label cannot be empty' : null
                });

                if (label) {
                    if (item.type === 'command') {
                        const command = await vscode.window.showInputBox({
                            prompt: 'Enter new command',
                            value: item.command,
                            validateInput: text => !text.trim() ? 'Command cannot be empty' : null
                        });

                        if (command) {
                            await storeProvider.editItem(item, label, command);
                        }
                    } else {
                        await storeProvider.editItem(item, label);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to edit item: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.deleteItem', async (item: StoreItem) => {
            try {
                const confirmMessage = item.type === 'section' 
                    ? 'Are you sure you want to delete this section and all its commands?' 
                    : 'Are you sure you want to delete this command?';
                
                const result = await vscode.window.showWarningMessage(
                    confirmMessage,
                    { modal: true },
                    'Delete'
                );

                if (result === 'Delete') {
                    await storeProvider.deleteItem(item);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.copyCommand', async (item: StoreItem) => {
            try {
                if (item.type === 'command') {
                    await vscode.env.clipboard.writeText(item.command);
                    vscode.window.showInformationMessage('Command copied to clipboard!');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.runInTerminal', async (item: StoreItem) => {
            try {
                if (item.type === 'command') {
                    const terminal = vscode.window.createTerminal('Dev Store');
                    terminal.show();
                    terminal.sendText(item.command);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to run command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.exportData', async () => {
            try {
                const data = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Exporting command store data...",
                    cancellable: false
                }, async () => {
                    return await storeProvider.exportData();
                });

                const uri = await vscode.window.showSaveDialog({
                    filters: { 'JSON Files': ['json'] },
                    defaultUri: vscode.Uri.file('dev-store-backup.json')
                });

                if (uri) {
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf-8'));
                    vscode.window.showInformationMessage('Successfully exported command store data!');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.importData', async () => {
            try {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'JSON Files': ['json'] }
                });

                if (uris?.[0]) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Importing command store data...",
                        cancellable: false
                    }, async () => {
                        const fileData = await vscode.workspace.fs.readFile(uris[0]);
                        await storeProvider.importData(Buffer.from(fileData).toString('utf-8'));
                    });
                    vscode.window.showInformationMessage('Successfully imported command store data!');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.insertInTerminal', async (item: StoreItem) => {
            try {
                if (item.type === 'command') {
                    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Dev Store');
                    terminal.show(true); // true parameter ensures terminal gets focus
                    terminal.sendText(item.command, false); // false parameter prevents executing the command
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to insert command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        })
    );

    context.subscriptions.push(treeView);
}

export function deactivate() {}
