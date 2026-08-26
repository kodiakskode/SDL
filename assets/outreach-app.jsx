// SDL Creations — Outreach tab
//
// OutreachTab and its helper components below (down to the "END verbatim
// OutreachTab.jsx" marker) are carried over unmodified from
// kodiakskode/rawleads src/OutreachTab.jsx. Everything above and below that
// block is new glue: the api() fetch wrapper the README asks the host
// dashboard to provide, and the mount call.
//
// There's no login here — no accounts exist anywhere on this dashboard, and
// the backend (server/no-auth.js) doesn't require one either. Anyone who can
// reach OUTREACH_API_BASE can use this tab; see the note at the top of
// server/index.js for that trade-off.
'use strict';
const { useState, useEffect, useRef } = React;

// Must match OUTREACH_API_BASE on the server (server/.env). Point this at
// wherever the backend in server/ is actually deployed — GitHub Pages can't
// run it, so in production this is a different origin than the dashboard
// itself.
const API_BASE = window.SDL_OUTREACH_API_BASE || 'https://sdl.helixsolution.au/rawleads/api';

// Verbatim contract from rawleads' own public/outreach.html: every outreach
// call goes through this wrapper.
async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    const e = new Error(err.error || 'Request failed');
    e.upgrade = err.upgrade;
    throw e;
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────
// BEGIN verbatim OutreachTab.jsx (kodiakskode/rawleads src/OutreachTab.jsx)
// ─────────────────────────────────────────────────────────────────────────

