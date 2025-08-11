
function pill(t){const s=document.createElement('span');s.className='pill';s.textContent=t;return s}
function formatTime(s){const m=Math.floor(s/60).toString().padStart(2,'0');const r=Math.floor(s%60).toString().padStart(2,'0');return `${m}:${r}`}

const DAY_KEY="hs-json-progress";
function saveProgress(o){localStorage.setItem(DAY_KEY,JSON.stringify(o))}
function loadProgress(){try{return JSON.parse(localStorage.getItem(DAY_KEY))||{}}catch{return {}}}
let progress=loadProgress();

const state={data:[],byDay:{},day:1};

async function loadData(){
  const url=(window.APP_CONFIG&&window.APP_CONFIG.dataURL)||'./workouts.json';
  const res=await fetch(url,{cache:'no-cache'});
  if(!res.ok) throw new Error('Failed to load data: '+res.status);
  const data=await res.json();
  state.data=data; state.byDay={}; data.forEach(o=>{ if(o.day) state.byDay[o.day]=o; });
}

function setHealth(msg){const el=document.getElementById('health'); el.innerHTML=`<p>${msg}</p>`;}

function renderDay(day){
  const plan=state.byDay[day];
  const out=document.getElementById('workout'); out.innerHTML='';
  document.getElementById('day-input').value=day;

  if(!plan){ setHealth(`No data for day ${day}.`); return; }
  setHealth(`Loaded Day ${day}: ${plan.title}`);

  const header=document.createElement('div'); header.className='workout-header';
  header.innerHTML=`<div><h2>${plan.title}</h2><p class="muted">${plan.phase||''}</p></div>`;
  out.appendChild(header);

  const drills=(plan.drills||[]).filter(d=>d&&d.name);
  if(!drills.length){ setHealth(`Day ${day} loaded, but no drills found.`); }

  drills.forEach((d,idx)=>{
    try{
      const card=document.createElement('article'); card.className='card drill';

      // media
      const media=document.createElement('div'); media.className='media';
      const img=document.createElement('img'); img.alt=d.name+' demo'; img.loading='lazy'; img.src=d.gif||''; media.appendChild(img);
      const acts=document.createElement('div'); acts.className='actions';
      const watch=document.createElement('button'); watch.className='btn small'; watch.textContent='Watch video';
      watch.addEventListener('click',()=>openVideo(d.mp4)); acts.appendChild(watch);
      if(d.tutorial){ const tut=document.createElement('a'); tut.href=d.tutorial; tut.target='_blank'; tut.rel='noopener'; tut.className='btn small'; tut.textContent='Full tutorial'; acts.appendChild(tut); }
      media.appendChild(acts);

      // content
      const content=document.createElement('div');
      const title=document.createElement('h2'); title.textContent=d.name; content.appendChild(title);

      const repsStr=(d.reps||'').toLowerCase().trim();
      const isHold=/(\d+)\s*(s|sec|secs|second|seconds)\b/.test(repsStr);
      const pills=document.createElement('div'); pills.className='pills';
      pills.appendChild(pill(isHold?'Timer':'Reps'));
      if(d.sets) pills.appendChild(pill(`${d.sets} sets`));
      if(d.reps) pills.appendChild(pill(`${d.reps}`));
      content.appendChild(pills);

      const controls=document.createElement('div'); controls.className='controls';
      const doneRow=document.createElement('label'); doneRow.className='checkbox';
      const doneCb=document.createElement('input'); doneCb.type='checkbox';
      const doneSpan=document.createElement('span'); doneSpan.textContent='Mark drill done';
      doneRow.append(doneCb,doneSpan);

      const key=`day${day}-drill${idx}`;
      const saveDrill=(o)=>{ progress[key]={...(progress[key]||{}),...o}; saveProgress(progress); };
      const prev=progress[key]||{}; doneCb.checked=!!prev.done; doneCb.addEventListener('change',()=>saveDrill({done:doneCb.checked}));

      if(isHold){
        // DIAG
        const mm=repsStr.match(/(\d+)/);
        const seconds=mm?parseInt(mm[1],10):30;
        const diag=document.createElement('div'); diag.className='muted small'; diag.textContent=`Timer mode • parsed seconds: ${seconds}`; content.appendChild(diag);

        // timer UI
        const t=document.createElement('div'); t.className='timer';
        const timeDisplay=document.createElement('span'); timeDisplay.className='time-display';
        const start=document.createElement('button'); start.className='btn'; start.textContent='Start';
        const pause=document.createElement('button'); pause.className='btn'; pause.textContent='Pause';
        const reset=document.createElement('button'); reset.className='btn'; reset.textContent='Reset';
        const setC=document.createElement('span'); setC.className='set-counter';

        const totalSets=parseInt(d.sets,10)||1;
        let remaining=prev.remaining??seconds;
        let currentSet=prev.currentSet??1;
        let running=false, raf=0, lastTs=0;

        timeDisplay.textContent=formatTime(remaining);
        setC.textContent=`Set ${currentSet} / ${totalSets}`;

        function tick(ts){
          if(!running) return;
          if(!lastTs) lastTs=ts;
          const delta=(ts-lastTs)/1000; lastTs=ts;
          remaining=Math.max(0,remaining-delta);
          timeDisplay.textContent=formatTime(remaining);
          if(remaining<=0){
            if(navigator.vibrate) navigator.vibrate([80,40,80]);
            if(currentSet<totalSets){ currentSet++; remaining=seconds; setC.textContent=`Set ${currentSet} / ${totalSets}`; }
            else { running=false; timeDisplay.textContent='Done'; doneCb.checked=true; }
          }
          saveDrill({remaining,currentSet,done:doneCb.checked});
          raf=requestAnimationFrame(tick);
        }
        start.addEventListener('click',()=>{ if(running) return; running=true; lastTs=0; raf=requestAnimationFrame(tick); });
        pause.addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); saveDrill({remaining,currentSet}); });
        reset.addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); remaining=seconds; currentSet=1; lastTs=0; timeDisplay.textContent=formatTime(remaining); setC.textContent=`Set ${currentSet} / ${totalSets}`; saveDrill({remaining,currentSet,done:false}); doneCb.checked=false; });

        t.append(timeDisplay,start,pause,reset,setC);
        controls.appendChild(t);
      } else {
        // reps UI
        const r=document.createElement('div'); r.className='reps';
        const minus=document.createElement('button'); minus.className='btn'; minus.textContent='−';
        const input=document.createElement('input'); input.type='number'; input.min='0'; input.step='1'; input.className='reps-input';
        const plus=document.createElement('button'); plus.className='btn'; plus.textContent='+';
        const setDone=document.createElement('button'); setDone.className='btn'; setDone.textContent='Set done';
        const reset=document.createElement('button'); reset.className='btn'; reset.textContent='Reset';
        const setC=document.createElement('span'); setC.className='set-counter';

        let currentSet=prev.currentSet??1;
        let repsCompleted=prev.repsCompleted??0;
        input.value=repsCompleted;
        const totalSets=parseInt(d.sets,10)||1;
        setC.textContent=`Set ${currentSet} / ${totalSets}`;

        const save=()=>saveDrill({currentSet,repsCompleted,done:doneCb.checked});
        minus.addEventListener('click',()=>{ input.stepDown(); repsCompleted=Math.max(0,Number(input.value)); save(); });
        plus.addEventListener('click',()=>{ input.stepUp(); repsCompleted=Number(input.value); save(); });
        input.addEventListener('input',()=>{ repsCompleted=Math.max(0,Number(input.value)); save(); });
        setDone.addEventListener('click',()=>{ if(currentSet<totalSets){ currentSet++; repsCompleted=0; input.value=0; setC.textContent=`Set ${currentSet} / ${totalSets}`; } else { doneCb.checked=true; } save(); });
        reset.addEventListener('click',()=>{ currentSet=1; repsCompleted=0; input.value=0; doneCb.checked=false; setC.textContent=`Set ${currentSet} / ${totalSets}`; save(); });

        r.append(minus,input,plus,setC,setDone,reset);
        controls.appendChild(r);
      }

      content.appendChild(controls);
      content.appendChild(doneRow);
      card.appendChild(media); card.appendChild(content);
      out.appendChild(card);
    }catch(e){
      const err=document.createElement('div'); err.className='card'; err.innerHTML=`<p class="muted">Error rendering drill ${idx+1}: ${e.message}</p>`; out.appendChild(err);
    }
  });

  // day meta
  const cd=document.getElementById('complete-day');
  const dn=document.getElementById('day-notes');
  const dayKey=`day${day}-meta`;
  const meta=progress[dayKey]||{};
  cd.checked=!!meta.complete; dn.value=meta.notes||'';
  cd.addEventListener('change',()=>{ progress[dayKey]={...(progress[dayKey]||{}),complete:cd.checked,notes:dn.value}; saveProgress(progress); });
  dn.addEventListener('input',()=>{ progress[dayKey]={...(progress[dayKey]||{}),complete:cd.checked,notes:dn.value}; saveProgress(progress); });
}

