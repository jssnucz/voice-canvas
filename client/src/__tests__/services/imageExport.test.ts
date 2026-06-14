import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockToPng = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({
  toPng: mockToPng,
}));

import { captureCanvas } from '../../services/canvasSnapshot';
import { exportToPNG } from '../../services/exportImage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('captureCanvas', () => {
  it('throws when .react-flow__viewport element not found', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(null);

    await expect(captureCanvas()).rejects.toThrow('画布元素未找到');
  });

  it('returns base64 string (stripped of data: prefix) on success', async () => {
    const mockDiv = document.createElement('div');
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(mockDiv);

    mockToPng.mockResolvedValueOnce('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA');

    const result = await captureCanvas();
    expect(result).toBe('iVBORw0KGgoAAAANSUhEUgAA');
    expect(mockToPng).toHaveBeenCalledWith(mockDiv, {
      backgroundColor: '#111827',
      pixelRatio: 1,
      quality: 0.85,
    });
  });

  it('wraps toPng errors with "截图失败" message', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(document.createElement('div'));
    mockToPng.mockRejectedValueOnce(new Error('canvas error'));

    await expect(captureCanvas()).rejects.toThrow('截图失败: canvas error');
  });
});

describe('exportToPNG', () => {
  it('triggers download with correct filename and pixelRatio=2', async () => {
    const mockDiv = document.createElement('div');
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(mockDiv);

    mockToPng.mockResolvedValueOnce('data:image/png;base64,abc123');

    const mockLink = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as unknown as HTMLElement);

    const before = Date.now();
    await exportToPNG();
    const after = Date.now();

    expect(mockToPng).toHaveBeenCalledWith(mockDiv, {
      backgroundColor: '#111827',
      pixelRatio: 2,
      quality: 0.95,
    });

    expect(mockLink.href).toBe('data:image/png;base64,abc123');
    expect(mockLink.download).toMatch(/^voice-canvas-\d+\.png$/);
    const tsInFilename = Number(mockLink.download.replace('voice-canvas-', '').replace('.png', ''));
    expect(tsInFilename).toBeGreaterThanOrEqual(before);
    expect(tsInFilename).toBeLessThanOrEqual(after);
    expect(mockLink.click).toHaveBeenCalledOnce();
  });

  it('throws when canvas element not found', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(null);

    await expect(exportToPNG()).rejects.toThrow('画布未就绪');
  });
});
