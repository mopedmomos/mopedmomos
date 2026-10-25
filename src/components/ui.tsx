'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {X,Bike,Soup} from 'lucide-react';
export function Brand({small=false}:{small?:boolean}) {return <div className={'brand '+(small?'small':'')}><span className="brand-icon"><Bike size={28}/></span><div><strong>MOPED<span>MOMOS</span></strong><small>ROLLING GOODNESS</small></div></div>;}
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const el=ref.current;el?.showModal();return()=>el?.close();},[]);
 return <dialog ref={ref} className={'modal '+(wide?'wide':'')} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function FoodPhoto({image,small=false}:{image:string;small?:boolean}) {return <div className={`food-photo photo-${image.startsWith('data:')?'custom':image} ${small?'thumb':''}`}><img className="product-photo-img" src={image.startsWith('data:image/')?image:`/assets/menu/${image}.webp`} alt={image.startsWith('data:')?'Uploaded menu photo':image.replaceAll('-',' ')+' — Moped Momos menu illustration'} loading="lazy" decoding="async"/></div>;}
export function Empty({title,detail,children}:{title:string;detail:string;children?:ReactNode}){return <div className="empty"><div><Soup size={32}/></div><h3>{title}</h3><p>{detail}</p>{children}</div>;}