function openVideo(url){
  if(!url){ alert('No video URL set for this drill.'); return; }
  const dlg=document.getElementById('video-dialog');
  const vid=document.getElementById('video-player');
  vid.src=url; dlg.showModal();
  dlg.addEventListener('close',()=>{ vid.pause(); vid.src=''; },{once:true});
}

async function init(){
  document.getElementById('refresh-btn').addEventListener('click', async()=>{ await loadData(); renderDay(state.day); });
  document.getElementById('prev-btn').addEventListener('click', ()=>{ state.day=Math.max(1,state.day-1); renderDay(state.day); });
  document.getElementById('next-btn').addEventListener('click', ()=>{ state.day=state.day+1; renderDay(state.day); });
  document.getElementById('today-btn').addEventListener('click', ()=>{ state.day=1; renderDay(state.day); });
  document.getElementById('day-input').addEventListener('change', (e)=>{ const v=parseInt(e.target.value,10)||1; state.day=v; renderDay(state.day); });

  document.getElementById('clear-btn').addEventListener('click', ()=>{ localStorage.removeItem(DAY_KEY); alert('Saved data cleared'); });
  document.getElementById('export-data').addEventListener('click',(e)=>{ e.preventDefault(); const blob=new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='handstand-progress.json'; a.click(); URL.revokeObjectURL(url); });

  await loadData(); state.day=1; renderDay(state.day);
}
init();
