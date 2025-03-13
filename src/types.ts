export type CommandIconType = 
    | 'terminal'      // default terminal commands
    | 'git'          // git commands
    | 'npm'          // npm/node commands
    | 'database'     // database commands (mongo, sql, etc)
    | 'docker'       // docker commands
    | 'cloud'        // cloud/deployment commands
    | 'test'         // test commands
    | 'build'        // build commands
    | 'debug'        // debug commands
    | 'folder'       // file system commands
    | 'settings'     // configuration commands
    | 'run'          // run/serve commands
    | 'code';        // unknown/other commands

export interface StoreSection {
    id: string;
    label: string;
    type: 'section';
}

export interface StoreCommand {
    id: string;
    label: string;
    command: string;
    type: 'command';
    parentId: string;
    iconType?: CommandIconType;
}

export type StoreItem = StoreSection | StoreCommand;

export interface StoreData {
    sections: StoreSection[];
    commands: StoreCommand[];
}