// Editable Canvas graphics for the pink desktop collage; no flattened poster asset.
(() => {
  const shapes=['checker-heart','heart-arrow','burst','bunny','star','flower','butterfly','book','folder','globe','computer','ribbon','panel','grid','dock','focus','printer','sparkle','doodle','outline-box','sketch-arrow','connector-path','retro-window','profile-card','speech','checker-panel','recycle-bin'];
  const shade=(hex,amount)=>{
    const rgb=/^#([\da-f]{6})$/i.exec(hex)?.[1] || 'e58db7';
    return '#'+[0,2,4].map(i=>{
      const n=parseInt(rgb.slice(i,i+2),16);
      return Math.round(amount>0?n+(255-n)*amount:n*(1+amount)).toString(16).padStart(2,'0');
    }).join('');
  };
  function balloon(ctx,t) {
    ctx.font=`${t.weight} ${t.size}px ${t.font}`;
    ctx.textBaseline='top';ctx.lineJoin='round';
    const spacing=t.letterSpacing || 0,depth=t.balloonDepth ?? 7,shine=(t.balloonShine ?? 75)/100;
    t.content.split('\n').forEach((line,row)=>{
      const chars=[...line],width=chars.reduce((n,ch)=>n+ctx.measureText(ch).width,0)+Math.max(0,chars.length-1)*spacing;
      let x=t.align==='center'?-width/2:t.align==='right'?-width:0;
      chars.forEach((ch,i)=>{
        const cw=ctx.measureText(ch).width;
        ctx.save();ctx.translate(x+cw/2,row*t.size*(t.lineHeight || 1.15)+[5,0,9,2][i%4]);
        ctx.rotate([-5,3,-3,5][i%4]*Math.PI/180);ctx.textAlign='center';
        const gradient=ctx.createLinearGradient(0,0,0,t.size);
        gradient.addColorStop(0,shade(t.color,.38));gradient.addColorStop(.28,shade(t.color,.65*shine));
        gradient.addColorStop(.43,shade(t.color,.7*shine));gradient.addColorStop(.58,t.color);gradient.addColorStop(.76,shade(t.color,-.19));gradient.addColorStop(1,shade(t.color,.2));
        ctx.strokeStyle=shade(t.color,-.23);ctx.lineWidth=t.size*.18;
        ctx.strokeText(ch,depth*.32,depth);
        ctx.strokeStyle=gradient;ctx.lineWidth=t.size*.165;ctx.strokeText(ch,0,0);
        ctx.fillStyle=gradient;ctx.fillText(ch,0,0);
        ctx.save();ctx.globalAlpha*=shine*.3;ctx.strokeStyle='#fff';ctx.lineWidth=1;
        ctx.shadowColor='#fff';ctx.shadowBlur=2;ctx.strokeText(ch,-1,-1);ctx.restore();
        if(ch.trim()){ctx.save();ctx.globalAlpha*=shine*.85;ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=4;ctx.beginPath();ctx.ellipse(-cw*.2,t.size*.18,Math.max(2,cw*.1),t.size*.028,-.45,0,Math.PI*2);ctx.fill();ctx.restore();}
        ctx.restore();x+=cw+spacing;
      });
    });
  }
  function heart(ctx,w,h) {
    ctx.beginPath();ctx.moveTo(w*.5,h*.92);
    ctx.bezierCurveTo(-w*.34,h*.39,w*.02,-h*.26,w*.5,h*.18);
    ctx.bezierCurveTo(w*.98,-h*.26,w*1.34,h*.39,w*.5,h*.92);ctx.closePath();
  }
  function checker(ctx,w,h,color,mint=false) {
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle=mint?'#d8eeea':shade(color,.6);
    const step=Math.max(3,w/(mint?38:14));
    for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step)if((Math.floor(x/step)+Math.floor(y/step))%2===0)ctx.fillRect(x,y,step,step);
  }
  function photoRect(s) {
    const w=s.w,h=s.h,style=s.windowFrame?s.windowStyle || 'desktop':'none';
    if(style==='photo-booth')return {x:1,y:30,w:w-2,h:Math.max(1,h-172)};
    if(style==='airdrop')return {x:1,y:76,w:w-2,h:Math.max(1,h-112)};
    if(style==='polaroid')return {x:16,y:16,w:Math.max(1,w-32),h:Math.max(1,h-52)};
    const header=style==='desktop'?Math.min(22,h*.14):0;
    return {x:0,y:header,w,h:Math.max(1,h-header)};
  }
  function rounded(ctx,x,y,w,h,r,color) {
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();
  }
  function windowFrame(ctx,s) {
    const style=s.windowStyle || 'desktop',w=s.w,h=s.h,color=s.windowColor || '#f8f8f5';
    if(style==='desktop')return;
    ctx.save();ctx.shadowColor='rgba(0,0,0,.22)';ctx.shadowBlur=9;ctx.shadowOffsetY=4;
    if(style==='circle'){ctx.beginPath();ctx.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
    else rounded(ctx,0,0,w,h,style==='polaroid'?0:14,color);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle='#292d30';ctx.font='bold 15px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    const title=(s.windowTitle || (style==='airdrop'?'AirDrop':'Photo Booth')).split('\n');
    if(style==='photo-booth'){
      ctx.fillText(title[0],w/2,15);[14,29,44].forEach(x=>{ctx.beginPath();ctx.arc(x,15,4.5,0,Math.PI*2);ctx.fill();});
      const p=photoRect(s);ctx.strokeStyle='#83878a';ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);
      ctx.beginPath();ctx.moveTo(0,p.y+p.h);ctx.lineTo(w,p.y+p.h);ctx.moveTo(0,h-23);ctx.lineTo(w,h-23);ctx.stroke();
      ctx.font='26px Segoe UI Symbol';ctx.fillText('◎',w/2,h-113);ctx.font='bold 9px Arial';ctx.fillText(title[1] || 'PHOTO LIBRARY',w/2,h-11);
    }else if(style==='airdrop'){
      ctx.font='bold 21px Arial';ctx.fillText(title[0],w/2,27);ctx.font='12px Arial';ctx.fillText(title[1] || 'Yongyong would like to share a photo.',w/2,53,w-20);
      ctx.strokeStyle='#b4b7b9';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,h-36);ctx.lineTo(w,h-36);ctx.moveTo(w/2,h-36);ctx.lineTo(w/2,h);ctx.stroke();
      ctx.fillStyle='#3186b6';ctx.font='bold 15px Arial';ctx.fillText('Decline',w*.25,h-18);ctx.fillText('Accept',w*.75,h-18);
    }
    ctx.restore();
  }
  function desktopSticker(ctx,t) {
    const w=t.badgeWidth || 100,h=t.badgeHeight || 100,c=t.badgeColor || '#f7f7f2',shape=t.badgeShape;
    if(['outline-box','sketch-arrow','connector-path'].includes(shape) && t.strokeWidth===0)return;
    ctx.strokeStyle=t.color || '#fff';ctx.fillStyle=c;ctx.lineWidth=2;ctx.lineCap='round';
    if(shape==='outline-box'){
      ctx.strokeStyle=c;ctx.lineWidth=t.strokeWidth ?? 4;ctx.strokeRect(0,0,w,h);
    }else if(shape==='sketch-arrow' || shape==='connector-path'){
      ctx.strokeStyle=c;ctx.lineWidth=t.strokeWidth ?? 4;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(w*.05,h*.08);
      if(shape==='sketch-arrow'){ctx.bezierCurveTo(w*.04,h*.63,w*.6,h*.82,w*.9,h*.82);ctx.moveTo(w*.74,h*.67);ctx.lineTo(w*.92,h*.82);ctx.lineTo(w*.76,h*.97);}
      else {ctx.lineTo(w*.8,h*.76);ctx.lineTo(w*.03,h*.98);}ctx.stroke();
    }else if(shape==='speech'){
      ctx.shadowColor='rgba(0,0,0,.15)';ctx.shadowBlur=8;rounded(ctx,0,0,w,h*.78,h*.3,c);ctx.shadowBlur=0;
      ctx.beginPath();ctx.moveTo(w*.25,h*.6);ctx.lineTo(w*.15,h);ctx.lineTo(w*.48,h*.7);ctx.fillStyle=c;ctx.fill();
      ctx.fillStyle=t.color || '#888';ctx.font=`bold ${t.size || 18}px ${t.font || 'Arial'}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.content || '•••',w/2,h*.4);
    }else if(shape==='retro-window' || shape==='profile-card'){
      ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=10;ctx.shadowOffsetY=6;ctx.fillStyle=shape==='profile-card'?'#fff':'#deded3';ctx.fillRect(0,0,w,h);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      ctx.strokeStyle='#686b69';ctx.lineWidth=3;ctx.strokeRect(0,0,w,h);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(3,3,w-6,h-6);
      const lines=(t.content || '').split('\n'),size=t.size || 17;ctx.textBaseline='top';
      if(shape==='retro-window'){
        ctx.fillStyle=c;ctx.fillRect(6,6,w-12,30);ctx.font=`${size}px ${t.font || 'Arial'}`;ctx.fillStyle='#fff';ctx.fillText(lines[0] || 'Window',13,12,w-50);
        ctx.fillStyle='#e5e5df';ctx.fillRect(w-32,10,20,20);ctx.strokeStyle='#666';ctx.lineWidth=1;ctx.strokeRect(w-32,10,20,20);ctx.fillStyle='#111';ctx.fillText('×',w-28,8);
        ctx.fillStyle=t.color || '#111';lines.slice(1).forEach((line,i)=>ctx.fillText(line,18,54+i*size*1.45,w-36));
      }else {
        ctx.fillStyle=t.color || '#111';ctx.font=`bold ${size}px ${t.font || 'Arial'}`;ctx.fillText(lines[0] || '@yongyong',w*.34,20,w*.6);
        ctx.font=`${size*.85}px ${t.font || 'Arial'}`;(lines[1] || '').split('|').forEach((label,i)=>ctx.fillText(label.trim(),w*(.34+i*.21),64,w*.2));
        ctx.font=`${size*.9}px ${t.font || 'Arial'}`;lines.slice(2).forEach((line,i)=>{ctx.fillStyle=i===lines.length-3?c:(t.color || '#111');ctx.fillText(line,22,h*.56+i*size*1.45,w-44);});
      }
    }else if(shape==='checker-panel'){
      checker(ctx,w,h,c);
    }else if(shape==='recycle-bin'){
      ctx.save();ctx.globalAlpha*=.8;ctx.fillStyle='#e9eff2';ctx.strokeStyle='#a5b3bf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.09,h*.12);ctx.lineTo(w*.2,h*.9);ctx.quadraticCurveTo(w*.5,h,w*.8,h*.9);ctx.lineTo(w*.91,h*.12);ctx.closePath();ctx.fill();ctx.stroke();
      for(let i=0;i<12;i++){const x=w*(.18+(i%3)*.22),y=h*(.22+Math.floor(i/3)*.15);ctx.fillStyle=i%2?'#fff':'#c8d6e0';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.21,y+h*.02);ctx.lineTo(x+w*.13,y+h*.19);ctx.lineTo(x-w*.04,y+h*.11);ctx.closePath();ctx.fill();}
      ctx.beginPath();ctx.ellipse(w/2,h*.12,w*.42,h*.09,0,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.fillStyle=c;ctx.textAlign='center';ctx.font=`bold ${w*.45}px Segoe UI Symbol`;ctx.fillText('♻',w*.5,h*.7);
    }else if(shape==='panel' || shape==='grid'){
      rounded(ctx,0,0,w,h,shape==='panel'?(t.cornerRadius ?? Math.min(24,h*.35)):0,c);
      if(shape==='grid'){
        ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.strokeStyle=t.color || '#7d8987';ctx.lineWidth=.65;
        for(let x=12;x<w;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
        for(let y=12;y<h;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.restore();
        ctx.strokeStyle=t.color || '#687776';ctx.lineWidth=2;ctx.strokeRect(8,8,w-16,h-16);
      }
    }else if(shape==='sparkle'){
      ctx.beginPath();ctx.moveTo(w/2,0);ctx.quadraticCurveTo(w*.56,h*.43,w,h/2);ctx.quadraticCurveTo(w*.56,h*.57,w/2,h);ctx.quadraticCurveTo(w*.44,h*.57,0,h/2);ctx.quadraticCurveTo(w*.44,h*.43,w/2,0);ctx.fill();
    }else if(shape==='printer'){
      ctx.shadowColor='rgba(0,0,0,.2)';ctx.shadowBlur=8;rounded(ctx,0,0,w,h,16,'#e5e6e4');ctx.shadowBlur=0;
      rounded(ctx,6,6,w-12,h-12,12,'#bbbcb9');rounded(ctx,14,h*.4,w-28,h*.35,9,'#7c7d7a');ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(22,h*.49,w-44,6);
    }else if(shape==='focus'){
      const labels=(t.content || '☾  Do Not Disturb\n♟  Personal\n♥\n▱  Sleep\n▣  Work').split('\n'),step=h/labels.length;
      labels.forEach((label,i)=>{ctx.globalAlpha=i===2?.45:.88;rounded(ctx,0,i*step,w,step-7,14,i===2?'#394c4a':c);ctx.globalAlpha=1;ctx.fillStyle=i===2?'#fff':'#292c2b';ctx.font=`${t.size || 13}px ${t.font || 'Arial'}`;ctx.textBaseline='middle';ctx.fillText(label,18,i*step+(step-7)/2,w-24);});
    }else if(shape==='dock'){
      ctx.globalAlpha=.72;rounded(ctx,0,0,w,h,16,c);ctx.globalAlpha=1;
      const colors=['#65bbfc','#168eed','#4ba5f5','#51c76f','#faf9f4','#faf9f4','#505d6a','#adb0a9'];
      const size=Math.min(h*.67,(w-24)/8-9),gap=(w-24-size*8)/7;
      colors.forEach((color,i)=>{const x=12+i*(size+gap),y=(h-size)/2;rounded(ctx,x,y,size,size,8,color);ctx.fillStyle=i===0?'#214e6b':i===4||i===5?'#484e51':'#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size*.6}px Segoe UI Symbol`;ctx.fillText(['☺','◈','✉','☎','13','≡','⌘','▥'][i],x+size/2,y+size/2);if(i===4){ctx.fillStyle='#e95851';ctx.fillRect(x,y+1,size,9);}});
    }else if(shape==='doodle'){
      for(let i=0;i<9;i++){ctx.save();ctx.translate(w/2,h/2);ctx.rotate(i*Math.PI*2/9);ctx.beginPath();ctx.ellipse(0,-h*.22,w*.11,h*.29,-.3,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    if(t.content && ['panel','grid'].includes(shape)){ctx.fillStyle=t.color || '#282f31';ctx.font=`${t.weight || 400} ${t.size || 14}px ${t.font || 'Arial'}`;ctx.textBaseline='middle';const lines=t.content.split('\n'),lh=(t.size || 14)*(t.lineHeight || 1.15);lines.forEach((line,i)=>ctx.fillText(line,18,h/2+(i-(lines.length-1)/2)*lh,w-36));}
  }
  function sticker(ctx,t) {
    const w=t.badgeWidth || 100,h=t.badgeHeight || 100,color=t.badgeColor || '#ee98c2';
    const label=t.content || '',shape=t.badgeShape;
    if(['panel','grid','dock','focus','printer','sparkle','doodle','outline-box','sketch-arrow','connector-path','retro-window','profile-card','speech','checker-panel','recycle-bin'].includes(shape)){desktopSticker(ctx,t);return;}
    ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#fff';ctx.lineWidth=Math.min(7,Math.min(w,h)*.09);
    ctx.fillStyle=color;
    if(shape==='checker-heart' || shape==='heart-arrow') {
      heart(ctx,w,h);ctx.stroke();ctx.save();ctx.clip();checker(ctx,w,h,color);ctx.restore();
      ctx.strokeStyle=color;ctx.lineWidth=2.5;heart(ctx,w,h);ctx.stroke();
      if(shape==='heart-arrow'){
        ctx.beginPath();ctx.moveTo(w*.55,h*.68);ctx.lineTo(w*.83,h*.43);ctx.lineTo(w*.76,h*.35);ctx.lineTo(w*.98,h*.34);ctx.lineTo(w*.99,h*.57);ctx.lineTo(w*.91,h*.5);ctx.lineTo(w*.64,h*.76);ctx.closePath();ctx.fillStyle=color;ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.stroke();ctx.fill();
      }
    } else if(shape==='burst') {
      ctx.beginPath();for(let i=0;i<36;i++){
        const a=i*Math.PI/18-Math.PI/2,r=i%2?.39:.5,x=w/2+Math.cos(a)*w*r,y=h/2+Math.sin(a)*h*r;
        if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
      }ctx.closePath();ctx.stroke();ctx.save();ctx.clip();checker(ctx,w,h,color,true);ctx.restore();
      ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
    } else if(shape==='bunny') {
      const ear=(x,angle)=>{ctx.beginPath();ctx.ellipse(x,h*.22,w*.1,h*.24,angle,0,Math.PI*2);ctx.fill();ctx.stroke();};
      ear(w*.35,-.16);ear(w*.65,.16);
      ctx.beginPath();ctx.ellipse(w/2,h*.64,w*.43,h*.33,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#563b52';[.36,.64].forEach(x=>{ctx.beginPath();ctx.ellipse(w*x,h*.62,w*.025,h*.035,0,0,Math.PI*2);ctx.fill();});
      ctx.strokeStyle='#563b52';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(w*.47,h*.76);ctx.quadraticCurveTo(w*.5,h*.81,w*.53,h*.76);ctx.stroke();
      ctx.fillStyle='#f8c9df';[.22,.78].forEach(x=>{ctx.beginPath();ctx.ellipse(w*x,h*.74,w*.075,h*.05,0,0,Math.PI*2);ctx.fill();});
    } else if(shape==='star') {
      ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.23:.49;const x=w/2+Math.cos(a)*w*r,y=h/2+Math.sin(a)*h*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
      ctx.closePath();ctx.fill();ctx.stroke();
    } else if(shape==='flower') {
      for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.ellipse(w/2+Math.cos(a)*w*.27,h/2+Math.sin(a)*h*.27,w*.18,h*.18,a,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.fillStyle='#fff3bf';ctx.beginPath();ctx.ellipse(w/2,h/2,w*.2,h*.2,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#795b72';[.44,.56].forEach(x=>ctx.fillRect(w*x,h*.46,1.5,2));
    } else if(shape==='butterfly') {
      for(const [x,y,rx,ry,a] of [[.25,.3,.23,.29,-.4],[.75,.3,.23,.29,.4],[.28,.7,.19,.22,.4],[.72,.7,.19,.22,-.4]]){ctx.beginPath();ctx.ellipse(w*x,h*y,w*rx,h*ry,a,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=shade(color,.55);ctx.fill();ctx.fillStyle=color;}
      ctx.strokeStyle='#bd87b3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.5,h*.85);ctx.lineTo(w*.5,h*.22);ctx.moveTo(w*.5,h*.3);ctx.lineTo(w*.38,0);ctx.moveTo(w*.5,h*.3);ctx.lineTo(w*.62,0);ctx.stroke();
    } else if(shape==='book') {
      ctx.beginPath();ctx.moveTo(0,h*.13);ctx.quadraticCurveTo(w*.25,0,w*.5,h*.16);ctx.quadraticCurveTo(w*.75,0,w,h*.13);ctx.lineTo(w,h*.88);ctx.quadraticCurveTo(w*.75,h*.73,w*.5,h*.95);ctx.quadraticCurveTo(w*.25,h*.73,0,h*.88);ctx.closePath();ctx.fillStyle='#fffdf8';ctx.fill();ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(w*.5,h*.16);ctx.lineTo(w*.5,h*.95);ctx.stroke();
      ctx.strokeStyle='#79bdcf';ctx.lineWidth=2.5;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(w*.1,h*(.3+i*.17));ctx.quadraticCurveTo(w*.25,h*(.24+i*.17),w*.39,h*(.31+i*.17));ctx.stroke();}
      ctx.save();ctx.translate(w*.6,h*.29);heart(ctx,w*.25,h*.26);ctx.fillStyle=shade(color,.35);ctx.fill();ctx.restore();
      ctx.fillStyle='#8acbd1';ctx.font=`${h*.24}px Arial`;ctx.fillText('✦',w*.65,h*.79);
    } else if(shape==='folder') {
      ctx.strokeStyle='#293b46';ctx.lineWidth=2.5;
      for(const shift of [12,6,0]){ctx.fillStyle=shift?'#ffe5f1':color;ctx.beginPath();ctx.moveTo(9+shift,h*.14-shift/2);ctx.lineTo(w*.37+shift,h*.14-shift/2);ctx.lineTo(w*.48+shift,0);ctx.lineTo(w*.83+shift,0);ctx.lineTo(w*.88+shift,h*.67);ctx.lineTo(3+shift,h*.67);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.fillStyle=shade(color,.18);ctx.beginPath();ctx.moveTo(0,h*.18);ctx.lineTo(w*.82,h*.18);ctx.lineTo(w*.95,h*.66);ctx.lineTo(w*.14,h*.66);ctx.closePath();ctx.fill();ctx.stroke();
      if(!label){ctx.save();ctx.translate(w*.32,h*.3);heart(ctx,w*.3,h*.25);ctx.fillStyle=shade(color,-.1);ctx.fill();ctx.restore();}
    } else if(shape==='globe') {
      const r=Math.min(w/2-4,h*.35),cx=w/2,cy=r+4;
      ctx.strokeStyle='#283e48';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.ellipse(cx,cy,r*.43,r,0,0,Math.PI*2);ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx-r*.85,cy-r*.5);ctx.lineTo(cx+r*.85,cy-r*.5);ctx.moveTo(cx-r*.85,cy+r*.5);ctx.lineTo(cx+r*.85,cy+r*.5);ctx.stroke();
    } else if(shape==='computer') {
      ctx.strokeStyle='#283e48';ctx.lineWidth=2.4;ctx.fillStyle='#f7f8ef';
      ctx.fillRect(w*.09,0,w*.82,h*.64);ctx.strokeRect(w*.09,0,w*.82,h*.64);
      ctx.fillStyle='#a9e4ec';ctx.fillRect(w*.16,h*.07,w*.68,h*.48);ctx.strokeRect(w*.16,h*.07,w*.68,h*.48);
      ctx.fillStyle='#283e48';ctx.fillRect(w*.32,h*.22,w*.09,2);ctx.fillRect(w*.62,h*.22,w*.09,2);
      ctx.beginPath();ctx.arc(w*.5,h*.3,w*.15,0,Math.PI);ctx.stroke();
      ctx.fillStyle='#f7f8ef';ctx.fillRect(w*.03,h*.66,w*.94,h*.15);ctx.strokeRect(w*.03,h*.66,w*.94,h*.15);
      for(let i=0;i<5;i++)ctx.strokeRect(w*(.12+i*.065),h*.7,2,h*.06);
    } else if(shape==='ribbon') {
      ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.strokeRect(0,0,w,h);
      const gradient=ctx.createLinearGradient(0,0,w,h);['#f4aecb','#f5efc9','#ade6e6',color].forEach((c,i)=>gradient.addColorStop(i/3,c));
      ctx.fillStyle=gradient;ctx.fillRect(2,2,w-4,h-4);
    }
    if(label){
      ctx.font=`${t.weight || 700} ${t.size}px ${t.font || 'Arial, sans-serif'}`;ctx.textAlign='center';ctx.textBaseline='middle';
      const icon=['folder','globe','computer'].includes(shape),lines=label.split('\n'),lh=t.size*(t.lineHeight || 1.1);
      if(icon){const textWidth=ctx.measureText(label).width+10;ctx.fillStyle='#fff';ctx.fillRect((w-textWidth)/2,h-t.size*1.2,textWidth,t.size*1.2);}
      ctx.fillStyle=t.color || '#d988b0';
      lines.forEach((line,i)=>ctx.fillText(line,w/2,(icon?h-t.size*.6:h/2-(lines.length-1)*lh/2)+i*lh));
    }
  }
  function draw(ctx,t) {
    if(shapes.includes(t.badgeShape)){sticker(ctx,t);return true;}
    if(t.textStyle==='balloon'){balloon(ctx,t);return true;}
    return false;
  }
  function bounds(t) {
    if(shapes.includes(t.badgeShape))return {x:t.x,y:t.y,w:(t.badgeWidth || 100)*(t.scaleX || 1),h:(t.badgeHeight || 100)*(t.scaleY || 1),rotation:t.rotation || 0};
    return null;
  }
  const silhouetteCache=new WeakMap();
  function cutoutBacking(ctx,image,w,h,item,pixelScale=1) {
    const width=item.cutoutBorderWidth || 0;
    if(!width && !item.cutoutShadow)return;
    const color=item.cutoutBorderColor || '#fff';let entry=silhouetteCache.get(image);
    if(!entry || entry.color!==color){
      const mask=document.createElement('canvas');mask.width=image.width;mask.height=image.height;
      const mc=mask.getContext('2d');mc.drawImage(image,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle=color;mc.fillRect(0,0,mask.width,mask.height);entry={color,mask};silhouetteCache.set(image,entry);
    }
    ctx.save();ctx.shadowColor='rgba(0,0,0,.32)';ctx.shadowBlur=item.cutoutShadow*pixelScale || 0;ctx.shadowOffsetY=item.cutoutShadow?5*pixelScale:0;
    ctx.drawImage(entry.mask,0,0,w,h);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    if(width)for(let i=0;i<16;i++){const a=i*Math.PI/8;ctx.drawImage(entry.mask,Math.cos(a)*width,Math.sin(a)*width,w,h);}ctx.restore();
  }
  window.PosterDecor={draw,bounds,photoRect,windowFrame,cutoutBacking};
})();
