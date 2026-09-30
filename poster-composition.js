// Each composition owns image, crop rail and type together (900 × 1200).
// Randomness changes rhythm within this shared grid, never the alignment system.
window.posterComposition = (() => {
  const designs = [
    { name:'TOP EDITORIAL', zh:'顶部报刊', main:[180,240,540,790], hero:[48,50,804,106], notes:[48,178,690,48], rail:[748,278,104,710], footer:[48,1080,700,66] },
    { name:'BOTTOM LOCK', zh:'底部沉底', main:[180,128,540,790], hero:[48,984,804,110], notes:[48,1114,660,44], rail:[48,160,104,704], footer:[748,160,100,540], verticalFooter:true },
    { name:'SIDE SPINE', zh:'侧边书脊', main:[238,170,490,860], hero:[50,1060,850,106], heroRotation:-90, notes:[240,58,610,62], rail:[752,218,100,770], footer:[240,1080,570,70] },
    { name:'SPLIT AXIS', zh:'双轴对齐', main:[188,246,524,790], hero:[48,48,804,112], notes:[48,180,610,48], rail:[48,286,112,680], footer:[188,1080,640,70] },
    { name:'QUIET CORNER', zh:'角隅留白', main:[236,338,530,700], hero:[48,56,730,100], notes:[48,178,660,50], rail:[48,396,142,560], footer:[236,1080,600,70] },
    { name:'CONTACT SHEET', zh:'底部索引带', main:[192,222,516,630], hero:[48,48,804,104], notes:[48,174,690,48], rail:[48,894,804,150], horizontal:true, footer:[48,1080,720,70] },
    { name:'OFFSET COVER', zh:'侧栏封面', main:[48,252,600,786], hero:[48,50,804,112], notes:[48,184,600,48], rail:[688,296,164,700], footer:[48,1080,760,66] },
    { name:'IMAGE OVERLAP', zh:'图文穿插', main:[178,158,544,826], hero:[48,842,804,112], notes:[48,1028,620,48], rail:[748,214,104,580], footer:[48,1110,720,48] },
  ];
  let previous = '';
  function choose(anchor, random = Math.random) {
    const pool = designs.filter(d => d.name !== previous && (anchor !== 'quiet' || ['QUIET CORNER','OFFSET COVER','CONTACT SHEET'].includes(d.name)) && (anchor !== 'main' || d.name !== 'IMAGE OVERLAP'));
    const design = pool[Math.floor(random() * pool.length)];
    previous = design.name;
    return design;
  }
  function apply(state, design, measure, strength, experimental, palette, random = Math.random) {
    const turn = strength === 'light' ? .6 : experimental && strength === 'wild' ? 3 : 1.5;
    const before = { ...state.main };
    const [x,y,w,h] = design.main;
    Object.assign(state.main, { x,y,w,h, fragmented:false, zoom:Math.min(state.main.zoom || 1,1.18), panX:Math.max(-10,Math.min(10,state.main.panX||0)), panY:Math.max(-10,Math.min(10,state.main.panY||0)), rotation:(random()-.5)*turn });
    // A single offset photo companion sits behind the hero; other fragments are small accents.
    state.fragments.forEach((f,i) => {
      f.x = x + (f.x-before.x)/before.w*w; f.y = y + (f.y-before.y)/before.h*h;
      f.w *= w/before.w; f.h *= h/before.h;
      if (f.fragmentRole !== 'companion') {
        f.w = Math.min(f.w, w*.26); f.h = Math.min(f.h,h*.18);
        f.x = x+w-f.w-12; f.y = y+h-f.h-24-i*12; f.rotation = -turn;
      }
    });
    // Additional photos share the opposite edge. They never become another central hero.
    const secondaryStep = h/Math.max(1,state.secondaries.length);
    state.secondaries.forEach((s,i) => {
      s.h = Math.min(164,secondaryStep*.86); s.w = Math.min(132,s.h*.8);
      s.x = design.rail[0] > 450 ? 32 : 748;
      s.y = y + 8 + i*secondaryStep; s.rotation = i===0 ? -turn : 0;
      if (design.heroRotation) {
        const step = h*.36/Math.max(1,state.secondaries.length);
        s.h = Math.min(s.h,step*.84); s.w = Math.min(s.w,s.h*.8);
        s.x = x+w-s.w-12; s.y = y+h*.6+i*step;
      }
    });
    const [rx,ry,rw,rh] = design.rail;
    const n = state.details.length;
    // Dense user documents get a small contact grid within the same rail; no objects are removed.
    const cols = design.horizontal ? Math.max(1,n) : Math.max(1,Math.ceil(n/4));
    const rows = design.horizontal ? 1 : Math.max(1,Math.ceil(n/cols));
    const gap = Math.min(24,rw/(cols*3),rh/(rows*3));
    const cw = (rw-gap*(cols-1))/cols, ch = (rh-gap*(rows-1))/rows;
    state.details.forEach((d,i) => {
      const ratio = Math.max(.6,Math.min(1.5,d.h/Math.max(1,d.w)));
      d.w = Math.min(cw, ch/ratio,180); d.h = d.w*ratio;
      d.x = rx+(i%cols)*(cw+gap); d.y = ry+Math.floor(i/cols)*(ch+gap);
      d.rotation = i===n-1 && strength!=='light' ? turn : 0;
      d.opacity = 100; d.connectorType = 'elbow'; d.connectorWidth = 1;
      d.lineOpacity = 45; d.endpointStyle = 'dot'; d.color = palette.accent; d.lineColor = palette.accent;
    });
    state.frames.forEach(f => {
      f.lineWidth = Math.min(2,f.lineWidth||1); f.labelSize = 9;
      f.tagStyle = 'plain'; f.frameStyle = 'corner'; f.strokeStyle = 'solid';
      f.strokeOpacity = 72; f.rotation = state.main.rotation;
    });
    const fonts = [
      { hero:'Impact, Haettenschweiler, sans-serif', body:'Arial, Helvetica, sans-serif' },
      { hero:'Arial Black, Arial, sans-serif', body:'Arial, Helvetica, sans-serif' },
      { hero:'Georgia, Times New Roman, serif', body:'Arial, Helvetica, sans-serif' },
      { hero:'Franklin Gothic Medium, Arial Narrow, sans-serif', body:'Georgia, Times New Roman, serif' },
    ];
    const font = fonts[Math.floor(random()*fonts.length)];
    const counters = {};
    function place(t, box, size, rotation=0) {
      Object.assign(t,{x:box[0],y:box[1],size,rotation,align:'left',writingMode:'horizontal',scaleX:1,scaleY:1,lineHeight:1.15});
      // Fit actual font metrics including tracking, repeats and multiline user text.
      let bounds = measure(t);
      const factor = Math.min(1,box[2]/Math.max(1,bounds.w),box[3]/Math.max(1,bounds.h));
      t.size *= factor;
      bounds = measure(t);
      if (bounds.w > box[2]) t.scaleX *= box[2]/bounds.w;
      if (bounds.h > box[3]) t.scaleY *= box[3]/bounds.h;
    }
    state.texts.forEach(t => {
      const index = counters[t.kind] || 0; counters[t.kind] = index+1;
      const count = state.texts.filter(other=>other.kind===t.kind).length;
      t.color = ['subtitle','repeat'].includes(t.kind) ? palette.accent : palette.ink;
      if(strength!=='light' || !t.font) t.font = t.kind==='hero' ? font.hero : ['micro','repeat'].includes(t.kind) ? 'Consolas, Courier New, monospace' : font.body;
      t.opacity = t.kind==='repeat' ? 45 : t.kind==='micro' ? 72 : 100;
      t.letterSpacing = t.kind==='hero' ? -1.5 : t.kind==='micro' ? .8 : .3;
      if (t.kind==='hero') {
        const b = [...design.hero]; b[1] += index*b[3]/count; b[3] /= count;
        t.weight = 800;
        place(t,b,design.name==='QUIET CORNER'?82:108,design.heroRotation||0);
      } else if (t.kind==='subtitle' || t.kind==='caption') {
        const b = t.kind==='subtitle' ? [...design.notes] : [...design.footer];
        b[1] += index*b[3]/count; b[3] /= count;
        t.weight = t.kind==='subtitle'?700:400;
        // Side notes read bottom-to-top on a common baseline, not letter-by-letter.
        if (t.kind==='caption' && design.verticalFooter) place(t,[b[0],700,b[3]*8,24],12,-90);
        else place(t,b,t.kind==='subtitle'?18:12);
      } else if (t.kind==='repeat') {
        Object.assign(t,{repeat:3,direction:'horizontal',repeatSpacing:20,repeatOffsetX:0,repeatOffsetY:0,rotationStep:0});
        place(t,[48,1168+index*8,804,12/count],9);
      } else {
        place(t,[48,26+index*12,804,12],9);
      }
    });
    // Reading order: primary photograph, evidence, then readable type. One photo overlap behind main.
    const layers = (type,items) => items.map(o=>({type,id:o.id}));
    state.layers = [
      ...layers('fragment',state.fragments.filter(f=>f.fragmentRole==='companion')),
      {type:'main',id:state.main.id},
      ...layers('secondary',state.secondaries),
      ...layers('fragment',state.fragments.filter(f=>f.fragmentRole!=='companion')),
      ...layers('connector',state.details), ...layers('frame',state.frames),
      ...layers('detail',state.details), ...layers('text',state.texts),
    ];
  }
  return {choose,apply,designs};
})();
