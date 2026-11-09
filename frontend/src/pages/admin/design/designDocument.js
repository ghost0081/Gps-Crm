export const PAGE_PRESETS = [
    { id: 'a4', label: 'A4 portrait', widthMm: 210, heightMm: 297 },
    { id: 'a4-land', label: 'A4 landscape', widthMm: 297, heightMm: 210 },
    { id: 'a5', label: 'A5 portrait', widthMm: 148, heightMm: 210 },
    { id: 'receipt', label: 'Receipt', widthMm: 80, heightMm: 200 },
    { id: 'id-card', label: 'ID card', widthMm: 86, heightMm: 54 },
];

export const CATEGORIES = [
    { id: 'fee-receipt', label: 'Fee payment receipt' },
    { id: 'fee-due', label: 'Fee due receipt' },
    { id: 'fee-adjustment', label: 'Fee adjustment receipt' },
    { id: 'admission', label: 'Admission form' },
    { id: 'student-id', label: 'Student ID card' },
    { id: 'staff-id', label: 'Staff ID card' },
    { id: 'fee-structure', label: 'Fee structure' },
    { id: 'bonafide', label: 'Bonafide certificate' },
    { id: 'transfer', label: 'Transfer certificate' },
    { id: 'character', label: 'Character certificate' },
    { id: 'report-card', label: 'Report card' },
    { id: 'notice', label: 'Notice' },
    { id: 'letterhead', label: 'Letterhead' },
    { id: 'custom', label: 'Custom' },
];

export function categoryLabel(id) {
    return (CATEGORIES.find((item) => item.id === id) || { label: id || 'Custom' }).label;
}

export function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultStyle(overrides = {}) {
    return {
        fontFamily: 'Nirmala UI, Noto Sans Devanagari, Arial, sans-serif',
        fontSize: 12,
        color: '#111827',
        align: 'left',
        bold: false,
        italic: false,
        lineHeight: 1.3,
        background: 'transparent',
        borderWidth: 0,
        borderColor: '#111827',
        radius: 0,
        ...overrides,
    };
}

export function blankDesign(category = 'custom') {
    const preset = category.includes('id') ? PAGE_PRESETS[4] : PAGE_PRESETS[0];
    return {
        name: 'Untitled design',
        category,
        isDefault: false,
        page: { widthMm: preset.widthMm, heightMm: preset.heightMm, background: '#ffffff', marginMm: 0 },
        pages: [{ id: newId('page'), elements: [] }],
        assets: [],
    };
}

export function makeElement(partial) {
    return {
        id: partial.id || newId('el'),
        type: partial.type || 'text',
        x: partial.x ?? 12,
        y: partial.y ?? 12,
        w: partial.w ?? 60,
        h: partial.h ?? 10,
        rotation: partial.rotation || 0,
        z: partial.z || 1,
        locked: Boolean(partial.locked),
        groupId: partial.groupId || null,
        text: partial.text || '',
        binding: partial.binding || null,
        format: partial.format || 'text',
        style: defaultStyle(partial.style || {}),
        columns: partial.columns || [],
        assetId: partial.assetId || null,
        shape: partial.shape || 'rect',
    };
}

export function fieldToken(binding) {
    if (!binding) return '';
    return `{{ ${binding.label || binding.path} }}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function codeSvg(text) {
    const value = String(text || '');
    let x = 1;
    const bars = [];
    const source = value || ' ';
    for (let i = 0; i < source.length && x < 280; i += 1) {
        const width = 1 + (source.charCodeAt(i) % 3);
        bars.push(`<rect x="${x}" y="1" width="${width}" height="28" fill="#111827"/>`);
        x += width + 1;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(x + 2, 40)} 44" width="100%" height="100%" role="img">${bars.join('')}<text x="1" y="42" font-size="8" font-family="Arial">${escapeHtml(value).slice(0, 48)}</text></svg>`;
}

