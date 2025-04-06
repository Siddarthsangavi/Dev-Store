import * as vscode from 'vscode';
import { StoreProvider } from './storeProvider';
import { StoreItem, StoreCommand } from './types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    const storeProvider = new StoreProvider(context);
    const treeView = vscode.window.createTreeView('devStoreExplorer', {
        treeDataProvider: storeProvider,
        dragAndDropController: storeProvider,
        showCollapseAll: true
    });

    // Terminal icons state
    let terminalIcons: Map<string, StoreCommand> = new Map();
    const terminalIconsStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    terminalIconsStatusBar.text = "$(kebab-vertical) Terminal Icons";
    terminalIconsStatusBar.tooltip = "Click to manage terminal icons";
    terminalIconsStatusBar.command = "dev-store.manageTerminalIcons";
    terminalIconsStatusBar.show();
    
    // Array of terminal status bar items (icons)
    const terminalStatusBarItems: vscode.StatusBarItem[] = [];
    
    function loadEnvFile(): { [key: string]: string } {
        if (!vscode.workspace.workspaceFolders) {
            return {};
        }

        // Look for .env file in the first workspace folder
        const envPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.env');
        
        if (!fs.existsSync(envPath)) {
            return {};
        }

        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        return envConfig;
    }

    function replaceEnvVariables(command: string): string {
        const envVars = loadEnvFile();
        return command.replace(/\{env:([^}]+)\}/g, (match, envName) => {
            const value = envVars[envName];
            if (value === undefined) {
                vscode.window.showWarningMessage(`Environment variable ${envName} not found in .env file`);
                return match; // Keep the placeholder if variable not found
            }
            return value;
        });
    }

    function replaceFilePlaceholders(command: string): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return command;
        }

        const file = editor.document.uri;
        const parsedPath = {
            filename: file.fsPath.split(/[/\\]/).pop() || '',
            filepath: file.fsPath.replace(/\\/g, '/') // Normalize path separators
        };

        // First replace file placeholders
        let processedCommand = command.replace(/(?<![\w])\{(filename|filepath)\}/g, 
            (match, placeholder) => parsedPath[placeholder as keyof typeof parsedPath] || match);
        
        // Then replace environment variables
        return replaceEnvVariables(processedCommand);
    }
    
    // Update terminal icons in the status bar
    function updateTerminalIcons() {
        // Clear existing icons
        terminalStatusBarItems.forEach(item => item.dispose());
        terminalStatusBarItems.length = 0;
        
        // Get saved terminal icons
        const savedIcons = context.globalState.get<{[key: string]: StoreCommand}>('terminalIcons') || {};
        terminalIcons.clear();
        
        // Create status bar items for each command
        Object.entries(savedIcons).forEach(([id, cmd]) => {
            terminalIcons.set(id, cmd);
            const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            statusBarItem.text = `$(${cmd.icon || 'terminal'})`;
            statusBarItem.tooltip = cmd.label;
            statusBarItem.command = {
                title: 'Run Command',
                command: 'dev-store.runTerminalIconCommand',
                arguments: [cmd]
            };
            statusBarItem.show();
            terminalStatusBarItems.push(statusBarItem);
        });
    }
    
    // Add a command to the terminal icons
    async function addCommandToTerminalIcons(command: StoreCommand) {
        const savedIcons = context.globalState.get<{[key: string]: StoreCommand}>('terminalIcons') || {};
        savedIcons[command.id] = command;
        await context.globalState.update('terminalIcons', savedIcons);
        updateTerminalIcons();
        vscode.window.showInformationMessage(`"${command.label}" added to terminal icons`);
    }
    
    // Remove a command from terminal icons
    async function removeCommandFromTerminalIcons(commandId: string) {
        const savedIcons = context.globalState.get<{[key: string]: StoreCommand}>('terminalIcons') || {};
        if (savedIcons[commandId]) {
            delete savedIcons[commandId];
            await context.globalState.update('terminalIcons', savedIcons);
            updateTerminalIcons();
            vscode.window.showInformationMessage("Command removed from terminal icons");
        }
    }

    // Add this function to determine icon based on command content
    function determineCommandIcon(commandText: string): string {
        // Check for common command patterns
        if (/npm (run|start|test|build|install)/i.test(commandText)) {
            return 'package';
        } else if (/yarn/i.test(commandText)) {
            return 'package';
        } else if (/docker/i.test(commandText)) {
            return 'container';
        } else if (/git/i.test(commandText)) {
            return 'git-branch';
        } else if (/test|jest|mocha/i.test(commandText)) {
            return 'beaker';
        } else if (/build|compile|make/i.test(commandText)) {
            return 'gear';
        } else if (/deploy|publish/i.test(commandText)) {
            return 'rocket';
        } else if (/start|run|serve/i.test(commandText)) {
            return 'play';
        } else if (/db|database|mongo|sql/i.test(commandText)) {
            return 'database';
        } else if (/debug/i.test(commandText)) {
            return 'debug';
        } else if (/clean/i.test(commandText)) {
            return 'trash';
        } else if (/install|add/i.test(commandText)) {
            return 'cloud-download';
        } else if (/update|upgrade/i.test(commandText)) {
            return 'sync';
        } else if (/log/i.test(commandText)) {
            return 'output';
        } else if (/ssh|connect/i.test(commandText)) {
            return 'remote';
        } else if (/curl|http|fetch|api/i.test(commandText)) {
            return 'globe';
        }
        
        // Default icon
        return 'terminal';
    }

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
                        // Automatically determine icon based on command
                        const icon = determineCommandIcon(command);
                        
                        await storeProvider.addCommand(section.id, label, command); // Removed extra arguments
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
                        const command = item as StoreCommand;
                        const newCommand = await vscode.window.showInputBox({
                            prompt: 'Enter new command',
                            value: command.command,
                            validateInput: text => !text.trim() ? 'Command cannot be empty' : null
                        });

                        if (newCommand) {
                            // Automatically determine icon when editing
                            const newIcon = determineCommandIcon(newCommand);
                            
                            await storeProvider.editCommand(command, label, newCommand); // Removed extra arguments
                            
                            // Update icon in terminal if it exists
                            const savedIcons = context.globalState.get<{[key: string]: StoreCommand}>('terminalIcons') || {};
                            if (savedIcons[command.id]) {
                                savedIcons[command.id] = {
                                    ...command,
                                    label,
                                    command: newCommand,
                                    icon: newIcon
                                };
                                await context.globalState.update('terminalIcons', savedIcons);
                                updateTerminalIcons();
                            }
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
                    
                    // Remove from terminal icons if it's a command
                    if (item.type === 'command') {
                        await removeCommandFromTerminalIcons(item.id);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.copyCommand', async (item: StoreItem) => {
            try {
                if (item.type === 'command') {
                    const command = item as StoreCommand;
                    await vscode.env.clipboard.writeText(command.command);
                    vscode.window.showInformationMessage('Command copied to clipboard!');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('dev-store.runInTerminal', async (item: StoreItem) => {
            try {
                if (item.type === 'command') {
                    const command = item as StoreCommand;
                    const processedCommand = replaceFilePlaceholders(command.command);
                    const terminal = vscode.window.createTerminal('Dev Store');
                    terminal.show();
                    terminal.sendText(processedCommand);
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
                    const command = item as StoreCommand;
                    const processedCommand = replaceFilePlaceholders(command.command);
                    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Dev Store');
                    terminal.show(true); // true parameter ensures terminal gets focus
                    terminal.sendText(processedCommand, false); // false parameter prevents executing the command
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to insert command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // New command to add a command to terminal icons
        vscode.commands.registerCommand('dev-store.addToTerminal', async (command: StoreCommand) => {
            try {
                await addCommandToTerminalIcons(command);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add to terminal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // New command to run a terminal icon command
        vscode.commands.registerCommand('dev-store.runTerminalIconCommand', async (command: StoreCommand) => {
            try {
                const processedCommand = replaceFilePlaceholders(command.command);
                const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Dev Store');
                terminal.show();
                terminal.sendText(processedCommand);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to run command: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // New command to manage terminal icons
        vscode.commands.registerCommand('dev-store.manageTerminalIcons', async () => {
            try {
                const savedIcons = context.globalState.get<{[key: string]: StoreCommand}>('terminalIcons') || {};
                const iconCommands = Object.values(savedIcons);
                
                if (iconCommands.length === 0) {
                    vscode.window.showInformationMessage('No terminal icons added yet. Right-click on a command and select "Add to Terminal".');
                    return;
                }
                
                const selectedCommand = await vscode.window.showQuickPick(
                    iconCommands.map(cmd => ({
                        label: `$(${cmd.icon || 'terminal'}) ${cmd.label}`,
                        description: cmd.command,
                        command: cmd
                    })),
                    {
                        placeHolder: 'Select a command to manage',
                    }
                );
                
                if (selectedCommand) {
                    const action = await vscode.window.showQuickPick(
                        [
                            { label: 'Run Command', action: 'run' },
                            { label: 'Remove from Terminal', action: 'remove' },
                            { label: 'Update Icon', action: 'update-icon' }
                        ],
                        { placeHolder: 'Choose an action' }
                    );
                    
                    if (action) {
                        const cmd = selectedCommand.command;
                        switch (action.action) {
                            case 'run':
                                await vscode.commands.executeCommand('dev-store.runTerminalIconCommand', cmd);
                                break;
                            case 'remove':
                                await removeCommandFromTerminalIcons(cmd.id);
                                break;
                            case 'update-icon':
                                // Auto-determine icon instead of asking
                                const icon = determineCommandIcon(cmd.command);
                                savedIcons[cmd.id].icon = icon;
                                await context.globalState.update('terminalIcons', savedIcons);
                                updateTerminalIcons();
                                vscode.window.showInformationMessage(`Icon automatically updated for "${cmd.label}"`);
                                break;
                        }
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to manage terminal icons: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // New command to add the selected command to terminal from command palette
        vscode.commands.registerCommand('dev-store.addSelectedCommandToTerminal', async () => {
            try {
                // Get the selected item from the tree view
                const selection = treeView.selection;
                if (selection.length === 0) {
                    vscode.window.showInformationMessage('Please select a command in the Dev Store view first');
                    return;
                }
                
                const selectedItem = selection[0];
                if (selectedItem.type !== 'command') {
                    vscode.window.showInformationMessage('Please select a command, not a section');
                    return;
                }
                
                // Add the selected command to the terminal
                await addCommandToTerminalIcons(selectedItem as StoreCommand);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add selected command to terminal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        // Handler for when a command is selected in the tree view
        vscode.commands.registerCommand('dev-store.selectCommand', (command: StoreCommand) => {
            // This handler is needed for the tree item's command property
            // The actual handling of right-click context menu is done separately
            // This helps ensure the contextValue is properly recognized
        })
    );

    // Initialize terminal icons
    updateTerminalIcons();
    
    // Add status bar items for terminal icons and other UI elements to subscriptions
    context.subscriptions.push(terminalIconsStatusBar);
    terminalStatusBarItems.forEach(item => context.subscriptions.push(item));

    context.subscriptions.push(treeView);
}

export function deactivate() {}
