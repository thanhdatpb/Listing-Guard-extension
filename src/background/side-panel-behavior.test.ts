import { describe, expect, it, vi } from 'vitest';
import { configureSidePanelOnActionClick } from './side-panel-behavior';

describe('side panel action behavior', () => {
  it('opens the side panel when the extension action is clicked', () => {
    const setPanelBehavior = vi.fn();
    configureSidePanelOnActionClick({ setPanelBehavior });
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });
});
