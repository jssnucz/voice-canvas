import { toPng } from 'html-to-image';

export async function captureCanvas(): Promise<string> {
  const canvasElement = document.querySelector('.react-flow__viewport');
  if (!canvasElement) {
    throw new Error('画布元素未找到');
  }

  try {
    const dataUrl = await toPng(canvasElement as HTMLElement, {
      backgroundColor: '#111827',
      pixelRatio: 1,
      quality: 0.85,
    });

    return dataUrl.split(',')[1];
  } catch (err: any) {
    throw new Error(`截图失败: ${err.message}`);
  }
}
