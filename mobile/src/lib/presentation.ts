import type {MenuOption} from './domain';
export const menuTabs=['All','Steam','Fried','Peri Peri','Kurkure','Kurkure + Peri Peri','Sides','Sides + Peri Peri','Mojito'] as const;
export type MenuTab=typeof menuTabs[number];
const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function matchesMenuTab(o:MenuOption,tab:MenuTab){const v=normalized(o.variant),momo=o.category==='Momos',side=o.category==='Sides',peri=v.includes('peri'),kurkure=v.includes('kurkure');switch(tab){case 'All':return true;case 'Steam':return momo&&v==='steamed';case 'Fried':return momo&&v==='fried';case 'Peri Peri':return momo&&peri&&!kurkure;case 'Kurkure':return momo&&kurkure&&!peri;case 'Kurkure + Peri Peri':return momo&&kurkure&&peri;case 'Sides':return side&&!peri;case 'Sides + Peri Peri':return side&&peri;case 'Mojito':return o.category==='Drinks';}}
export function preparationName(i:{name:string;variant:string}){if(/^chicken momos$/i.test(i.name))return i.variant;if(/peri/i.test(i.variant))return `${i.name} + Peri Peri`;return /^(classic|regular|chilled)$/i.test(i.variant)?i.name:`${i.name} · ${i.variant}`;}
export function preparationColor(i:{name:string;variant:string}){const v=i.variant.toLowerCase();return v.includes('kurkure')&&v.includes('peri')?'#E2B4FF':v.includes('kurkure')?'#FFC66D':v.includes('peri')?'#FF9B86':v.includes('fried')?'#F6D176':/momos/i.test(i.name)?'#8CCBFF':'#85D9B6';}

export interface PlateCount {id:string;label:string;name:string;variant:string;portion:string;quantity:number;dineIn:number;parcel:number;unit:'plates'|'drinks';}
/** Each menu option gets its own card. Ordered servings count as plates, never pieces. */
export function kitchenPlateCounts(orders:import('./domain').KitchenOrder[],menu:import('./domain').KitchenMenuItem[]=[]){
 const rows=new Map<string,PlateCount>();
 const legacyKey=(i:{name:string;variant:string;portion:string})=>JSON.stringify([i.name,i.variant,i.portion]);
 const add=(i:{name:string;variant:string;portion:string;optionId?:string;category?:string})=>{
  const match=menu.find(m=>m.id===i.optionId)??menu.find(m=>legacyKey(m)===legacyKey(i));
  const id=match?.id??i.optionId??legacyKey(i);let row=rows.get(id);
  if(!row){row={id,label:preparationName(i),name:i.name,variant:i.variant,portion:i.portion,quantity:0,dineIn:0,parcel:0,unit:(match?.category??i.category)==='Drinks'||/mojito|drink|juice|soda/i.test(i.name)?'drinks':'plates'};rows.set(id,row);}return row;
 };
 for(const m of [...menu].sort((a,b)=>a.sort-b.sort))if(m.available)add({...m,optionId:m.id});
 for(const o of orders){if(!['pending','preparing','ready'].includes(o.status))continue;for(const i of o.items){const row=add(i);row.quantity+=i.quantity;if((i.serviceType??o.type)==='dine-in')row.dineIn+=i.quantity;else row.parcel+=i.quantity;}}
 const counts=[...rows.values()].filter(row=>row.quantity>0);return {rows:counts,totalPlates:counts.filter(r=>r.unit==='plates').reduce((n,r)=>n+r.quantity,0),totalDrinks:counts.filter(r=>r.unit==='drinks').reduce((n,r)=>n+r.quantity,0)};
}
