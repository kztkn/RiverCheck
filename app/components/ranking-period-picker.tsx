import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react';
import type { Season } from '@domain/season/season';
import { BodyPortal } from './body-portal';
export function RankingPeriodPicker({seasons,selectedKey,onSelect}:{seasons:Season[];selectedKey:string;onSelect:(key:string)=>void}) {
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if(!open && dialog.current?.open) dialog.current.close();
  },[open]);
  useEffect(()=>setOpen(false),[selectedKey]);
  const choices=[...seasons.map(s=>({key:s.key,name:s.name})),{key:'all',name:'通算'}];
  return <>
    <button ref={trigger} type="button" className="ranking-period-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
      {choices.find(s=>s.key===selectedKey)?.name ?? '通算'}<IconChevronDown aria-hidden="true" size={20}/>
    </button>
    <BodyPortal><dialog ref={dialog} className="table-event-dialog ranking-period-dialog" aria-labelledby="ranking-period-title" onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <div className="table-event-sheet">
        <header className="table-event-header"><h2 id="ranking-period-title">ランキングの期間</h2><button type="button" className="participant-roster-close" aria-label="期間選択を閉じる" onClick={()=>setOpen(false)}><IconX size={20}/></button></header>
        <div className="ranking-period-choices">{choices.map(choice=><button key={choice.key} type="button" aria-pressed={selectedKey===choice.key} onClick={()=>{setOpen(false);onSelect(choice.key);}}><span>{choice.name}</span>{selectedKey===choice.key?<IconCheck aria-hidden="true" size={20}/>:null}</button>)}</div>
      </div>
    </dialog></BodyPortal>
  </>;
}
