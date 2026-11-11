export interface SidePanelBehaviorApi {
  setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void> | void;
}

export function configureSidePanelOnActionClick(sidePanel: SidePanelBehaviorApi): void {
  void sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
