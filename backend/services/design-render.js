function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function elementHtml(item, value) {
    const style = item.style || {};
    const common = [
        'position:absolute',
        `left:${item.x}mm`,
        `top:${item.y}mm`,
        `width:${item.w}mm`,
        `height:${item.h}mm`,
        'box-sizing:border-box',
        'overflow:hidden',
    ];
    if (item.type === 'shape') {
        common.push(`background:${style.background || '#111827'}`);
        return `<div style="${common.join(';')}"></div>`;
    }
    if (item.type === 'table') {
        const columns = item.columns || [];
        const rows = (value && value.rows) || [];
        const head = columns.map((column) => `<th style="text-align:left;border-bottom:1px solid #111;padding:2px">${escapeHtml(column.label)}</th>`).join('');
        const body = rows.map((row) => `<tr>${columns.map((column) => `<td style="padding:2px">${escapeHtml(row[column.path] || '')}</td>`).join('')}</tr>`).join('');
        return `<div style="${common.join(';')}"><table style="width:100%;border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    const text = item.type === 'field' ? ((value && value.text) || '') : (item.text || '');
    common.push(
        `font-family:${style.fontFamily || 'Arial, sans-serif'}`,
        `font-size:${style.fontSize || 12}px`,
        `color:${style.color || '#111827'}`,
        `text-align:${style.align || 'left'}`,
        `font-weight:${style.bold ? 700 : 400}`,
        `background:${style.background || 'transparent'}`,
        'white-space:pre-wrap'
    );
    return `<div style="${common.join(';')}">${escapeHtml(text)}</div>`;
}

function buildDocumentHtml(design, values = {}) {
    const page = design.page || { widthMm: 210, heightMm: 297, background: '#ffffff' };
    const body = (design.pages || []).map((pageItem) => {
        const inner = (pageItem.elements || []).map((item) => elementHtml(item, values[item.id])).join('');
        return `<section class="sheet">${inner}</section>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(design.name || 'Receipt')}</title>
<style>
@page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: 0; }
body { margin: 0; background: #f3f4f6; }
.sheet { position: relative; width: ${page.widthMm}mm; height: ${page.heightMm}mm; background: ${page.background || '#fff'}; margin: 0 auto 8mm; overflow: hidden; }
</style></head><body>${body}</body></html>`;
}

module.exports = { buildDocumentHtml };
