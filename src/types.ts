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
}

export type StoreItem = StoreSection | StoreCommand;

export interface StoreData {
    sections: StoreSection[];
    commands: StoreCommand[];
}