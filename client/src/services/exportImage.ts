import { toPng } from 'html-to-image';

export async function exportToPNG(): Promise<void> {
  const canvasElement = document.querySelector('.react-flow__viewport');
  if (!canvasElement) {
    throw new Error('画布未就绪');
  }

  const dataUrl = await toPng(canvasElement as HTMLElement, {
    backgroundColor: '#111827',
    pixelRatio: 2,
    quality: 0.95,
  });

  const link = document.createElement('a');
  link.download = `voice-canvas-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}