// ── Outreach Tab ──────────────────────────────────────────────────────────────
function OutreachTab() {
  const [view, setView]             = useState('send');
  const [smtp, setSmtp]             = useState(null);
  const [templates, setTemplates]   = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/outreach/smtp').then(setSmtp),
      api('/outreach/templates').then(setTemplates),
    ]).catch(() => {}).finally(() => setLoadingInit(false));
  }, []);

  if (loadingInit) return <div style={{ textAlign:'center', padding:40 }}><span className="spin" /></div>;

  return (
    <div>
      <div className="section-head"><h2>Outreach</h2></div>
      <div className="src-tabs" style={{ marginBottom:24 }}>
        {[['send','Send Emails'],['templates','Templates'],['history','History'],['settings','Settings']].map(([k,l]) => (
          <button key={k} className={'src-tab' + (view===k ? ' active' : '')} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>
      {view === 'send'      && <OutreachSend smtp={smtp} templates={templates} setTemplates={setTemplates} />}
      {view === 'templates' && <OutreachTemplates templates={templates} setTemplates={setTemplates} />}
      {view === 'history'   && <OutreachHistory />}
      {view === 'settings'  && <OutreachSettings smtp={smtp} setSmtp={setSmtp} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Builder helpers
// ═══════════════════════════════════════════════════════════════════
const BUILDER_FONTS = [
  { label:'Helvetica (default)', value:'Helvetica, Arial, sans-serif' },
  { label:'Arial',               value:'Arial, sans-serif' },
  { label:'Georgia',             value:'Georgia, serif' },
  { label:'Times New Roman',     value:"'Times New Roman', serif" },
  { label:'Verdana',             value:'Verdana, sans-serif' },
  { label:'Courier New',         value:"'Courier New', monospace" },
];
const DFLT_STYLE = { font:'Helvetica, Arial, sans-serif', textColor:'#e8edf2', bgColor:'#0b0f1a', cardColor:'#111827', accentColor:'#a3af56', cardEnabled:true, cardPadding:32, cardRadius:12, cardMarginTop:0 };

// Default template shown to all users on first open (and as new-user placeholder)
const DFLT_OUTREACH = {
  subject: 'Transmission Subject',
  rawMode: false,
  rawBody: '',
  blocks: [
    {"id":"9bvdo8h2","type":"spacer","height":24},
    {"id":"p4ybjkpm","type":"text","content":"MAKE CONTACT","textType":"h2","align":"center","color":""},
    {"id":"rug8d989","type":"text","content":"Some messages travel further than others. Refine yours with visuals, actions, and a carefully chosen palette before sending it into the unknown.","textType":"p","align":"center","color":""},
    {"id":"z5m3pwxr","type":"spacer","height":24},
    {"id":"2j1qhhen","type":"button","content":"CONNECT","url":"https://","align":"center","bgColor":"#bab2a4","textColor":"#302c2a","radius":11,"paddingX":52,"paddingY":16}
  ],
  style: {"font":"Helvetica, Arial, sans-serif","textColor":"#b9b1a4","bgColor":"#1d1b18","cardColor":"#2d2b27","accentColor":"#000000","cardEnabled":true,"cardPadding":32,"cardRadius":12},
  logo: {"enabled":true,"src":"","alt":"Logo"},
  footer: {"enabled":false,"content":"© 2025 Your Company. All rights reserved."}
};
function loadOutreachDraft() {
  try { const s = localStorage.getItem('rl_outreach_draft'); if (s) return JSON.parse(s); } catch {}
  return DFLT_OUTREACH;
}
const MERGE_TAGS = ['{{name}}','{{business}}','{{phone}}','{{address}}','{{industry}}','{{niche}}','{{location}}','{{ig_handle}}','{{followers}}'];

function mkBlock(type, zone) {
  const id = Math.random().toString(36).slice(2,10);
  const z = zone || 'inside';
  if (type==='heading') return { id, type:'text', content:'Hi {{name}},', textType:'h2', align:'left', color:'', zone:z };
  if (type==='text')    return { id, type:'text', content:'Write your message here.', textType:'p', align:'left', color:'', zone:z };
  if (type==='button')  return { id, type, content:'Get Started', url:'https://', align:'center', bgColor:'#a3af56', textColor:'#ffffff', radius:10, paddingX:24, paddingY:14, zone:z };
  if (type==='image')   return { id, type, src:'', alt:'', align:'center', zone:z };
  if (type==='divider') return { id, type, zone:z };
  if (type==='spacer')  return { id, type, height:24, zone:z };
  return { id, type, zone:z };
}

function mergeVars(text, lead) {
  if (!lead || !text) return text || '';
  return text
    .replace(/\{\{name\}\}/gi,      lead.business_name||lead.ig_handle||'')
    .replace(/\{\{business\}\}/gi,  lead.business_name||'')
    .replace(/\{\{phone\}\}/gi,     lead.phone||'')
    .replace(/\{\{email\}\}/gi,     lead.email||'')
    .replace(/\{\{address\}\}/gi,   lead.address||'')
    .replace(/\{\{industry\}\}/gi,  lead.industry||'')
    .replace(/\{\{niche\}\}/gi,     lead.niche||lead.industry||'')
    .replace(/\{\{location\}\}/gi,  lead.location||'')
    .replace(/\{\{ig_handle\}\}/gi, lead.ig_handle?'@'+lead.ig_handle:'')
    .replace(/\{\{followers\}\}/gi, lead.followers!=null?String(lead.followers):'');
}

function builderToHtml(data, lead) {
  const s = Object.assign({}, DFLT_STYLE, data.style||{});
  const logo = data.logo || {};
  const footer = data.footer || {};
  const m = t => mergeVars(t, lead);
  const allBlocks = data.blocks || [];
  const aboveBlocks  = allBlocks.filter(b => b.zone === 'above');
  const insideBlocks = allBlocks.filter(b => !b.zone || b.zone === 'inside');
  const belowBlocks  = allBlocks.filter(b => b.zone === 'below');
  function renderBlock(b) {
    const al = b.align||'left';
    if (b.type==='text') { const tt=b.textType||'p'; if(tt!=='p'){ const sz=tt==='h1'?'28px':tt==='h3'?'16px':'22px'; return `<div style="text-align:${al};margin:0 0 12px"><${tt} style="font-family:${s.font};color:${b.color||s.textColor};font-size:${sz};font-weight:700;margin:0;line-height:1.3">${m(b.content||'')}</${tt}></div>`; } else { return `<div style="text-align:${al};margin:0 0 14px"><p style="font-family:${s.font};color:${b.color||s.textColor};font-size:15px;line-height:1.7;margin:0">${m((b.content||'').replace(/\n/g,'<br>'))}</p></div>`; } }
    if (b.type==='button') return `<div style="text-align:${al};margin:8px 0 20px"><a href="${b.url||'#'}" style="display:inline-block;background:${b.bgColor||s.accentColor};color:${b.textColor||'#fff'};font-family:${s.font};font-size:14px;font-weight:600;padding:${b.paddingY||14}px ${b.paddingX||24}px;border-radius:${b.radius!=null?b.radius:10}px;text-decoration:none;line-height:1">${m(b.content||'Button')}</a></div>`;
    if (b.type==='image'&&b.src) return `<div style="text-align:${al};margin:8px 0 16px"><img src="${b.src}" alt="${b.alt||''}" style="max-width:100%;border-radius:6px;display:inline-block"></div>`;
    if (b.type==='divider') return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:14px 0">`;
    if (b.type==='spacer') return `<div style="height:${b.height||24}px"></div>`;
    return '';
  }
  const aboveHtml  = aboveBlocks.map(renderBlock).join('');
  let innerHtml = '';
  if (logo.enabled && logo.src) innerHtml += `<div style="text-align:center;padding:16px 0 8px"><img src="${logo.src}" alt="${logo.alt||'Logo'}" style="max-height:60px;max-width:220px;display:inline-block"></div>`;
  innerHtml += insideBlocks.map(renderBlock).join('');
  if (footer.enabled && footer.content) innerHtml += `<div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-family:${s.font};font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6">${m(footer.content).replace(/\n/g,'<br>')}</div>`;
  const belowHtml  = belowBlocks.map(renderBlock).join('');
  const useCard = s.cardEnabled !== false;
  const cp  = Math.max(0, parseInt(s.cardPadding)    || 32);
  const cr  = Math.max(0, parseInt(s.cardRadius)     || 12);
  const cmt = Math.max(0, parseInt(s.cardMarginTop)  || 0);
  const aboveSection = aboveHtml ? `<div style="max-width:600px;margin:0 auto">${aboveHtml}</div>` : '';
  const belowSection = belowHtml ? `<div style="max-width:600px;margin:0 auto">${belowHtml}</div>` : '';
  const cardDiv = useCard
    ? `<div style="max-width:600px;margin:${cmt}px auto 0;background:${s.cardColor};border-radius:${cr}px;padding:${cp}px ${Math.round(cp*1.1)}px">${innerHtml}</div>`
    : `<div style="max-width:600px;margin:${cmt}px auto 0">${innerHtml}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:${s.bgColor}">${aboveSection}${cardDiv}${belowSection}<footer style="text-align:center;padding:18px;font-size:.62rem;color:#5d574d;letter-spacing:.04em;">
  © 2025 RawLeads. ·
  <a href="/rawleads/privacy" style="color:#5d574d;text-decoration:none;" onmouseover="this.style.color='#afb966'" onmouseout="this.style.color='#5d574d'">Privacy &amp; Terms</a>
</footer>
</body></html>`;
}

// ── LiveEmailPreview ──────────────────────────────────────────────
// React-rendered email preview with click-to-select and inline text editing
function LiveEmailPreview({ blocks, style, logo, footer, editId, onSelectBlock, onUpdateBlock }) {
  const s = Object.assign({}, DFLT_STYLE, style || {});
  const useCard = s.cardEnabled !== false;
  const cp  = Math.max(0, parseInt(s.cardPadding)   || 32);
  const cr  = Math.max(0, parseInt(s.cardRadius)    || 12);
  const cmt = Math.max(0, parseInt(s.cardMarginTop) || 0);
  const allBlocks    = blocks || [];
  const aboveBlocks  = allBlocks.filter(b => b.zone === 'above');
  const insideBlocks = allBlocks.filter(b => !b.zone || b.zone === 'inside');
  const belowBlocks  = allBlocks.filter(b => b.zone === 'below');

  function renderBlock(b) {
    const al = b.align || 'left';
    const isActive = editId === b.id;
    const baseWrap = {
      outline: isActive ? '2px solid rgba(163,175,86,.85)' : '1px dashed transparent',
      outlineOffset: 2, borderRadius: 3, cursor: 'pointer', transition: 'outline .1s',
    };
    function wrap(inner, extra) {
      return (
        <div key={b.id} style={{ ...baseWrap, ...extra }}
          onClick={e => {
            e.stopPropagation();
            if (!isActive) onSelectBlock(b.id); // already active → let click land in contentEditable
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.outline='1px dashed rgba(163,175,86,.3)'; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.outline='1px dashed transparent'; }}
        >{inner}</div>
      );
    }
    if (b.type === 'text') {
      const tt = b.textType || 'p';
      const sz = tt==='h1'?'28px':tt==='h2'?'22px':tt==='h3'?'16px':'15px';
      const fw = tt !== 'p' ? 700 : 400;
      const Tag = tt === 'p' ? 'p' : tt;
      return wrap(
        <Tag contentEditable={isActive} suppressContentEditableWarning
          onBlur={e => { if (isActive) onUpdateBlock({ ...b, content: e.currentTarget.textContent }); }}
          style={{ fontFamily:s.font, color:b.color||s.textColor, fontSize:sz, fontWeight:fw,
            lineHeight:tt!=='p'?1.3:1.7, margin:tt!=='p'?'0 0 12px':'0 0 14px',
            textAlign:al, outline:'none', display:'block', cursor:isActive?'text':'pointer' }}
        >{b.content||''}</Tag>
      );
    }
    if (b.type === 'button') {
      return wrap(
        <div style={{ textAlign:al, margin:'8px 0 20px' }}>
          <span contentEditable={isActive} suppressContentEditableWarning
            onBlur={e => { if (isActive) onUpdateBlock({ ...b, content: e.currentTarget.textContent }); }}
            style={{ display:'inline-block', background:b.bgColor||s.accentColor, color:b.textColor||'#fff',
              fontFamily:s.font, fontSize:14, fontWeight:600,
              padding:`${b.paddingY||14}px ${b.paddingX||24}px`,
              borderRadius:`${b.radius!=null?b.radius:10}px`,
              lineHeight:1, outline:'none', cursor:isActive?'text':'pointer' }}
          >{b.content||'Button'}</span>
        </div>
      );
    }
    if (b.type === 'image') {
      if (!b.src) return wrap(
        <div style={{ textAlign:'center', padding:'18px 0', background:'rgba(255,255,255,.04)',
          borderRadius:4, fontSize:12, color:'rgba(255,255,255,.3)' }}>No image set</div>
      );
      return wrap(
        <div style={{ textAlign:al, margin:'8px 0 16px' }}>
          <img src={b.src} alt={b.alt||''} style={{ maxWidth:'100%', borderRadius:6, display:'inline-block' }} />
        </div>
      );
    }
    if (b.type === 'divider') return wrap(
      <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,.1)', margin:'14px 0' }} />
    );
    if (b.type === 'spacer') return wrap(
      <div style={{ height:b.height||24, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isActive && <span style={{ fontSize:10, color:'rgba(163,175,86,.6)', fontFamily:'sans-serif' }}>{b.height||24}px spacer</span>}
      </div>
    );
    return null;
  }

  const logoEl = logo?.enabled && logo.src
    ? <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
        <img src={logo.src} alt={logo.alt||'Logo'} style={{ maxHeight:60, maxWidth:220, display:'inline-block' }} />
      </div>
    : null;
  const footerEl = footer?.enabled && footer.content
    ? <div style={{ marginTop:20, paddingTop:14, borderTop:'1px solid rgba(255,255,255,.08)',
        textAlign:'center', fontFamily:s.font, fontSize:12, color:'rgba(255,255,255,.35)', lineHeight:1.6 }}>
        {footer.content}
      </div>
    : null;

  return (
    <div style={{ margin:0, padding:24, background:s.bgColor, minHeight:420, boxSizing:'border-box' }}>
      {aboveBlocks.length > 0 && (
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          {aboveBlocks.map(b => renderBlock(b))}
        </div>
      )}
      {useCard
        ? <div style={{ maxWidth:600, margin:`${cmt}px auto 0`, background:s.cardColor, borderRadius:cr, padding:`${cp}px ${Math.round(cp*1.1)}px` }}>
            {logoEl}{insideBlocks.map(b => renderBlock(b))}{footerEl}
          </div>
        : <div style={{ maxWidth:600, margin:`${cmt}px auto 0` }}>
            {logoEl}{insideBlocks.map(b => renderBlock(b))}{footerEl}
          </div>
      }
      {belowBlocks.length > 0 && (
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          {belowBlocks.map(b => renderBlock(b))}
        </div>
      )}
      {allBlocks.length === 0 && (
        <div style={{ maxWidth:600, margin:'0 auto', textAlign:'center', paddingTop:40, fontFamily:'sans-serif', fontSize:13, color:'rgba(255,255,255,.2)' }}>
          Add blocks to see preview
        </div>
      )}
    </div>
  );
}

// ── ColorInput ────────────────────────────────────────────────────
function ColorInput({ label, value, onChange }) {
  return (
    <div>
      {label && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:5 }}>{label}</div>}
      <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--glass)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 9px' }}>
        <input type="color" value={value||'#000000'} onChange={e=>onChange(e.target.value)}
          style={{ width:20, height:20, border:'none', background:'none', cursor:'pointer', padding:0, borderRadius:3 }} />
        <input type="text" value={value||''} onChange={e=>onChange(e.target.value)}
          style={{ background:'transparent', border:'none', color:'var(--text)', fontSize:12, fontFamily:'monospace', width:66, outline:'none' }} />
      </div>
    </div>
  );
}

// ── AlignButtons ──────────────────────────────────────────────────
function AlignBtns({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {['left','center','right'].map(a => (
        <button key={a} type="button" onClick={()=>onChange(a)} style={{
          flex:1, padding:'5px 0', fontSize:11, borderRadius:5, border:value===a ? '1px solid rgba(91,96,46,.6)' : '1px solid var(--border)', cursor:'pointer',
          background: value===a ? 'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)' : 'var(--glass)',
          color:      value===a ? '#fff8f0'     : 'var(--muted)',
          textShadow: value===a ? '0 1px 1px rgba(56,58,24,.5)' : 'none',
          boxShadow:  value===a ? 'inset 0 1px 0 rgba(230,239,208,.5),inset 0 -1px 2px rgba(0,0,0,.35),0 0 9px rgba(175,185,102,.4)' : 'none',
        }}>{a}</button>
      ))}
    </div>
  );
}

// ── BlockEditor ───────────────────────────────────────────────────
function BlockEditor({ block, onChange }) {
  const upd = p => onChange({ ...block, ...p });
  const panelStyle = { padding:'14px 16px', background:'rgba(163,175,86,.04)', borderTop:'1px solid var(--border-teal)' };
  const lbl = (t) => <div style={{ fontSize:10, fontWeight:700, color:'var(--teal)', letterSpacing:'.1em', marginBottom:10 }}>EDITING: {t}</div>;
  const fieldLbl = (t) => <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{t}</div>;
  const grid2 = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 };

  if (block.type === 'text') return (
    <div style={panelStyle}>
      {lbl('TEXT')}
      <div style={{ marginBottom:10 }}>
        {fieldLbl('Type')}
        <select value={block.textType||'p'} onChange={e=>upd({textType:e.target.value})} style={{ width:'100%' }}>
          <option value="p">Paragraph</option>
          <option value="h1">Heading — H1 (Large)</option>
          <option value="h2">Heading — H2 (Medium)</option>
          <option value="h3">Heading — H3 (Small)</option>
        </select>
      </div>
      <div style={{ marginBottom:10 }}>
        {fieldLbl('Content')}
        <textarea value={block.content||''} onChange={e=>upd({content:e.target.value})}
          style={{ width:'100%', minHeight:80, fontFamily:'inherit', fontSize:13, lineHeight:1.6, resize:'vertical' }} />
      </div>
      <div style={{ ...grid2, marginBottom:10 }}>
        <div>{fieldLbl('Alignment')}<AlignBtns value={block.align||'left'} onChange={v=>upd({align:v})} /></div>
        <div><ColorInput label="Color (blank = default)" value={block.color||''} onChange={v=>upd({color:v})} /></div>
      </div>
    </div>
  );

  if (block.type === 'button') return (
    <div style={panelStyle}>
      {lbl('BUTTON')}
      <div style={{ ...grid2, marginBottom:10 }}>
        <div>{fieldLbl('Button label')}<input value={block.content||''} onChange={e=>upd({content:e.target.value})} style={{ width:'100%' }} /></div>
        <div>{fieldLbl('Link (href)')}<input value={block.url||''} onChange={e=>upd({url:e.target.value})} style={{ width:'100%' }} /></div>
      </div>
      <div style={{ ...grid2, marginBottom:10 }}>
        <ColorInput label="Background" value={block.bgColor||'#a3af56'} onChange={v=>upd({bgColor:v})} />
        <ColorInput label="Text color"  value={block.textColor||'#0b0f1a'} onChange={v=>upd({textColor:v})} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        <div>{fieldLbl('Radius (px)')}<input type="number" value={block.radius!=null?block.radius:10} onChange={e=>upd({radius:parseInt(e.target.value)||0})} style={{ width:'100%' }} /></div>
        <div>{fieldLbl('Padding X')}<input type="number" value={block.paddingX!=null?block.paddingX:24} onChange={e=>upd({paddingX:parseInt(e.target.value)||0})} style={{ width:'100%' }} /></div>
        <div>{fieldLbl('Padding Y')}<input type="number" value={block.paddingY!=null?block.paddingY:14} onChange={e=>upd({paddingY:parseInt(e.target.value)||0})} style={{ width:'100%' }} /></div>
      </div>
      {fieldLbl('Alignment')}
      <AlignBtns value={block.align||'center'} onChange={v=>upd({align:v})} />
    </div>
  );

  if (block.type === 'image') return (
    <div style={panelStyle}>
      {lbl('IMAGE')}
      <div style={{ marginBottom:10 }}>
        {fieldLbl('Image URL or upload')}
        <div style={{ display:'flex', gap:8 }}>
          <input value={block.src||''} onChange={e=>upd({src:e.target.value})} placeholder="https://..." style={{ flex:1 }} />
          <label style={{ display:'flex', alignItems:'center', padding:'6px 12px', background:'var(--glass)', border:'1px solid var(--border)', borderRadius:6, fontSize:11, cursor:'pointer', whiteSpace:'nowrap', color:'var(--muted)' }}>
            ↑ Upload
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
              const f=e.target.files[0]; if (!f) return;
              const r=new FileReader(); r.onload=ev=>upd({src:ev.target.result}); r.readAsDataURL(f);
            }} />
          </label>
        </div>
      </div>
      <div style={grid2}>
        <div>{fieldLbl('Alt text')}<input value={block.alt||''} onChange={e=>upd({alt:e.target.value})} style={{ width:'100%' }} /></div>
        <div>{fieldLbl('Alignment')}<AlignBtns value={block.align||'center'} onChange={v=>upd({align:v})} /></div>
      </div>
    </div>
  );

  if (block.type === 'spacer') return (
    <div style={panelStyle}>
      {lbl('SPACER')}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {fieldLbl('Height (px)')}
        <input type="number" value={block.height||24} onChange={e=>upd({height:parseInt(e.target.value)||0})} style={{ width:90 }} />
      </div>
    </div>
  );

  return null;
}

