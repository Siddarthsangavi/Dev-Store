# Dev Store

Dev Store is a VS Code extension that helps you organize and quickly access frequently used commands for different repositories. Keep your project-specific commands organized and easily accessible right from VS Code's sidebar.

## Features

- **Repository-based Organization**: Create separate sections for each repository or project
- **Command Management**: Store, edit, and organize commands within each section
- **Quick Access**: Run commands directly in the terminal or copy to clipboard
- **Rich Command Display**: Commands are displayed in a clear, readable format with labels
- **Keyboard Shortcuts**: Quick access to common actions

### Command Organization
![Feature Preview](resources/preview.gif)

- Create sections for different repositories/projects
- Add commands with descriptive labels
- Commands are stored with rich formatting for better readability
- Easy editing and deletion of sections and commands

### Quick Actions
- Copy commands to clipboard with one click
- Run commands directly in the integrated terminal
- Edit commands and sections inline
- Delete items with confirmation for safety

## Keyboard Shortcuts

- `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows/Linux): Add new section
- `Cmd+Shift+C` (Mac) / `Ctrl+Shift+C` (Windows/Linux): Add new command (when a section is selected)

## Usage

1. Click the Dev Store icon in the activity bar to open the sidebar
2. Click the "+" button to create a new section for your repository
3. Select a section and click the "+" button to add a command
4. Use the inline buttons to:
   - Edit items (pencil icon)
   - Delete items (trash icon)
   - Copy commands (copy icon)
   - Run commands in terminal (terminal icon)

## Requirements

- Visual Studio Code version 1.98.0 or higher

## Extension Settings

This extension currently stores all data in VS Code's global storage and doesn't require any additional configuration.

## Known Issues

If you find any issues, please report them at [https://github.com/yourusername/dev-store/issues](https://github.com/yourusername/dev-store/issues)

## Release Notes

### 0.0.1

Initial release of Dev Store:
- Basic section and command management
- Copy to clipboard functionality
- Run in terminal functionality
- Rich command display
- Keyboard shortcuts