function elementHtml(item, value, assets) {
    const style = item.style || {};
    const common = [
        'position:absolute',
        `left:${item.x}mm`,
        `top:${item.y}mm`,
        `width:${item.w}mm`,
        `height:${item.h}mm`,
        `z-index:${item.z || 1}`,
        `transform:rotate(${item.rotation || 0}deg)`,
        'box-sizing:border-box',
        'overflow:hidden',
    ];
    if (item.type === 'shape') {
        const background = style.background && style.background !== 'transparent' ? style.background : '#111827';
        if (item.shape === 'ellipse') {
            common.push(`background:${background}`, `border-radius:${item.h}mm`);
        } else {
            common.push(`background:${background}`, `border-radius:${style.radius || 0}mm`);
        }
        return `<div style="${common.join(';')}"></div>`;
    }
    if (item.type === 'image') {
        const asset = (assets || []).find((entry) => entry.id === item.assetId);
        const src = asset ? asset.dataUrl : '';
        return `<div style="${common.join(';')}"><img alt="" src="${src}" style="width:100%;height:100%;object-fit:contain"/></div>`;
    }
    if (item.type === 'table') {
        const columns = item.columns || [];
        const rows = (value && value.rows) || [];
        const head = columns.map((column) => `<th style="text-align:left;border-bottom:1px solid #111;padding:2px 4px">${escapeHtml(column.label || column.path)}</th>`).join('');
        const body = rows.length
            ? rows.map((row) => `<tr>${columns.map((column) => `<td style="border-bottom:1px solid #e5e7eb;padding:2px 4px">${escapeHtml(row[column.path] || '')}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${Math.max(columns.length, 1)}" style="padding:4px;color:#6b7280">No rows for this record</td></tr>`;
        return `<div style="${common.join(';')};font-size:${style.fontSize || 11}px;font-family:${style.fontFamily}"><table style="width:100%;border-collapse:collapse">${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${body}</tbody></table></div>`;
    }
    const text = item.type === 'field' || item.type === 'code'
        ? ((value && value.text) || (item.type === 'field' ? fieldToken(item.binding) : ''))
        : (item.text || '');
    if (item.type === 'code') {
        return `<div style="${common.join(';')}">${codeSvg(text)}</div>`;
    }
    const textStyle = [
        ...common,
        `font-family:${style.fontFamily || 'Arial, sans-serif'}`,
        `font-size:${style.fontSize || 12}px`,
        `color:${style.color || '#111827'}`,
        `text-align:${style.align || 'left'}`,
        `font-weight:${style.bold ? 700 : 400}`,
        `font-style:${style.italic ? 'italic' : 'normal'}`,
        `line-height:${style.lineHeight || 1.3}`,
        `background:${style.background || 'transparent'}`,
        `border:${style.borderWidth || 0}px solid ${style.borderColor || '#111827'}`,
        `border-radius:${style.radius || 0}px`,
        'white-space:pre-wrap',
        'word-break:break-word',
        'padding:0.4mm',
    ];
    return `<div style="${textStyle.join(';')}">${escapeHtml(text)}</div>`;
}

export function buildDocumentHtml(design, values = {}) {
    const page = design.page || { widthMm: 210, heightMm: 297, background: '#ffffff' };
    const pages = (design.pages || []).map((pageItem, index) => {
        const body = (pageItem.elements || [])
            .slice()
            .sort((a, b) => (a.z || 1) - (b.z || 1))
            .map((item) => elementHtml(item, values[item.id], design.assets))
            .join('');
        return `<section class="sheet" style="page-break-after:${index === design.pages.length - 1 ? 'auto' : 'always'}">${body}</section>`;
    }).join('');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(design.name || 'School document')}</title>
<style>
  @page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #f3f4f6; }
  .sheet {
    position: relative;
    width: ${page.widthMm}mm;
    height: ${page.heightMm}mm;
    background: ${page.background || '#fff'};
    margin: 0 auto 8mm;
    overflow: hidden;
  }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; }
  }
</style>
</head>
<body>${pages}</body>
</html>`;
}

export function modelsOnDesign(design) {
    const names = new Set();
    (design.pages || []).forEach((pageItem) => {
        (pageItem.elements || []).forEach((item) => {
            if (item.binding && item.binding.model && item.binding.model !== 'admin') {
                names.add(item.binding.model);
            }
        });
    });
    return [...names];
}