// ── TemplateEditor ────────────────────────────────────────────────
function TemplateEditor({ initial, onSave, onCancel }) {
  const initData = (() => { try { return initial?.builder_json ? JSON.parse(initial.builder_json) : null; } catch { return null; } })();

  const [tmplName, setTmplName] = useState(initial?.name || '');
  const [rawMode, setRawMode]   = useState(initData?.rawMode ?? false);
  const [subject, setSubject]   = useState(initData?.subject || initial?.subject || '');
  const [rawBody, setRawBody]   = useState(initial?.body || '');
  const [blocks, setBlocks]     = useState(initData?.blocks || []);
  const [style, setStyle]       = useState(Object.assign({}, DFLT_STYLE, initData?.style||{}));
  const [logo, setLogo]         = useState(initData?.logo   || { enabled:false, src:'', alt:'Logo' });
  const [footer, setFooter]     = useState(initData?.footer || { enabled:false, content:'© 2025 Your Company. All rights reserved.' });
  const [editingIdx, setEditingIdx] = useState(null);
  const [cardFolderOpen, setCardFolderOpen] = useState(true);
  const [addZone, setAddZone]   = useState('inside');
  const [dragIdx, setDragIdx]   = useState(null);
  const [dropIdx, setDropIdx]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const editingId = editingIdx !== null ? (blocks[editingIdx]?.id || null) : null;

  function addBlock(type) {
    const nb = mkBlock(type, addZone);
    setBlocks(bs => {
      if (addZone === 'above') {
        let pos = 0; bs.forEach((b,i) => { if (b.zone==='above') pos=i+1; });
        return [...bs.slice(0,pos), nb, ...bs.slice(pos)];
      } else if (addZone === 'below') {
        return [...bs, nb];
      } else {
        const fp = bs.findIndex(b => b.zone==='below');
        return fp===-1 ? [...bs, nb] : [...bs.slice(0,fp), nb, ...bs.slice(fp)];
      }
    });
    setEditingIdx(null);
  }
  function updateBlock(upd) { setBlocks(bs => bs.map(b => b.id===upd.id ? upd : b)); }
  function moveBlock(from, to) {
    if (to < 0 || to >= blocks.length) return;
    setBlocks(bs => { const n=[...bs]; const [it]=n.splice(from,1); n.splice(to,0,it); return n; });
    setEditingIdx(to);
  }
  function deleteBlock(idx) { setBlocks(bs => bs.filter((_,i)=>i!==idx)); setEditingIdx(null); }
  function handleDrop(targetIdx) {
    if (dragIdx===null||dragIdx===targetIdx) return;
    moveBlock(dragIdx, targetIdx);
    setDragIdx(null); setDropIdx(null);
  }

  async function save() {
    if (!tmplName.trim()) { setErr('Enter a template name'); return; }
    if (!subject.trim())  { setErr('Enter a subject line'); return; }
    setErr(''); setLoading(true);
    const body = rawMode ? rawBody : '';
    const builder_json = rawMode ? null : JSON.stringify({ rawMode:false, subject, blocks, style, logo, footer });
    try {
      let saved;
      if (initial?.id) {
        saved = await api('/outreach/templates/'+initial.id, { method:'PUT', body:{ name:tmplName.trim(), subject, body, builder_json } });
      } else {
        saved = await api('/outreach/templates', { method:'POST', body:{ name:tmplName.trim(), subject, body, builder_json } });
      }
      onSave(saved);
    } catch(e) { setErr(e.message); } finally { setLoading(false); }
  }

  const typeColors = { heading:'#a3af56', text:'var(--text)', button:'#a78bfa', image:'#b8cd6a', divider:'var(--muted)', spacer:'var(--muted)' };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <button className="btn btn-sm" onClick={onCancel}>&larr; Back</button>
        <input value={tmplName} onChange={e=>setTmplName(e.target.value)} placeholder="Template name"
          style={{ flex:1, minWidth:150, maxWidth:220 }} />
        <div style={{ display:'flex', background:'var(--glass)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          {[['builder','Builder'],['raw','Raw']].map(([k,l]) => (
            <button key={k} type="button" onClick={()=>setRawMode(k==='raw')}
              style={{ padding:'6px 16px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', transition:'all .15s',
                background: (k==='raw')===rawMode ? 'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)' : 'transparent',
                textShadow: (k==='raw')===rawMode ? '0 1px 1px rgba(56,58,24,.5)' : 'none',
                boxShadow:  (k==='raw')===rawMode ? 'inset 0 1px 0 rgba(230,239,208,.5),inset 0 -1px 2px rgba(0,0,0,.35),0 0 9px rgba(175,185,102,.4)' : 'none',
                color:      (k==='raw')===rawMode ? '#fff8f0'     : 'var(--muted)' }}>{l}</button>
          ))}
        </div>
        <button className="btn-teal" onClick={save} disabled={loading} style={{ padding:'7px 20px' }}>
          {loading ? <span className="spin" /> : 'Save template'}
        </button>
      </div>
      {err && <div className="err-bar" style={{ marginBottom:12 }}>{err}</div>}

      {/* Subject */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Subject line</div>
        <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Quick question about {{business}}"
          style={{ width:'100%', maxWidth: rawMode?600:520 }} />
      </div>

      {rawMode ? (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, flexWrap:'wrap', gap:6 }}>
            <div style={{ fontSize:11, color:'var(--muted)' }}>Email body (plain text)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {MERGE_TAGS.map(tag => (
                <button key={tag} type="button" className="chip" style={{ cursor:'pointer', fontSize:10 }}
                  onClick={() => setRawBody(b => b + tag)}>{tag}</button>
              ))}
            </div>
          </div>
          <textarea value={rawBody} onChange={e=>setRawBody(e.target.value)}
            placeholder={"Hi {{name}},\n\nI came across your business and wanted to reach out…"}
            style={{ width:'100%', minHeight:300, fontFamily:'inherit', fontSize:13, lineHeight:1.6, resize:'vertical' }} />
        </div>
      ) : (
        <div className="builder-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,540px)', gap:18, alignItems:'start' }}>

          {/* ── Left: compose ── */}
          <div>
            {/* ADD BLOCK toolbar */}
            <div style={{ marginBottom:12, padding:'8px 12px', background:'var(--glass)', border:'1px solid var(--border)', borderRadius:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)', letterSpacing:'.08em' }}>ADD BLOCK</span>
                <div style={{ display:'flex', gap:4 }}>
                  {[['above','↑ Above'],['inside','■ Card'],['below','↓ Below']].map(([z,lbl]) => (
                    <button key={z} type="button" onClick={() => setAddZone(z)} style={{
                      padding:'3px 8px', fontSize:9, fontWeight:700, borderRadius:4, cursor:'pointer',
                      border:'1px solid', borderColor: addZone===z ? 'rgba(163,175,86,.6)' : 'var(--border)',
                      background: addZone===z ? 'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)' : 'var(--glass)',
                      color: addZone===z ? '#fff8f0' : 'var(--muted)',
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {[
                { type:'text',    icon:'T',  label:'Text'    },
                { type:'image',   icon:'img', label:'Image'   },
                { type:'button',  icon:'btn', label:'Button'  },
                { type:'divider', icon:'—',  label:'Divider' },
                { type:'spacer',  icon:'+',  label:'Spacer'  },
              ].map(bt => (
                <button key={bt.type} type="button" onClick={() => addBlock(bt.type)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:6, background:'var(--glass)', border:'1px solid var(--border)', cursor:'pointer', fontSize:12, color:'var(--text)', transition:'border-color .12s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--teal)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  {bt.icon === 'btn'
                    ? <span style={{ background:'linear-gradient(180deg,#bdcc7e,#a0a956 52%,#7c823f)', color:'#1f210f', borderRadius:3, padding:'1px 6px', fontSize:9, fontWeight:800, letterSpacing:'.04em', lineHeight:'14px', textShadow:'0 1px 0 rgba(222,234,191,.45)', boxShadow:'inset 0 1px 0 rgba(255,231,200,.65),inset 0 -1px 1px rgba(0,0,0,.3),0 0 8px rgba(175,185,102,.4)' }}>BUTTON</span>
                    : bt.icon === 'img'
                      ? <svg width="15" height="13" viewBox="0 0 15 13" fill="none" style={{display:'block',flexShrink:0}}><rect x="0.75" y="0.75" width="13.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="5" cy="4.5" r="1.5" fill="currentColor"/><path d="M1 11 5 7 8 10 10.5 7.5 14 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <><span style={{ fontWeight:700, fontSize:11, color:'var(--teal)' }}>{bt.icon}</span>{' '}{bt.label}</>
                  }
                </button>
              ))}
              </div>
            </div>

            {/* Block list */}
            <div style={{ marginBottom:14 }}>
              {blocks.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--muted)', fontSize:13, padding:'20px 0', border:'1px dashed var(--border)', borderRadius:8 }}>
                  Click blocks above to add content
                </div>
              )}
              {(() => {
                const useCard = style.cardEnabled !== false;
                const aboveBlocks  = blocks.map((b,i)=>({b,i})).filter(({b})=>b.zone==='above');
                const insideBlocks = blocks.map((b,i)=>({b,i})).filter(({b})=>!b.zone||b.zone==='inside');
                const belowBlocks  = blocks.map((b,i)=>({b,i})).filter(({b})=>b.zone==='below');
                const renderRow = (block, idx) => (
                  <div key={block.id}
                    style={{ borderRadius: editingIdx===idx ? '8px 8px 0 0' : 8, marginBottom: editingIdx===idx ? 0 : 4,
                      border:'1px solid '+(editingIdx===idx ? 'var(--teal)' : dropIdx===idx ? 'rgba(163,175,86,.5)' : 'var(--border)'),
                      background: editingIdx===idx ? 'rgba(163,175,86,.04)' : 'var(--glass)',
                      transition:'border-color .1s', overflow:'hidden' }}
                    onDragOver={e => { e.preventDefault(); setDropIdx(idx); }}
                    onDrop={() => handleDrop(idx)}
                    onDragLeave={() => setDropIdx(null)}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer' }}
                      onClick={() => setEditingIdx(editingIdx===idx ? null : idx)}>
                      <span draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed='move'; setDragIdx(idx); }}
                        onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
                        onClick={e=>e.stopPropagation()}
                        style={{ cursor:'grab', color:'var(--muted)', fontSize:15, padding:'0 2px', userSelect:'none' }}>⠿</span>
                      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.07em', color: typeColors[block.type]||'var(--muted)', minWidth:50 }}>
                        {block.type.toUpperCase()}
                      </span>
                      <span style={{ flex:1, fontSize:12, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {block.type==='divider' ? '────────' : block.type==='spacer' ? `${block.height||24}px` : block.type==='image' ? (block.src?'Image':'No image set') : block.type==='button' ? `${block.content||'Button'} → ${block.url||''}` : (block.content||'').slice(0,55)}
                      </span>
                      <button type="button" onClick={e=>{e.stopPropagation();moveBlock(idx,idx-1);}} disabled={idx===0}
                        style={{ background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:13,padding:'0 3px',opacity:idx===0?0.25:1 }}>↑</button>
                      <button type="button" onClick={e=>{e.stopPropagation();moveBlock(idx,idx+1);}} disabled={idx===blocks.length-1}
                        style={{ background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:13,padding:'0 3px',opacity:idx===blocks.length-1?0.25:1 }}>↓</button>
                      <button type="button" onClick={e=>{e.stopPropagation();deleteBlock(idx);}}
                        style={{ background:'none',border:'none',cursor:'pointer',color:'#f87171',fontSize:16,padding:'0 3px' }}>×</button>
                    </div>
                    {editingIdx === idx && <BlockEditor block={block} onChange={updateBlock} />}
                  </div>
                );
                if (!useCard) return blocks.map((b,i) => renderRow(b,i));
                const folderOpen = cardFolderOpen && insideBlocks.length > 0;
                return (
                  <>
                    {aboveBlocks.map(({b,i}) => renderRow(b,i))}
                    <div style={{ marginBottom:4 }}>
                      <div onClick={() => setCardFolderOpen(o=>!o)} style={{
                        display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
                        borderRadius: folderOpen ? '7px 7px 0 0' : 7,
                        border:'1px solid var(--border)', background:'var(--glass)', cursor:'pointer',
                      }}>
                        <span style={{ fontSize:9, color:'var(--muted)', display:'inline-block', transition:'transform .15s', transform: cardFolderOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.12em', color:'var(--muted)' }}>CARD</span>
                        {insideBlocks.length > 0 && <span style={{ fontSize:10, color:'var(--muted)', opacity:.4, marginLeft:2 }}>{insideBlocks.length}</span>}
                        <div style={{ flex:1 }} />
                        {insideBlocks.length === 0 && <span style={{ fontSize:10, color:'var(--muted)', opacity:.3 }}>empty</span>}
                      </div>
                      {folderOpen && (
                        <div style={{ borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', borderRadius:'0 0 7px 7px', padding:'4px 4px 0' }}>
                          {insideBlocks.map(({b,i}) => renderRow(b,i))}
                        </div>
                      )}
                    </div>
                    {belowBlocks.length > 0 && <div style={{ height:1, background:'var(--border)', opacity:.3, margin:'2px 0 4px' }} />}
                    {belowBlocks.map(({b,i}) => renderRow(b,i))}
                  </>
                );
              })()}
            </div>

            {/* EMAIL STYLING */}
            <div style={{ background:'var(--glass)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:12 }}>Email Styling</div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:5 }}>Font</div>
                <select value={style.font} onChange={e=>setStyle(s=>({...s,font:e.target.value}))} style={{ width:'100%' }}>
                  {BUILDER_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <ColorInput label="Text color"    value={style.textColor}   onChange={v=>setStyle(s=>({...s,textColor:v}))} />
                <ColorInput label="Background"    value={style.bgColor}     onChange={v=>setStyle(s=>({...s,bgColor:v}))} />
                <ColorInput label="Accent / link" value={style.accentColor} onChange={v=>setStyle(s=>({...s,accentColor:v}))} />
              </div>
              {/* Card controls */}
              <div style={{ paddingTop:10, marginBottom:12, borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Card</span>
                  <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                    <input type="checkbox" checked={style.cardEnabled!==false} onChange={e=>setStyle(s=>({...s,cardEnabled:e.target.checked}))} style={{ accentColor:'var(--teal)', width:14, height:14 }} />
                    <span style={{ fontSize:11, color:'var(--muted)' }}>{style.cardEnabled!==false?'On':'Off'}</span>
                  </label>
                </div>
                {style.cardEnabled!==false && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <ColorInput label="Card color" value={style.cardColor} onChange={v=>setStyle(s=>({...s,cardColor:v}))} />
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'var(--muted)' }}>Padding</span>
                        <span style={{ fontSize:11, color:'var(--cream-100)', fontVariantNumeric:'tabular-nums' }}>{style.cardPadding??32}px</span>
                      </div>
                      <input type="range" min={0} max={80} step={4} value={style.cardPadding??32}
                        style={{ '--fill':`${((style.cardPadding??32)/80)*100}%` }}
                        onChange={e=>setStyle(s=>({...s,cardPadding:Number(e.target.value)}))} />
                    </div>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'var(--muted)' }}>Radius</span>
                        <span style={{ fontSize:11, color:'var(--cream-100)', fontVariantNumeric:'tabular-nums' }}>{style.cardRadius??12}px</span>
                      </div>
                      <input type="range" min={0} max={32} step={2} value={style.cardRadius??12}
                        style={{ '--fill':`${((style.cardRadius??12)/32)*100}%` }}
                        onChange={e=>setStyle(s=>({...s,cardRadius:Number(e.target.value)}))} />
                    </div>
                  </div>
                )}
                <div style={{ marginTop:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>Space above card</span>
                    <span style={{ fontSize:11, color:'var(--cream-100)', fontVariantNumeric:'tabular-nums' }}>{style.cardMarginTop??0}px</span>
                  </div>
                  <input type="range" min={0} max={120} step={4} value={style.cardMarginTop??0}
                    style={{ '--fill':`${((style.cardMarginTop??0)/120)*100}%` }}
                    onChange={e=>setStyle(s=>({...s,cardMarginTop:Number(e.target.value)}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:20 }}>
                <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={logo.enabled} onChange={e=>setLogo(l=>({...l,enabled:e.target.checked}))} style={{ accentColor:'var(--teal)', width:14, height:14 }} />
                  Show logo
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={footer.enabled} onChange={e=>setFooter(f=>({...f,enabled:e.target.checked}))} style={{ accentColor:'var(--teal)', width:14, height:14 }} />
                  Show footer
                </label>
              </div>
            </div>

            {/* Logo panel */}
            {logo.enabled && (
              <div style={{ background:'var(--glass)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:10 }}>Logo</div>
                {logo.src && <img src={logo.src} alt="Logo" style={{ maxHeight:48, maxWidth:160, marginBottom:10, display:'block', borderRadius:4 }} />}
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <input value={logo.src||''} onChange={e=>setLogo(l=>({...l,src:e.target.value}))} placeholder="https://..." style={{ flex:1 }} />
                  <label style={{ display:'flex', alignItems:'center', padding:'6px 12px', background:'var(--glass)', border:'1px solid var(--border)', borderRadius:6, fontSize:11, cursor:'pointer', color:'var(--muted)', whiteSpace:'nowrap' }}>
                    ↑ Upload
                    <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                      const f=e.target.files[0]; if(!f) return;
                      const r=new FileReader(); r.onload=ev=>setLogo(l=>({...l,src:ev.target.result})); r.readAsDataURL(f);
                    }} />
                  </label>
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Alt text</div>
                <input value={logo.alt||''} onChange={e=>setLogo(l=>({...l,alt:e.target.value}))} style={{ width:'100%' }} />
              </div>
            )}

            {/* Footer panel */}
            {footer.enabled && (
              <div style={{ background:'var(--glass)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:10 }}>Footer</div>
                <textarea value={footer.content||''} onChange={e=>setFooter(f=>({...f,content:e.target.value}))}
                  placeholder={"© 2025 Your Company\n123 Street, City"}
                  style={{ width:'100%', minHeight:72, fontFamily:'inherit', fontSize:12, lineHeight:1.6, resize:'vertical' }} />
              </div>
            )}

            {/* Merge tags */}
            <div style={{ marginTop:6 }}>
              <div style={{ fontSize:10, color:'var(--muted)', marginBottom:5 }}>Merge tags — click to copy</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {MERGE_TAGS.map(tag => (
                  <button key={tag} type="button" className="chip" style={{ cursor:'pointer', fontSize:10 }}
                    onClick={() => navigator.clipboard?.writeText(tag)}>{tag}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: preview ── */}
          <div style={{ position:'sticky', top:16 }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'radial-gradient(circle at 38% 30%,#e4edca,#afb966 46%,#8a9143)', boxShadow:'0 0 6px 1px rgba(175,185,102,.75),inset 0 1px 1px rgba(255,236,214,.5)', display:'inline-block' }} />
              Preview — <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>click to select · type to edit</span>
            </div>
            {/* Reading pane — dark themed */}
            <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'0 4px 24px rgba(0,0,0,.5)' }}>
              {/* Header */}
              <div style={{ background:'var(--surf)', borderBottom:'1px solid var(--border)' }}>
                <div style={{ padding:'12px 16px 0', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'inherit', fontSize:16, fontWeight:600, color:'var(--text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-.01em' }}>
                    Email Preview
                  </span>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', color:'var(--muted)', flexShrink:0, textTransform:'uppercase' }}>Inbox</span>
                </div>
                <div style={{ padding:'8px 16px 11px', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)', boxShadow:'0 0 7px rgba(163,175,86,.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color:'#fff8f0', fontSize:13, fontWeight:700, textShadow:'0 1px 2px rgba(54,60,20,.5)' }}>Y</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:'var(--text)', fontWeight:600 }}>
                      You <span style={{ fontWeight:400, color:'var(--muted)', fontSize:11 }}>&lt;you@example.com&gt;</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>to recipient</div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="var(--muted)"/><circle cx="12" cy="12" r="1.6" fill="var(--muted)"/><circle cx="19" cy="12" r="1.6" fill="var(--muted)"/></svg>
                </div>
              </div>
              <div style={{ maxHeight:'calc(100vh - 320px)', minHeight:380, overflowY:'auto', background:'#f6f8fc' }}
                onClick={() => setEditingIdx(null)}>
                <LiveEmailPreview
                  blocks={blocks} style={style} logo={logo} footer={footer}
                  editId={editingId}
                  onSelectBlock={id => { const i=blocks.findIndex(b=>b.id===id); setEditingIdx(i); }}
                  onUpdateBlock={upd => updateBlock(upd)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OutreachTemplates ─────────────────────────────────────────────
function OutreachTemplates({ templates, setTemplates }) {
  const [editing, setEditing] = useState(null);

  async function del(id) {
    if (!confirm('Delete this template?')) return;
    await api('/outreach/templates/'+id, { method:'DELETE' });
    setTemplates(ts => ts.filter(t => t.id !== id));
  }

  if (editing !== null) return (
    <TemplateEditor
      initial={editing.id ? editing : null}
      onSave={saved => {
        if (editing.id) setTemplates(ts => ts.map(t => t.id===saved.id ? saved : t));
        else setTemplates(ts => [saved, ...ts]);
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color:'var(--muted)', fontSize:13 }}>{templates.length} template{templates.length!==1?'s':''}</span>
        <button className="btn-teal" style={{ padding:'7px 18px' }} onClick={() => setEditing({})}>+ New template</button>
      </div>
      {!templates.length
        ? <div className="empty"><p>No templates yet — create your first one.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {templates.map(t => (
              <div key={t.id} className="glass" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, marginBottom:3, display:'flex', alignItems:'center', gap:8 }}>
                    {t.name}
                    {t.builder_json
                      ? <span style={{ fontSize:10, background:'rgba(163,175,86,.12)', color:'var(--teal)', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>BUILDER</span>
                      : <span style={{ fontSize:10, background:'var(--glass)', color:'var(--muted)', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>RAW</span>
                    }
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{t.subject}</div>
                </div>
                <button className="btn btn-sm" onClick={() => setEditing(t)}>Edit</button>
                <button className="btn btn-sm" style={{ color:'#f87171' }} onClick={() => del(t.id)}>Delete</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── OutreachSend ──────────────────────────────────────────────────
function OutreachSend({ smtp, templates, setTemplates }) {
  // ── Builder state — initialized from localStorage draft, else default template ──
  const _init = React.useMemo(loadOutreachDraft, []);
  const [blocks, setBlocks]   = useState(() => (_init.blocks || DFLT_OUTREACH.blocks).map(b => ({ ...b })));
  const [editId, setEditId]   = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [cardFolderOpen, setCardFolderOpen] = useState(true);
  const [addZone, setAddZone] = useState('inside');
  const [rawMode, setRawMode] = useState(_init.rawMode ?? false);
  const [rawBody, setRawBody] = useState(_init.rawBody || '');
  const [subject, setSubject] = useState(_init.subject || '');
  const [style, setStyle]     = useState(Object.assign({}, DFLT_STYLE, _init.style || {}));
  const [logo, setLogo]       = useState(_init.logo   || { enabled: false, src: '', alt: 'Logo' });
  const [footer, setFooter]   = useState(_init.footer || { enabled: false, content: '© 2025 Your Company. All rights reserved.' });

  // Auto-save draft to localStorage (debounced 600 ms)
  const _draftTimer = useRef(null);
  useEffect(() => {
    clearTimeout(_draftTimer.current);
    _draftTimer.current = setTimeout(() => {
      localStorage.setItem('rl_outreach_draft', JSON.stringify({ subject, rawMode, rawBody, blocks, style, logo, footer }));
    }, 600);
    return () => clearTimeout(_draftTimer.current);
  }, [subject, rawMode, rawBody, blocks, style, logo, footer]);

  // Load a saved template into the builder
  function loadTemplate(tmpl) {
    if (!tmpl) return;
    try {
      const data = tmpl.builder_json ? JSON.parse(tmpl.builder_json) : null;
      if (data && !data.rawMode) {
        setSubject(data.subject || tmpl.subject || '');
        setRawMode(false);
        setBlocks((data.blocks || []).map(b => ({ ...b })));
        setStyle(Object.assign({}, DFLT_STYLE, data.style || {}));
        setLogo(data.logo   || { enabled: false, src: '', alt: 'Logo' });
        setFooter(data.footer || { enabled: false, content: '© 2025 Your Company. All rights reserved.' });
      } else {
        setSubject(tmpl.subject || '');
        setRawMode(true);
        setRawBody(tmpl.body || '');
      }
      setEditId(null);
    } catch {}
  }

  function updBlock(id, patch) { setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b)); }
  function delBlock(id)        { setBlocks(bs => bs.filter(b => b.id !== id)); if (editId === id) setEditId(null); }
  function addBlock(type) {
    const b = mkBlock(type, addZone);
    setBlocks(bs => {
      if (addZone === 'above') {
        let pos = 0; bs.forEach((x,i) => { if (x.zone==='above') pos=i+1; });
        return [...bs.slice(0,pos), b, ...bs.slice(pos)];
      } else if (addZone === 'below') {
        return [...bs, b];
      } else {
        const fp = bs.findIndex(x => x.zone==='below');
        return fp===-1 ? [...bs, b] : [...bs.slice(0,fp), b, ...bs.slice(fp)];
      }
    });
    setEditId(b.id);
  }

  function onDragStart(e, i)  { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e, i)   { e.preventDefault(); if (dragIdx === null || dragIdx === i) return; const bs = [...blocks]; const [r] = bs.splice(dragIdx, 1); bs.splice(i, 0, r); setBlocks(bs); setDragIdx(i); }
  function onDragEnd()        { setDragIdx(null); }

  // ── Leads state ───────────────────────────────────────────────────
  const [leads, setLeads]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch]         = useState('');
  const [source, setSource]         = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Which lists exist (architects/designers plus anything imported on the
  // Leads page) — not part of the rawleads extraction, which hard-coded
  // google_maps/instagram/google_search instead of real, user-named lists.
  const [lists, setLists]           = useState([]);
  const timer = useRef(null);

  function fetchLeads(s, src) {
    setLoadingLeads(true);
    api('/leads?page=1&sort=newest&has_email=1&source=' + src + (s ? '&search=' + encodeURIComponent(s) : ''))
      .then(d => { setLeads(d.leads || []); setTotal(d.total || 0); })
      .catch(() => {}).finally(() => setLoadingLeads(false));
  }
  useEffect(() => {
    fetchLeads('', 'all');
    api('/leads/lists').then(d => setLists(d.lists || [])).catch(() => {});
  }, []);
  const listLabel = id => (lists.find(l => l.id === id) || {}).label || id;

  function onSearch(v) {
    setSearch(v); clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchLeads(v, source), 350);
  }
  function toggleLead(id) { setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll()    { setSelectedIds(s => s.size === leads.length ? new Set() : new Set(leads.map(l => l.id))); }

  // ── Send state ────────────────────────────────────────────────────
  const [sending, setSending]         = useState(false);
  const [result, setResult]           = useState(null);
  const [err, setErr]                 = useState('');
  const [showSave, setShowSave]       = useState(false);
  const [tmplName, setTmplName]       = useState('');
  const [savingTmpl, setSavingTmpl]   = useState(false);
  const [showTest, setShowTest]       = useState(false);
  const [testEmail, setTestEmail]     = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testOk, setTestOk]           = useState(false);

  async function send() {
    if (!smtp?.configured)  { setErr('Configure SMTP settings first (Outreach → Settings)'); return; }
    if (!selectedIds.size)  { setErr('Select at least one lead'); return; }
    if (!subject.trim())    { setErr('Add a subject line'); return; }
    setErr(''); setSending(true); setResult(null);
    try {
      const builder_json = rawMode ? null : JSON.stringify({ rawMode: false, subject, blocks, style, logo, footer });
      const tmpl = await api('/outreach/templates', { method: 'POST', body: { name: '__tmp__' + Date.now(), subject, body: rawMode ? rawBody : '', builder_json } });
      const r    = await api('/outreach/send',      { method: 'POST', body: { lead_ids: [...selectedIds], template_id: tmpl.id } });
      await api('/outreach/templates/' + tmpl.id, { method: 'DELETE' }).catch(() => {});
      setResult(r); setSelectedIds(new Set());
    } catch (e) { setErr(e.message); } finally { setSending(false); }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    if (!tmplName.trim()) return;
    setSavingTmpl(true);
    try {
      const builder_json = rawMode ? null : JSON.stringify({ rawMode: false, subject, blocks, style, logo, footer });
      const saved = await api('/outreach/templates', { method: 'POST', body: { name: tmplName.trim(), subject, body: rawMode ? rawBody : '', builder_json } });
      setTemplates(ts => [...ts, saved]);
      setTmplName(''); setShowSave(false);
    } catch (e) { setErr(e.message); } finally { setSavingTmpl(false); }
  }

  async function sendTest(e) {
    e.preventDefault();
    if (!smtp?.configured) { setErr('Configure SMTP settings first (Outreach → Settings)'); return; }
    if (!testEmail.trim()) return;
    setSendingTest(true); setTestOk(false); setErr('');
    try {
      const builder_json = rawMode ? null : JSON.stringify({ rawMode:false, subject, blocks, style, logo, footer });
      await api('/outreach/send-test', { method:'POST', body:{ to_email:testEmail.trim(), subject, rawMode, rawBody:rawMode?rawBody:'', builder_json } });
      setTestOk(true);
      setTimeout(() => setTestOk(false), 4000);
    } catch(e) { setErr(e.message); } finally { setSendingTest(false); }
  }

  const blockLabels = { text: 'Text', button: 'Button', image: 'Image', divider: 'Divider', spacer: 'Spacer' };

  return (
    <div>
      {/* ── Template selector + Save ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--muted)', flexShrink: 0 }}>TEMPLATE</span>
        {templates.length > 0 && (
          <>
            <select className="inp" style={{ marginBottom: 0, maxWidth: 240, fontSize: 13 }}
              defaultValue=""
              onChange={e => { const t = templates.find(x => x.id === e.target.value); loadTemplate(t); e.target.value = ''; }}>
              <option value="" disabled>Load a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn btn-sm" style={{ fontSize: 11, opacity: .65 }}
              onClick={() => { setBlocks(DFLT_OUTREACH.blocks.map(b=>({...b}))); setSubject(DFLT_OUTREACH.subject); setStyle(Object.assign({},DFLT_STYLE,DFLT_OUTREACH.style)); setLogo(DFLT_OUTREACH.logo); setFooter(DFLT_OUTREACH.footer); setRawMode(false); setEditId(null); localStorage.removeItem('rl_outreach_draft'); }}>
              Reset
            </button>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {!showSave ? (
            <button className="btn btn-sm" onClick={() => setShowSave(true)}>Save as Template</button>
          ) : (
            <form onSubmit={saveTemplate} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="inp" style={{ marginBottom: 0, fontSize: 13, maxWidth: 200 }}
                placeholder="Template name…" value={tmplName} onChange={e => setTmplName(e.target.value)} autoFocus />
              <button type="submit" className="btn btn-sm btn-teal" disabled={savingTmpl}>{savingTmpl ? '…' : 'Save'}</button>
              <button type="button" className="btn btn-sm" onClick={() => setShowSave(false)}>✕</button>
            </form>
          )}
        </div>
      </div>

      {/* ── Subject + mode toggle ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="inp" placeholder="Subject line…" value={subject} onChange={e => setSubject(e.target.value)}
          style={{ flex: 1, minWidth: 240, marginBottom: 0, fontSize: 14 }} />
        <div style={{ display: 'flex', background: 'var(--glass)', borderRadius: 8, padding: 3, gap: 3, flexShrink: 0 }}>
          {[['builder', 'Builder'], ['raw', 'Plain Text']].map(([k, l]) => (
            <button key={k} onClick={() => setRawMode(k === 'raw')} style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all .15s',
              background: (k === 'raw') === rawMode ? 'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)' : 'transparent',
              textShadow: (k === 'raw') === rawMode ? '0 1px 1px rgba(56,58,24,.5)' : 'none',
              boxShadow:  (k === 'raw') === rawMode ? 'inset 0 1px 0 rgba(230,239,208,.5),inset 0 -1px 2px rgba(0,0,0,.35),0 0 9px rgba(175,185,102,.4)' : 'none',
              color:      (k === 'raw') === rawMode ? '#fff8f0'     : 'var(--muted)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Two-panel builder ── */}
      <div className="builder-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>

        {/* Left: controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {!rawMode && (
            <div className="glass" style={{ padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>ADD BLOCK</div>
              {/* Zone selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {[['above','↑ Above'],['inside','■ Card'],['below','↓ Below']].map(([z, lbl]) => (
                  <button key={z} type="button" onClick={() => setAddZone(z)} style={{
                    flex:1, padding:'4px 0', fontSize:10, fontWeight:700, borderRadius:5, cursor:'pointer',
                    border:'1px solid', borderColor: addZone===z ? 'rgba(163,175,86,.6)' : 'var(--border)',
                    background: addZone===z ? 'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)' : 'var(--glass)',
                    color: addZone===z ? '#fff8f0' : 'var(--muted)',
                    textShadow: addZone===z ? '0 1px 1px rgba(56,58,24,.5)' : 'none',
                    boxShadow: addZone===z ? 'inset 0 1px 0 rgba(230,239,208,.5),inset 0 -1px 2px rgba(0,0,0,.35)' : 'none',
                  }}>{lbl}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {Object.entries(blockLabels).map(([type, label]) => (
                  <button key={type} className="btn btn-sm" onClick={() => addBlock(type)}
                    style={{ fontSize: 11, fontWeight: 700, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                    {type === 'image'
                      ? <svg width="15" height="13" viewBox="0 0 15 13" fill="none" style={{display:'block',flexShrink:0}}><rect x="0.75" y="0.75" width="13.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="5" cy="4.5" r="1.5" fill="currentColor"/><path d="M1 11 5 7 8 10 10.5 7.5 14 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : type === 'button'
                        ? <span style={{ background:'linear-gradient(180deg,#bdcc7e,#a0a956 52%,#7c823f)', color:'#1f210f', borderRadius:3, padding:'1px 6px', fontSize:9, fontWeight:800, letterSpacing:'.04em', lineHeight:'14px', textShadow:'0 1px 0 rgba(222,234,191,.45)', boxShadow:'inset 0 1px 0 rgba(255,231,200,.65),inset 0 -1px 1px rgba(0,0,0,.3),0 0 8px rgba(175,185,102,.4)' }}>BUTTON</span>
                        : label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rawMode ? (
            <div className="glass" style={{ padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>EMAIL BODY</div>
              <textarea className="inp" value={rawBody} onChange={e => setRawBody(e.target.value)}
                placeholder="Write your email…" rows={10}
                style={{ marginBottom: 8, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 6 }}>MERGE TAGS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {MERGE_TAGS.map(tag => (
                  <span key={tag} onClick={() => setRawBody(b => b + tag)} style={{
                    fontSize: 10, cursor: 'pointer', padding: '2px 7px', borderRadius: 4,
                    background: 'var(--teal-glow)', color: 'var(--teal)', border: '1px solid var(--border-teal)', textShadow: '0 0 6px rgba(175,185,102,.4)', boxShadow: 'inset 0 1px 0 rgba(255,228,196,.18),inset 0 -1px 1px rgba(0,0,0,.25)',
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Block list */}
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>BLOCKS</div>
                {blocks.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>Add a block above</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(() => {
                    const useCard = style.cardEnabled !== false;
                    const aboveBlocks  = blocks.map((b,i)=>({b,i})).filter(({b})=>b.zone==='above');
                    const insideBlocks = blocks.map((b,i)=>({b,i})).filter(({b})=>!b.zone||b.zone==='inside');
                    const belowBlocks  = blocks.map((b,i)=>({b,i})).filter(({b})=>b.zone==='below');
                    const renderRow = (b, i) => (
                      <div key={b.id} draggable
                        onDragStart={e => onDragStart(e, i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                        onClick={() => setEditId(id => id === b.id ? null : b.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
                          cursor: 'pointer', border: '1px solid', transition: 'all .1s',
                          borderColor: editId === b.id ? 'var(--teal)' : 'var(--border)',
                          background: editId === b.id ? 'rgba(163,175,86,.06)' : 'transparent',
                        }}>
                        <span style={{ color: 'var(--muted)', fontSize: 13, cursor: 'grab' }}>⠿</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{b.type}</span>
                        <button onClick={e => { e.stopPropagation(); delBlock(b.id); }}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    );
                    if (!useCard) return blocks.map((b, i) => renderRow(b, i));
                    const folderOpen = cardFolderOpen && insideBlocks.length > 0;
                    return (
                      <>
                        {aboveBlocks.map(({b,i}) => renderRow(b,i))}
                        <div>
                          <div onClick={() => setCardFolderOpen(o=>!o)} style={{
                            display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
                            borderRadius: folderOpen ? '7px 7px 0 0' : 7,
                            border:'1px solid var(--border)', background:'var(--glass)', cursor:'pointer',
                          }}>
                            <span style={{ fontSize:9, color:'var(--muted)', display:'inline-block', transition:'transform .15s', transform: cardFolderOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                            <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.12em', color:'var(--muted)' }}>CARD</span>
                            {insideBlocks.length > 0 && <span style={{ fontSize:10, color:'var(--muted)', opacity:.4, marginLeft:2 }}>{insideBlocks.length}</span>}
                            <div style={{ flex:1 }} />
                            {insideBlocks.length === 0 && <span style={{ fontSize:10, color:'var(--muted)', opacity:.3 }}>empty</span>}
                          </div>
                          {folderOpen && (
                            <div style={{ borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', borderRadius:'0 0 7px 7px', padding:'4px 4px 0', display:'flex', flexDirection:'column', gap:4 }}>
                              {insideBlocks.map(({b,i}) => renderRow(b,i))}
                            </div>
                          )}
                        </div>
                        {belowBlocks.length > 0 && <div style={{ height:1, background:'var(--border)', opacity:.3, margin:'0 0 2px' }} />}
                        {belowBlocks.map(({b,i}) => renderRow(b,i))}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Block editor */}
              {editId && blocks.find(b => b.id === editId) && (
                <div className="glass" style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 10 }}>EDIT BLOCK</div>
                  <BlockEditor block={blocks.find(b => b.id === editId)} onChange={p => updBlock(editId, p)} />
                </div>
              )}

              {/* Email styling */}
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 10 }}>EMAIL STYLING</div>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Font</label>
                <select className="inp" style={{ marginBottom: 10, fontSize: 12 }} value={style.font} onChange={e => setStyle(s => ({ ...s, font: e.target.value }))}>
                  {BUILDER_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <ColorInput label="Background" value={style.bgColor}     onChange={v => setStyle(s => ({ ...s, bgColor: v }))} />
                  <ColorInput label="Text"       value={style.textColor}   onChange={v => setStyle(s => ({ ...s, textColor: v }))} />
                  <ColorInput label="Accent"     value={style.accentColor} onChange={v => setStyle(s => ({ ...s, accentColor: v }))} />
                </div>
                {/* Card controls */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Card</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={style.cardEnabled !== false} onChange={e => setStyle(s => ({ ...s, cardEnabled: e.target.checked }))} style={{ accentColor: 'var(--teal)' }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{style.cardEnabled !== false ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {style.cardEnabled !== false && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <ColorInput label="Card color" value={style.cardColor} onChange={v => setStyle(s => ({ ...s, cardColor: v }))} />
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Padding</span>
                          <span style={{ fontSize: 11, color: 'var(--cream-100)', fontVariantNumeric: 'tabular-nums' }}>{style.cardPadding ?? 32}px</span>
                        </div>
                        <input type="range" min={0} max={80} step={4} value={style.cardPadding ?? 32}
                          style={{ '--fill': `${((style.cardPadding ?? 32) / 80) * 100}%` }}
                          onChange={e => setStyle(s => ({ ...s, cardPadding: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Radius</span>
                          <span style={{ fontSize: 11, color: 'var(--cream-100)', fontVariantNumeric: 'tabular-nums' }}>{style.cardRadius ?? 12}px</span>
                        </div>
                        <input type="range" min={0} max={32} step={2} value={style.cardRadius ?? 12}
                          style={{ '--fill': `${((style.cardRadius ?? 12) / 32) * 100}%` }}
                          onChange={e => setStyle(s => ({ ...s, cardRadius: Number(e.target.value) }))} />
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Space above card</span>
                      <span style={{ fontSize: 11, color: 'var(--cream-100)', fontVariantNumeric: 'tabular-nums' }}>{style.cardMarginTop ?? 0}px</span>
                    </div>
                    <input type="range" min={0} max={120} step={4} value={style.cardMarginTop ?? 0}
                      style={{ '--fill': `${((style.cardMarginTop ?? 0) / 120) * 100}%` }}
                      onChange={e => setStyle(s => ({ ...s, cardMarginTop: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: logo.enabled ? 10 : 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)' }}>LOGO</span>
                  <input type="checkbox" checked={logo.enabled} onChange={e => setLogo(l => ({ ...l, enabled: e.target.checked }))} style={{ accentColor: 'var(--teal)' }} />
                </div>
                {logo.enabled && <>
                  <input className="inp" style={{ marginBottom: 6, fontSize: 12 }} placeholder="Image URL" value={logo.src} onChange={e => setLogo(l => ({ ...l, src: e.target.value }))} />
                  <input className="inp" style={{ marginBottom: 0, fontSize: 12 }} placeholder="Alt text"   value={logo.alt} onChange={e => setLogo(l => ({ ...l, alt: e.target.value }))} />
                </>}
              </div>

              {/* Footer */}
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: footer.enabled ? 10 : 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)' }}>FOOTER</span>
                  <input type="checkbox" checked={footer.enabled} onChange={e => setFooter(f => ({ ...f, enabled: e.target.checked }))} style={{ accentColor: 'var(--teal)' }} />
                </div>
                {footer.enabled && (
                  <textarea className="inp" style={{ marginBottom: 0, fontSize: 12, resize: 'vertical' }} rows={2}
                    value={footer.content} onChange={e => setFooter(f => ({ ...f, content: e.target.value }))} placeholder="Footer text…" />
                )}
              </div>

              {/* Merge tags */}
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>MERGE TAGS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {MERGE_TAGS.map(tag => (
                    <span key={tag} onClick={() => {
                      if (editId) { const b = blocks.find(x => x.id === editId); if (b && b.content !== undefined) updBlock(editId, { content: (b.content || '') + tag }); }
                    }} style={{
                      fontSize: 10, cursor: 'pointer', padding: '2px 7px', borderRadius: 4,
                      background: 'var(--teal-glow)', color: 'var(--teal)', border: '1px solid var(--border-teal)', textShadow: '0 0 6px rgba(175,185,102,.4)', boxShadow: 'inset 0 1px 0 rgba(255,228,196,.18),inset 0 -1px 1px rgba(0,0,0,.25)',
                    }}>{tag}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Select a block, then click a tag to insert</div>
              </div>
            </>
          )}
        </div>

        {/* Right: live preview */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', marginBottom: 8 }}>
            LIVE PREVIEW — <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>click to select · type to edit</span>
          </div>
          {rawMode ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, minHeight: 300 }}>
              {rawBody || <span style={{ color: 'var(--muted)' }}>Your email will appear here…</span>}
            </div>
          ) : (
            /* Gmail-style reading pane — dark themed */
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,.5)' }}>
              {/* Header: subject + sender row */}
              <div style={{ background: 'var(--surf)', borderBottom: '1px solid var(--border)' }}>
                {/* Subject line */}
                <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'inherit', fontSize: 17, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                    {subject || <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(no subject)</span>}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', flexShrink: 0, textTransform: 'uppercase' }}>Inbox</span>
                </div>
                {/* Sender row */}
                <div style={{ padding: '10px 20px 13px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(180deg,#afb966,#98a051 55%,#7e8543)', boxShadow: '0 0 8px rgba(163,175,86,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff8f0', fontSize: 14, fontWeight: 700, textShadow: '0 1px 2px rgba(54,60,20,.5)' }}>
                      {smtp?.from_name ? smtp.from_name.trim()[0].toUpperCase() : 'Y'}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                      {smtp?.from_name || 'Your Name'}
                      <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, marginLeft: 6 }}>
                        &lt;{smtp?.from_email || 'you@example.com'}&gt;
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>to recipient</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>just now</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10 9l-6 3 6 3V9z" fill="currentColor" style={{ color: 'var(--muted)' }}/><rect x="10" y="8" width="10" height="8" rx="1" fill="currentColor" style={{ color: 'var(--muted)' }}/></svg>
                    <svg width="15" height="15" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="var(--muted)"/><circle cx="12" cy="12" r="1.6" fill="var(--muted)"/><circle cx="19" cy="12" r="1.6" fill="var(--muted)"/></svg>
                  </div>
                </div>
              </div>
              {/* Scrollable email body — Gmail reading pane bg */}
              <div style={{ maxHeight: 'calc(100vh - 360px)', minHeight: 420, overflowY: 'auto', background: '#f6f8fc' }}
                onClick={() => setEditId(null)}>
                <LiveEmailPreview
                  blocks={blocks} style={style} logo={logo} footer={footer}
                  editId={editId}
                  onSelectBlock={id => setEditId(id)}
                  onUpdateBlock={upd => updBlock(upd.id, upd)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recipients ── */}
      <div className="glass" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)' }}>RECIPIENTS</div>
          <input className="inp" style={{ marginBottom: 0, maxWidth: 200, fontSize: 13 }}
            placeholder="Search…" value={search} onChange={e => onSearch(e.target.value)} />
          <select className="inp" style={{ marginBottom: 0, maxWidth: 180, fontSize: 13 }}
            value={source} onChange={e => { setSource(e.target.value); setSelectedIds(new Set()); fetchLeads(search, e.target.value); }}>
            <option value="all">All lists</option>
            {lists.map(l => (
              <option key={l.id} value={l.id}>{l.label} ({l.count})</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{total.toLocaleString()} with email</span>
          {selectedIds.size > 0 && (
            <span style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>{selectedIds.size} selected</span>
          )}
        </div>
        <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}><input type="checkbox" checked={leads.length > 0 && selectedIds.size === leads.length} onChange={toggleAll} style={{ accentColor: 'var(--teal)' }} /></th>
                <th>Name / Account</th><th>Email</th><th>List</th><th>Location</th>
              </tr>
            </thead>
            <tbody>
              {loadingLeads
                ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}><span className="spin" /></td></tr>
                : !leads.length
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>No leads with email found.</td></tr>
                  : leads.map(l => {
                      const isIg = l.source === 'instagram';
                      return (
                        <tr key={l.id} onClick={() => toggleLead(l.id)} style={{ cursor: 'pointer', background: selectedIds.has(l.id) ? 'rgba(163,175,86,.08)' : '' }}>
                          <td><input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleLead(l.id)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--teal)' }} /></td>
                          <td className="td-main">
                            <div style={{ fontWeight: 600 }}>{l.business_name || l.ig_handle || '—'}</div>
                            {isIg && l.ig_handle && <div style={{ fontSize: 11, color: 'var(--teal)' }}>@{l.ig_handle}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--teal)' }}>{l.email}</td>
                          <td><span className="tag tag-teal">{listLabel(l.source)}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--muted)' }}>{l.location || '—'}</td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Status + Actions ── */}
      {result && (
        <div style={{ background: 'rgba(163,175,86,.12)', border: '1px solid var(--border-teal)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          ✓ Sent: <strong>{result.sent}</strong> &nbsp;|&nbsp; Failed: <strong style={{ color: result.failed ? '#f87171' : 'inherit' }}>{result.failed}</strong>
        </div>
      )}
      {err && <div className="err-bar" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-teal" disabled={sending || !selectedIds.size} onClick={send} style={{ minWidth: 180 }}>
          {sending ? <span className="spin" /> : `Send to ${selectedIds.size || 0} lead${selectedIds.size !== 1 ? 's' : ''}`}
        </button>
        {!showTest ? (
          <button className="btn btn-sm" onClick={() => { setShowTest(true); setTestEmail(smtp?.from_email || ''); }}>
            Send Test Email
          </button>
        ) : (
          <form onSubmit={sendTest} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="inp" type="email" style={{ marginBottom: 0, fontSize: 13, maxWidth: 220 }}
              placeholder="test@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} autoFocus />
            <button type="submit" className="btn btn-sm btn-teal" disabled={sendingTest}>
              {sendingTest ? <span className="spin" /> : testOk ? '✓ Sent!' : 'Send'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowTest(false)}>✕</button>
          </form>
        )}
      </div>
    </div>
  );
}



// ── OutreachHistory ──────────────────────────────────────────────────────────
function OutreachHistory() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  useEffect(() => {
    api('/outreach/history')
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(() => setErr('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:40 }}><span className="spin" /></div>;

  return (
    <div>
      <h3 style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Send History</h3>
      {err && <div className="err-bar">{err}</div>}
      {rows.length === 0
        ? <div style={{ color:'var(--muted)', fontSize:13, padding:'32px 0', textAlign:'center' }}>No emails sent yet.</div>
        : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Date','To','Subject','Status','Error'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--muted)', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px', color:'var(--muted)', whiteSpace:'nowrap' }}>{r.sent_at ? r.sent_at.slice(0,16).replace('T',' ') : '—'}</td>
                    <td style={{ padding:'8px 12px', color:'var(--text)' }}>{r.to_name ? `${r.to_name} <${r.to_email}>` : r.to_email || '—'}</td>
                    <td style={{ padding:'8px 12px', color:'var(--text)' }}>{r.subject || '—'}</td>
                    <td style={{ padding:'8px 12px' }}>
                      <span style={{
                        display:'inline-block', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700,
                        background: r.status === 'sent' ? 'rgba(163,175,86,.12)' : 'rgba(239,68,68,.15)',
                        color:      r.status === 'sent' ? 'var(--teal)'           : '#ef4444',
                      }}>{r.status}</span>
                    </td>
                    <td style={{ padding:'8px 12px', color:'#ef4444', fontSize:12 }}>{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ── OutreachSettings ─────────────────────────────────────────────────────────
function OutreachSettings({ smtp, setSmtp }) {
  const PROVIDERS = [
    { id:'gmail',    name:'Gmail',                   icon:'G',
      host:'smtp.gmail.com',        port:587, secure:'0',
      userLabel:'Gmail Address', userPH:'you@gmail.com',
      passLabel:'App Password',  passPH:'16-character app password',
      steps:[
        { t:'Open your Google Account security page', link:'https://myaccount.google.com/security', lt:'myaccount.google.com → Security' },
        { t:'Scroll to "How you sign in to Google" and make sure 2-Step Verification is ON (required)' },
        { t:'Click App passwords — you may need to search for it in the search bar', link:'https://myaccount.google.com/apppasswords', lt:'Open App Passwords ↗' },
        { t:'Give it any name (e.g. "RawLeads") and click Create' },
        { t:'Copy the 16-character password shown and paste it in the Password field below' },
      ],
      note:"⚠ Do not use your normal Gmail password — it won't work. Only the App Password will work here.",
    },
    { id:'outlook',  name:'Outlook / Microsoft 365', icon:'O',
      host:'smtp.office365.com',    port:587, secure:'0',
      userLabel:'Microsoft Email', userPH:'you@outlook.com',
      passLabel:'App Password',   passPH:'Your app password',
      steps:[
        { t:'Sign in at', link:'https://account.microsoft.com/security', lt:'account.microsoft.com → Security' },
        { t:'Click "Advanced security options"' },
        { t:'Turn on Two-step verification if not already on' },
        { t:'Scroll to App passwords → Create a new app password' },
        { t:'Copy the password and paste it in the Password field below' },
        { t:'Use your full Microsoft email address as the username' },
      ],
      note:'Works for @outlook.com, @hotmail.com and Microsoft 365 business accounts (e.g. you@yourcompany.com).',
    },
    { id:'resend',   name:'Resend',                  icon:'R',
      host:'smtp.resend.com',       port:465, secure:'1',
      userLabel:'Username (always "resend")', userPH:'resend',
      passLabel:'API Key',          passPH:'re_xxxxxxxxxxxxxxxxxxxx',
      steps:[
        { t:'Sign up for a free account at', link:'https://resend.com', lt:'resend.com ↗' },
        { t:'Go to API Keys in the left sidebar and click Create API Key' },
        { t:'Name it "RawLeads" and set permission to Sending access' },
        { t:'Copy the API key (starts with re_) and paste it as the Password below' },
        { t:'The SMTP username is always the word: resend' },
        { t:'Go to Domains and add + verify your sending domain for best deliverability', link:'https://resend.com/domains', lt:'Add a domain ↗' },
      ],
      note:'✓ Recommended for bulk sending. Free up to 3,000 emails/month, excellent deliverability.',
    },
    { id:'yahoo',    name:'Yahoo Mail',               icon:'Y',
      host:'smtp.mail.yahoo.com',   port:587, secure:'0',
      userLabel:'Yahoo Email', userPH:'you@yahoo.com',
      passLabel:'App Password', passPH:'16-character app password',
      steps:[
        { t:'Go to', link:'https://login.yahoo.com/account/security', lt:'Yahoo Account Security ↗' },
        { t:'Enable Two-step verification if not already on' },
        { t:'Scroll down to "Generate app password"' },
        { t:'Select "Other App", name it "RawLeads" and click Generate' },
        { t:'Copy the password and paste it in the Password field below' },
      ],
      note:'⚠ Yahoo blocks normal passwords for third-party apps — you must use an App Password.',
    },
    { id:'zoho',     name:'Zoho Mail',                icon:'Z',
      host:'smtp.zoho.com',         port:587, secure:'0',
      userLabel:'Zoho Email', userPH:'you@zoho.com',
      passLabel:'App-Specific Password', passPH:'Zoho app password',
      steps:[
        { t:'Sign in at', link:'https://accounts.zoho.com/home', lt:'accounts.zoho.com ↗' },
        { t:'Go to Security → App Passwords' },
        { t:'Click Add, name it "RawLeads", then click Generate' },
        { t:'Copy the password and paste it below' },
        { t:'Use your full Zoho email address as the username' },
      ],
      note:null,
    },
    { id:'icloud',   name:'iCloud Mail',              icon:'i',
      host:'smtp.mail.me.com',      port:587, secure:'0',
      userLabel:'iCloud Email', userPH:'you@icloud.com',
      passLabel:'App-Specific Password', passPH:'xxxx-xxxx-xxxx-xxxx',
      steps:[
        { t:'Go to', link:'https://appleid.apple.com', lt:'appleid.apple.com ↗' },
        { t:'Sign in, then click Sign-In and Security → App-Specific Passwords' },
        { t:'Click the + button and name it "RawLeads"' },
        { t:'Apple shows the password once — copy it immediately' },
        { t:'Paste it in the Password field below' },
      ],
      note:'⚠ Two-factor authentication must be enabled on your Apple ID before App-Specific Passwords appear.',
    },
    { id:'sendgrid', name:'SendGrid',                 icon:'S',
      host:'smtp.sendgrid.net',     port:587, secure:'0',
      userLabel:'Username (always "apikey")', userPH:'apikey',
      passLabel:'API Key', passPH:'SG.xxxxxxxxxxxxxxxxxxxxxxxx',
      steps:[
        { t:'Sign in at', link:'https://app.sendgrid.com', lt:'app.sendgrid.com ↗' },
        { t:'Go to Settings → API Keys → Create API Key' },
        { t:'Choose Restricted Access and enable the Mail Send permission' },
        { t:'Copy the API key (starts with SG.) — it is only shown once' },
        { t:'Paste it as the Password below. The username is always: apikey' },
        { t:'Verify your sender identity under Settings → Sender Authentication', link:'https://app.sendgrid.com/settings/sender_auth', lt:'Open Sender Auth ↗' },
      ],
      note:null,
    },
    { id:'mailgun',  name:'Mailgun',                  icon:'M',
      host:'smtp.mailgun.org',      port:587, secure:'0',
      userLabel:'SMTP Login (postmaster@...)', userPH:'postmaster@mg.yourdomain.com',
      passLabel:'SMTP Password', passPH:'Mailgun SMTP password',
      steps:[
        { t:'Sign in at', link:'https://app.mailgun.com', lt:'app.mailgun.com ↗' },
        { t:'Go to Sending → Domains and click your domain (or add one)' },
        { t:'Click SMTP credentials — you will see the postmaster username' },
        { t:'Click the eye icon or Reset password to get/set your SMTP password' },
        { t:'Copy the password and use the postmaster address as the username below' },
      ],
      note:'⚠ New accounts start in sandbox mode. Add and verify a real domain to send to any recipient.',
    },
  ];

  const [provider, setProvider] = useState('');
  const [form, setForm] = useState({
    smtp_host:       smtp?.smtp_host      || '',
    smtp_port:       smtp?.smtp_port      || 587,
    smtp_secure:     smtp?.smtp_secure    ? '1' : '0',
    smtp_user:       smtp?.smtp_user      || '',
    smtp_pass:       '',
    smtp_from_name:  smtp?.smtp_from_name  || '',
    smtp_from_email: smtp?.smtp_from_email || '',
  });
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const prov = PROVIDERS.find(p => p.id === provider);

  function selectProvider(id) {
    if (id === 'contact') { window.open('https://helixsolution.au/contact', '_blank'); return; }
    setProvider(id);
    const p = PROVIDERS.find(x => x.id === id);
    if (p) setForm(f => ({ ...f, smtp_host: p.host, smtp_port: p.port, smtp_secure: p.secure, smtp_user: p.id === 'resend' ? 'resend' : p.id === 'sendgrid' ? 'apikey' : f.smtp_user }));
  }

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault(); setSaving(true); setMsg(''); setErr('');
    try { const res = await api('/outreach/smtp', { method:'POST', body:form }); setSmtp(res); setMsg('✓ Settings saved successfully!'); }
    catch(ex) { setErr(ex.message || 'Save failed'); }
    setSaving(false);
  }

  async function testConn() {
    setTesting(true); setMsg(''); setErr('');
    try { const res = await api('/outreach/smtp/test', { method:'POST', body:form }); setMsg(res.message || '✓ Connection successful!'); }
    catch(ex) { setErr(ex.message || 'Connection failed — check your credentials and try again'); }
    setTesting(false);
  }

  const inp = { className:'inp', style:{ marginBottom:0 } };

  return (
    <div style={{ maxWidth:600 }}>
      <h3 style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Email Setup</h3>
      <p style={{ fontSize:13, color:'var(--muted)', marginBottom:24, lineHeight:1.5 }}>
        Connect your email account so RawLeads can send outreach on your behalf. Select your provider below for a step-by-step guide.
      </p>

      {/* Provider selector */}
      <div style={{ marginBottom:24 }}>
        <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.06em', display:'block', marginBottom:8 }}>SELECT YOUR EMAIL PROVIDER</label>
        <select className="inp" style={{ marginBottom:0, fontSize:14 }} value={provider} onChange={e=>selectProvider(e.target.value)}>
          <option value="">— Choose your email provider —</option>
          <optgroup label="Popular">
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook / Microsoft 365</option>
            <option value="yahoo">Yahoo Mail</option>
            <option value="icloud">iCloud Mail</option>
          </optgroup>
          <optgroup label="Developer / Bulk Sending">
            <option value="resend">Resend  ✓ Recommended for bulk</option>
            <option value="sendgrid">SendGrid</option>
            <option value="mailgun">Mailgun</option>
          </optgroup>
          <optgroup label="Business">
            <option value="zoho">Zoho Mail</option>
          </optgroup>
          <optgroup label="">
            <option value="contact">My provider isn't listed — contact us →</option>
          </optgroup>
        </select>
      </div>

      {/* Step-by-step guide */}
      {prov && prov.steps && (
        <div style={{ background:'rgba(163,175,86,.06)', border:'1px solid rgba(163,175,86,.2)', borderRadius:12, padding:'18px 20px', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(155deg,#bdcb7e,#a0a956 48%,#7c813e)', border:'1px solid rgba(91,96,46,.6)', boxShadow:'inset 0 1px 0 rgba(255,231,200,.6),inset 0 -2px 3px rgba(0,0,0,.42),0 2px 5px rgba(0,0,0,.45),0 0 13px rgba(175,185,102,.42)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15, color:'#1a0d04', textShadow:'0 1px 0 rgba(222,234,191,.4)', flexShrink:0 }}>{prov.icon}</div>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>How to get your {prov.name} credentials</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {prov.steps.map((step, i) => (
              <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(163,175,86,.15)', color:'var(--teal)', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.55 }}>
                  {step.t}{' '}
                  {step.link && <a href={step.link} target="_blank" rel="noreferrer" style={{ color:'var(--teal)', fontWeight:600, textDecoration:'none' }}>{step.lt}</a>}
                </div>
              </div>
            ))}
          </div>
          {prov.note && (
            <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid rgba(163,175,86,.15)', fontSize:12, color:'var(--muted)', lineHeight:1.55 }}>
              {prov.note}
            </div>
          )}
        </div>
      )}

      {/* Status banners */}
      {msg && <div style={{ background:'rgba(163,175,86,.1)', border:'1px solid var(--accent)', color:'var(--accent)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>{msg}</div>}
      {err && <div className="err-bar" style={{ marginBottom:16 }}>{err}</div>}

      {/* SMTP form */}
      <form onSubmit={save}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 120px', gap:12, marginBottom:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>SMTP HOST</label>
            <input {...inp} placeholder="smtp.gmail.com" value={form.smtp_host} onChange={e=>upd('smtp_host',e.target.value)} required />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>PORT</label>
            <input {...inp} type="number" value={form.smtp_port} onChange={e=>upd('smtp_port',e.target.value)} required />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>ENCRYPTION</label>
            <select {...inp} value={form.smtp_secure} onChange={e=>upd('smtp_secure',e.target.value)}>
              <option value="0">STARTTLS</option>
              <option value="1">SSL / TLS</option>
            </select>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>{prov ? prov.userLabel.toUpperCase() : 'USERNAME / EMAIL'}</label>
          <input {...inp} placeholder={prov?.userPH || 'you@example.com'} value={form.smtp_user} onChange={e=>upd('smtp_user',e.target.value)} required />
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
          <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>{prov ? prov.passLabel.toUpperCase() : 'PASSWORD / APP PASSWORD'}</label>
          <input {...inp} type="password" placeholder={smtp?.configured ? 'Leave blank to keep existing password' : (prov?.passPH || 'Password')} value={form.smtp_pass} onChange={e=>upd('smtp_pass',e.target.value)} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>FROM NAME</label>
            <input {...inp} placeholder="Your Name or Business" value={form.smtp_from_name} onChange={e=>upd('smtp_from_name',e.target.value)} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, letterSpacing:'.05em' }}>FROM EMAIL</label>
            <input {...inp} placeholder="you@example.com" value={form.smtp_from_email} onChange={e=>upd('smtp_from_email',e.target.value)} />
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" className="btn btn-teal" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
          <button type="button" className="btn btn-ghost" onClick={testConn} disabled={testing || !form.smtp_host}>{testing ? 'Testing…' : 'Test Connection'}</button>
        </div>
      </form>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────
// END verbatim OutreachTab.jsx
// ─────────────────────────────────────────────────────────────────────────

ReactDOM.render(<OutreachTab />, document.getElementById('outreach-root'));
