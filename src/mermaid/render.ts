import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

let n = 0;

export async function renderMermaid(code: string): Promise<{ svg: string }> {
  return mermaid.render(`mmd-${n++}`, code);
}

export async function svgToPng(svg: string, scale = 2): Promise<Uint8Array> {
  const m = svg.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.\-]+) ([\d.\-]+)"/);
  const w = m ? parseFloat(m[1]) : 800;
  const h = m ? parseFloat(m[2]) : 600;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    const { promise, resolve } = Promise.withResolvers<Blob>();
    c.toBlob((b) => resolve(b!), 'image/png');
    const blob = await promise;
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
