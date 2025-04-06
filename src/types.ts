export interface StoreItem {
    id: string;
    label: string;
    type: 'section' | 'command';
}

export interface StoreSection extends StoreItem {
    type: 'section';
}

export interface StoreCommand extends StoreItem {
    type: 'command';
    command: string;
    parentId: string;
    tags?: string[];
    icon?: string; // New field for storing the command's icon
}

export interface StoreData {
    sections: StoreSection[];
    commands: StoreCommand[];
    tagColors: Record<string, string>;
    iconMappings?: Record<string, string>; // New field for storing icon mappings
} 