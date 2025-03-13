import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { StoreData, StoreItem, StoreSection, StoreCommand } from './types';

export class StoreProvider implements vscode.TreeDataProvider<StoreItem>, vscode.TreeDragAndDropController<StoreItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StoreItem | undefined | null | void> = new vscode.EventEmitter<StoreItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StoreItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private storeData: StoreData;

    dropMimeTypes = ['application/vnd.code.tree.devStoreExplorer'];
    dragMimeTypes = ['application/vnd.code.tree.devStoreExplorer'];

    constructor(private context: vscode.ExtensionContext) {
        const data = context.globalState.get<StoreData>('storeData');
        this.storeData = data || { sections: [], commands: [] };
    }

    getTreeItem(element: StoreItem): vscode.TreeItem {
         const treeItem = new vscode.TreeItem(
            element.label,
            element.type === 'section' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
        );

        const markdown = new vscode.MarkdownString('', true);
        markdown.supportHtml = true;
        markdown.isTrusted = true;

        if (element.type === 'command') {
            markdown.appendMarkdown(`<div class="dev-store-command draggable-item">
                ${element.label}
                <span class="command-text">${element.command}</span>
            </div>`);
            
            treeItem.tooltip = markdown;
            treeItem.description = element.command;
            treeItem.contextValue = 'command';
            treeItem.iconPath = new vscode.ThemeIcon('terminal');
        } else {
            markdown.appendMarkdown(`<div class="drop-target">
                ${element.label}
            </div>`);
            
            treeItem.tooltip = markdown;
            treeItem.contextValue = 'section';
            treeItem.iconPath = new vscode.ThemeIcon('repo');
        }

        return treeItem;
    }

    getChildren(element?: StoreItem): Thenable<StoreItem[]> {
        if (!element) {
            return Promise.resolve(this.storeData.sections);
        }

        if (element.type === 'section') {
            return Promise.resolve(
                this.storeData.commands.filter(cmd => cmd.parentId === element.id)
            );
        }

        return Promise.resolve([]);
    }

    async addSection(label: string) {
        if (!label.trim()) {
            throw new Error('Section name cannot be empty');
        }

        const section: StoreSection = {
            id: uuidv4(),
            label: label.trim(),
            type: 'section'
        };

        this.storeData.sections.push(section);
        await this.saveData();
        this.refresh();
    }

    async addCommand(sectionId: string, label: string, command: string) {
        if (!label.trim()) {
            throw new Error('Command label cannot be empty');
        }
        if (!command.trim()) {
            throw new Error('Command cannot be empty');
        }

        const section = this.storeData.sections.find(s => s.id === sectionId);
        if (!section) {
            throw new Error('Section not found');
        }

        const cmd: StoreCommand = {
            id: uuidv4(),
            label: label.trim(),
            command: command.trim(),
            type: 'command',
            parentId: sectionId
        };

        this.storeData.commands.push(cmd);
        await this.saveData();
        this.refresh();
    }

    async editItem(item: StoreItem, newLabel: string, newCommand?: string) {
        if (!newLabel.trim()) {
            throw new Error('Label cannot be empty');
        }

        if (item.type === 'command') {
            if (!newCommand?.trim()) {
                throw new Error('Command cannot be empty');
            }

            const cmd = this.storeData.commands.find(c => c.id === item.id);
            if (!cmd) {
                throw new Error('Command not found');
            }

            cmd.label = newLabel.trim();
            cmd.command = newCommand.trim();
        } else {
            const section = this.storeData.sections.find(s => s.id === item.id);
            if (!section) {
                throw new Error('Section not found');
            }

            section.label = newLabel.trim();
        }

        await this.saveData();
        this.refresh();
    }

    async deleteItem(item: StoreItem) {
        if (item.type === 'command') {
            const index = this.storeData.commands.findIndex(c => c.id === item.id);
            if (index === -1) {
                throw new Error('Command not found');
            }
            this.storeData.commands.splice(index, 1);
        } else {
            const index = this.storeData.sections.findIndex(s => s.id === item.id);
            if (index === -1) {
                throw new Error('Section not found');
            }
            this.storeData.sections.splice(index, 1);
            // Delete all commands in this section
            this.storeData.commands = this.storeData.commands.filter(c => c.parentId !== item.id);
        }

        await this.saveData();
        this.refresh();
    }

    async exportData(): Promise<string> {
        return JSON.stringify(this.storeData, null, 2);
    }

    async importData(jsonData: string): Promise<void> {
        try {
            const data = JSON.parse(jsonData) as StoreData;
            
            // Validate the data structure
            if (!data.sections || !Array.isArray(data.sections) ||
                !data.commands || !Array.isArray(data.commands)) {
                throw new Error('Invalid data format');
            }

            // Validate each section and command
            if (!data.sections.every(s => s.id && s.label && s.type === 'section') ||
                !data.commands.every(c => c.id && c.label && c.command && c.type === 'command' && c.parentId)) {
                throw new Error('Invalid data structure');
            }

            this.storeData = data;
            await this.saveData();
            this.refresh();
        } catch (error) {
            throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Invalid format'}`);
        }
    }

    async handleDrag(source: readonly StoreItem[], dataTransfer: vscode.DataTransfer): Promise<void> {
        dataTransfer.set('application/vnd.code.tree.devStoreExplorer', new vscode.DataTransferItem(source));
    }

    async handleDrop(target: StoreItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.devStoreExplorer');
        const items: StoreItem[] = transferItem?.value;
        
        if (!items?.length) {
            return;
        }

        const [draggedItem] = items;
        
        // Only allow dragging commands
        if (draggedItem.type !== 'command') {
            return;
        }

        const command = draggedItem as StoreCommand;
        
        // If dropping on a section, move the command to that section
        if (target?.type === 'section') {
            const cmd = this.storeData.commands.find(c => c.id === command.id);
            if (cmd) {
                cmd.parentId = target.id;
                await this.saveData();
                this.refresh();
            }
        }
        // If dropping on another command, move the command after it in the same section
        else if (target?.type === 'command') {
            const targetCmd = target as StoreCommand;
            const commands = this.storeData.commands.filter(c => c.parentId === targetCmd.parentId);
            const draggedCmd = this.storeData.commands.find(c => c.id === command.id);
            
            if (draggedCmd) {
                // Remove from current position
                this.storeData.commands = this.storeData.commands.filter(c => c.id !== command.id);
                
                // Find target index
                const targetIndex = this.storeData.commands.findIndex(c => c.id === targetCmd.id);
                
                // Insert at new position
                draggedCmd.parentId = targetCmd.parentId;
                this.storeData.commands.splice(targetIndex + 1, 0, draggedCmd);
                
                await this.saveData();
                this.refresh();
            }
        }
    }

    getAllCommands(): StoreCommand[] {
        return this.storeData.commands;
    }

    private async saveData() {
        await this.context.globalState.update('storeData', this.storeData);
    }

    private refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}