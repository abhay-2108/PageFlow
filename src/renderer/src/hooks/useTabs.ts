import { useCallback, useState } from "react";

export interface DesktopTab {
  id: string;
  pageId: string;
}

interface UseTabsOptions {
  onOpenPage: (id: string) => Promise<void>;
  onBeforeSwitch?: () => void;
}

export function useTabs({ onOpenPage, onBeforeSwitch }: UseTabsOptions) {
  const [tabs, setTabs] = useState<DesktopTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");

  const selectTab = useCallback(
    async (pageId: string, inNewTab = false) => {
      onBeforeSwitch?.();
      if (inNewTab || tabs.length === 0) {
        const tabId = crypto.randomUUID();
        setTabs((prev) => [...prev, { id: tabId, pageId }]);
        setActiveTabId(tabId);
      } else {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, pageId } : t)),
        );
      }
      await onOpenPage(pageId);
    },
    [activeTabId, onBeforeSwitch, onOpenPage, tabs.length],
  );

  const switchTab = useCallback(
    async (tabId: string) => {
      if (tabId === activeTabId) return;
      const target = tabs.find((t) => t.id === tabId);
      if (target) {
        onBeforeSwitch?.();
        setActiveTabId(tabId);
        await onOpenPage(target.pageId);
      }
    },
    [activeTabId, onBeforeSwitch, onOpenPage, tabs],
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      if (tabs.length <= 1) return;
      onBeforeSwitch?.();
      const index = tabs.findIndex((t) => t.id === tabId);
      const remaining = tabs.filter((t) => t.id !== tabId);
      setTabs(remaining);
      if (tabId === activeTabId) {
        const nextActive = remaining[Math.min(index, remaining.length - 1)];
        if (nextActive) {
          setActiveTabId(nextActive.id);
          await onOpenPage(nextActive.pageId);
        }
      }
    },
    [activeTabId, onBeforeSwitch, onOpenPage, tabs],
  );

  const openNewTab = useCallback(
    async (pageId: string) => {
      onBeforeSwitch?.();
      const tabId = crypto.randomUUID();
      setTabs((prev) => [...prev, { id: tabId, pageId }]);
      setActiveTabId(tabId);
      await onOpenPage(pageId);
    },
    [onBeforeSwitch, onOpenPage],
  );

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    selectTab,
    switchTab,
    closeTab,
    openNewTab,
  };
}
