import { Command } from "cmdk";

export interface PaletteAction {
  id: string;
  label: string;
  icon?: string;
  group?: "Pages" | "Actions";
  keywords?: string[];
  onRun: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
  const pages = actions.filter((a) => a.group === "Pages");
  const otherActions = actions.filter((a) => a.group !== "Pages");

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Quick Find"
      overlayClassName="palette__overlay"
      contentClassName="palette__content"
    >
      <Command.Input className="palette__input" placeholder="Search pages or run a command... (Ctrl+P / Ctrl+K)" />
      <Command.List className="palette__list">
        <Command.Empty className="palette__empty">No matching pages or commands.</Command.Empty>
        {pages.length > 0 ? (
          <Command.Group heading="Pages">
            {pages.map((action) => (
              <Command.Item
                key={action.id}
                className="palette__item"
                value={`${action.label} ${action.keywords?.join(" ") ?? ""}`}
                onSelect={() => {
                  onOpenChange(false);
                  action.onRun();
                }}
              >
                {action.icon ? <span className="palette__item-icon">{action.icon}</span> : null}
                <span className="palette__item-label">{action.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
        {otherActions.length > 0 ? (
          <Command.Group heading="Actions">
            {otherActions.map((action) => (
              <Command.Item
                key={action.id}
                className="palette__item"
                value={`${action.label} ${action.keywords?.join(" ") ?? ""}`}
                onSelect={() => {
                  onOpenChange(false);
                  action.onRun();
                }}
              >
                {action.icon ? <span className="palette__item-icon">{action.icon}</span> : null}
                <span className="palette__item-label">{action.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
    </Command.Dialog>
  );
}
