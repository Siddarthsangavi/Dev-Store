import * as assert from 'assert';
import * as vscode from 'vscode';
import { StoreProvider } from '../storeProvider';
import { StoreItem, StoreData, StoreCommand } from '../types';

suite('StoreProvider Test Suite', () => {
    let storeProvider: StoreProvider;
    let context: vscode.ExtensionContext;

    setup(() => {
        const mockStorage = new Map<string, any>();
        context = {
            globalState: {
                get: (key: string) => mockStorage.get(key),
                update: (key: string, value: any) => {
                    mockStorage.set(key, value);
                    return Promise.resolve();
                }
            }
        } as any;
        storeProvider = new StoreProvider(context);
    });

    test('Add Section', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        assert.strictEqual(sections.length, 1);
        assert.strictEqual(sections[0].label, 'Test Section');
        assert.strictEqual(sections[0].type, 'section');
    });

    test('Add Command', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        const section = sections[0];

        await storeProvider.addCommand(section.id, 'Test Command', 'echo test');
        const commands = await storeProvider.getChildren(section);
        assert.strictEqual(commands.length, 1);
        assert.strictEqual(commands[0].label, 'Test Command');
        assert.strictEqual(commands[0].type, 'command');
        assert.strictEqual((commands[0] as any).command, 'echo test');
    });

    test('Edit Section', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        await storeProvider.editItem(sections[0], 'Updated Section');
        
        const updatedSections = await storeProvider.getChildren();
        assert.strictEqual(updatedSections[0].label, 'Updated Section');
    });

    test('Edit Command', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        await storeProvider.addCommand(sections[0].id, 'Test Command', 'echo test');
        const commands = await storeProvider.getChildren(sections[0]);
        
        await storeProvider.editCommand(commands[0] as StoreCommand, 'Updated Command', 'echo updated');
        const updatedCommands = await storeProvider.getChildren(sections[0]);
        assert.strictEqual(updatedCommands[0].label, 'Updated Command');
        assert.strictEqual((updatedCommands[0] as StoreCommand).command, 'echo updated');
    });

    test('Delete Section', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        await storeProvider.deleteItem(sections[0]);
        
        const updatedSections = await storeProvider.getChildren();
        assert.strictEqual(updatedSections.length, 0);
    });

    test('Delete Command', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        await storeProvider.addCommand(sections[0].id, 'Test Command', 'echo test');
        const commands = await storeProvider.getChildren(sections[0]);
        
        await storeProvider.deleteItem(commands[0]);
        const updatedCommands = await storeProvider.getChildren(sections[0]);
        assert.strictEqual(updatedCommands.length, 0);
    });

    test('Delete Section Deletes Child Commands', async () => {
        await storeProvider.addSection('Test Section');
        const sections = await storeProvider.getChildren();
        await storeProvider.addCommand(sections[0].id, 'Test Command 1', 'echo test1');
        await storeProvider.addCommand(sections[0].id, 'Test Command 2', 'echo test2');
        
        await storeProvider.deleteItem(sections[0]);
        const updatedSections = await storeProvider.getChildren();
        assert.strictEqual(updatedSections.length, 0);
        
        // Try to get commands of deleted section (should be empty)
        const commands = await storeProvider.getChildren(sections[0]);
        assert.strictEqual(commands.length, 0);
    });

    test('Export Data', async () => {
        const provider = new StoreProvider(context);
        await provider.addSection('Test Section');
        const sections = await provider.getChildren();
        await provider.addCommand(sections[0].id, 'Test Command', 'echo test');

        const exported = await provider.exportData();
        const data = JSON.parse(exported) as StoreData;
        
        assert.strictEqual(data.sections.length, 1);
        assert.strictEqual(data.sections[0].label, 'Test Section');
        assert.strictEqual(data.commands.length, 1);
        assert.strictEqual(data.commands[0].label, 'Test Command');
        assert.strictEqual(data.commands[0].command, 'echo test');
    });

    test('Import Valid Data', async () => {
        const provider = new StoreProvider(context);
        const testData: StoreData = {
            sections: [{
                id: '123',
                label: 'Imported Section',
                type: 'section'
            }],
            commands: [{
                id: '456',
                label: 'Imported Command',
                command: 'echo imported',
                type: 'command',
                parentId: '123'
            }],
            tagColors: {},
            iconMappings: {}
        };

        await provider.importData(JSON.stringify(testData));
        const sections = await provider.getChildren();
        
        assert.strictEqual(sections.length, 1);
        assert.strictEqual(sections[0].label, 'Imported Section');
        
        const commands = await provider.getChildren(sections[0]);
        assert.strictEqual(commands.length, 1);
        assert.strictEqual(commands[0].label, 'Imported Command');
        assert.strictEqual((commands[0] as any).command, 'echo imported');
    });

    test('Import Invalid Data', async () => {
        const provider = new StoreProvider(context);
        const invalidData = {
            sections: [{
                label: 'Missing ID'  // Missing required fields
            }],
            commands: []
        };

        await assert.rejects(
            provider.importData(JSON.stringify(invalidData)),
            /Invalid data structure/
        );
    });

    test('Import Malformed JSON', async () => {
        const provider = new StoreProvider(context);
        await assert.rejects(
            provider.importData('{ not valid json }'),
            /Failed to import data/
        );
    });

    test('Drag and Drop Command to Section', async () => {
        const provider = new StoreProvider(context);
        // Create two sections
        await provider.addSection('Section 1');
        await provider.addSection('Section 2');
        const sections = await provider.getChildren();
        
        // Add command to first section
        await provider.addCommand(sections[0].id, 'Test Command', 'echo test');
        
        // Simulate drag and drop
        const commands = await provider.getChildren(sections[0]);
        const dataTransfer = new vscode.DataTransfer();
        await provider.handleDrag([commands[0]], dataTransfer);
        await provider.handleDrop(sections[1], dataTransfer);

        // Verify command moved to second section
        const section1Commands = await provider.getChildren(sections[0]);
        const section2Commands = await provider.getChildren(sections[1]);
        
        assert.strictEqual(section1Commands.length, 0);
        assert.strictEqual(section2Commands.length, 1);
        assert.strictEqual(section2Commands[0].label, 'Test Command');
    });

    test('Drag and Drop Command Reordering', async () => {
        const provider = new StoreProvider(context);
        await provider.addSection('Test Section');
        const sections = await provider.getChildren();
        
        // Add two commands
        await provider.addCommand(sections[0].id, 'Command 1', 'echo 1');
        await provider.addCommand(sections[0].id, 'Command 2', 'echo 2');
        
        // Get commands and simulate drag and drop
        const commands = await provider.getChildren(sections[0]);
        const dataTransfer = new vscode.DataTransfer();
        await provider.handleDrag([commands[0]], dataTransfer);
        await provider.handleDrop(commands[1], dataTransfer);

        // Verify command order changed
        const updatedCommands = await provider.getChildren(sections[0]);
        assert.strictEqual(updatedCommands.length, 2);
        assert.strictEqual(updatedCommands[0].label, 'Command 2');
        assert.strictEqual(updatedCommands[1].label, 'Command 1');
    });
});