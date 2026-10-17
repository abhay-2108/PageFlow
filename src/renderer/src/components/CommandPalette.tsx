import { Command } from "cmdk";

export interface PaletteAction {
  id: string;
  label: string;
  keywords?: string[];
  onRun: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command menu"
      overlayClassName="palette__overlay"
      contentClassName="palette__content"
    >
      <Command.Input className="palette__input" placeholder="Type a command or search…" />
      <Command.List className="palette__list">
        <Command.Empty className="palette__empty">No matching commands.</Command.Empty>
        {actions.map((action) => (
          <Command.Item
            key={action.id}
            className="palette__item"
            value={action.label}
            keywords={action.keywords}
            onSelect={() => {
              onOpenChange(false);
              action.onRun();
            }}
          >
            {action.label}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
