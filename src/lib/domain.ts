export const statuses = ['pending','preparing','ready','completed','cancelled'] as const;
export type Status = typeof statuses[number];
export type ServiceType = 'takeaway'|'dine-in';
export type ServiceFilter = 'all'|ServiceType;
export type PaymentMethod = 'cash'|'upi'|'other';
export interface MenuOption { id:string; productId:string; name:string; variant:string; portion:string; pieces:number|null; price:number; available:boolean; category:string; sort:number; image:string; driveFileId?:string; }
export interface OrderItem { serviceType:ServiceType; id:string; optionId:string; name:string; variant:string; portion:string; pieces:number|null; quantity:number; unitPrice:number; total:number; note:string; }
export interface Order { id:string; businessDate:string; sequence:number; status:Status; type:'takeaway'|'dine-in'; note:string; items:OrderItem[]; subtotal:number; adjustment:number; total:number; collected:number; method:PaymentMethod|null; createdAt:number; updatedAt:number; version:number; }
export type KitchenMenuItem=Pick<MenuOption,'id'|'name'|'variant'|'portion'|'category'|'sort'|'available'>;
export const kitchenMenu=(menu:MenuOption[]):KitchenMenuItem[]=>menu.map(({id,name,variant,portion,category,sort,available})=>({id,name,variant,portion,category,sort,available}));
export interface KitchenOrder { id:string; sequence:number; businessDate:string; type:Order['type']; status:Status; note:string; createdAt:number; updatedAt:number; version:number; items:(Pick<OrderItem,'name'|'variant'|'portion'|'pieces'|'quantity'|'note'|'serviceType'>&{optionId?:string})[]; }
export interface AuditEvent {id:string;orderId:string;kind:string;version:number;createdAt:number;detail:string;}
export interface Settings {name:string;timezone:string;open:string;close:string;currency:string;}
export interface Stats {orders:number;active:number;pending:number;completed:number;cancelled:number;gross:number;net:number;collected:number;unpaid:number;plates:number;}
export interface Snapshot {menu:MenuOption[];orders:Order[];stats:Stats;settings:Settings;businessDate:string;realtimeConfigured:boolean;displayConfigured:boolean;}
export interface Draft {idempotencyKey:string;items:{optionId:string;quantity:number;note?:string;serviceType?:ServiceType}[];type:Order['type'];note:string;paymentMethod:PaymentMethod|null;paid:boolean;adjustment:number;}
export const defaultSettings:Settings={name:'Moped Momos',timezone:'Asia/Kolkata',open:'18:00',close:'21:30',currency:'INR'};
export const money=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:paise%100?2:0}).format(paise/100);
export const ticket=(n:number)=>'#'+String(n).padStart(3,'0');
export function businessDate(now:Date=new Date(),timezone='Asia/Kolkata'):string {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');
}
export const isActive=(s:Status)=>['pending','preparing','ready'].includes(s);
export function canTransition(from:Status,to:Status) {
  const allowed:Record<Status,Status[]>={pending:['preparing','ready','completed','cancelled'],preparing:['ready','completed','cancelled'],ready:['completed','cancelled'],completed:[],cancelled:[]};
  return allowed[from].includes(to);
}
export function summarize(orders:KitchenOrder[]) {
  const map=new Map<string,{name:string;variant:string;portion:string;serviceType:ServiceType;plates:number;pieces:number|null}>();
  for(const o of orders.filter(o=>o.status==='pending'||o.status==='preparing')) for(const i of o.items) {
    const key=JSON.stringify([i.name,i.variant,i.portion,i.pieces,i.serviceType??o.type]); const row=map.get(key)??{name:i.name,variant:i.variant,portion:i.portion,serviceType:i.serviceType??o.type,plates:0,pieces:i.pieces===null?null:0};
    row.plates+=i.quantity; if(row.pieces!==null&&i.pieces!==null)row.pieces+=i.quantity*i.pieces; map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>b.plates-a.plates);
}
export function calculateStats(orders:Order[]):Stats {
  const valid=orders.filter(o=>o.status!=='cancelled');
  return {orders:orders.length,active:orders.filter(o=>isActive(o.status)).length,pending:orders.filter(o=>o.status==='pending').length,completed:orders.filter(o=>o.status==='completed').length,cancelled:orders.filter(o=>o.status==='cancelled').length,gross:valid.reduce((s,o)=>s+o.subtotal,0),net:valid.reduce((s,o)=>s+o.total,0),collected:orders.reduce((s,o)=>s+o.collected,0),unpaid:valid.reduce((s,o)=>s+Math.max(0,o.total-o.collected),0),plates:valid.reduce((s,o)=>s+o.items.reduce((s,i)=>s+i.quantity,0),0)};
}
export function kitchenProjection(orders:Order[]):KitchenOrder[] {
  return orders.filter(o=>isActive(o.status)).map(({id,sequence,businessDate,type,status,note,createdAt,updatedAt,version,items})=>({id,sequence,businessDate,type,status,note,createdAt,updatedAt,version,items:items.map(({optionId,name,variant,portion,pieces,quantity,note,serviceType})=>({optionId,name,variant,portion,pieces,quantity,note,serviceType:serviceType??type}))}));
}
export const csvCell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
// getRandomValues remains available on local HTTP preview origins where randomUUID is absent.
export function newId():string {if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

export const serviceName=(type:ServiceType)=>type==='dine-in'?'Dine-in':'Parcel';
export function serviceLabel(items:{serviceType?:ServiceType}[],fallback:ServiceType):string {const types=new Set(items.map(i=>i.serviceType??fallback));return types.size>1?'Dine-in + Parcel':serviceName(types.values().next().value??fallback);}
export function filterKitchenOrders(orders:KitchenOrder[],filter:ServiceFilter):KitchenOrder[] {if(filter==='all')return orders;return orders.map(o=>({...o,items:o.items.filter(i=>(i.serviceType??o.type)===filter)})).filter(o=>o.items.length>0);}

export interface DailyBreakdown {
  date: string;
  ordersCount: number;
  completedCount: number;
  netPaise: number;
  collectedPaise: number;
  unpaidPaise: number;
  platesCount: number;
  topItem?: string;
}

export interface ItemSalesInsight {
  name: string;
  variant: string;
  portion: string;
  quantity: number;
  revenuePaise: number;
}

export interface ComprehensiveInsights {
  stats: Stats;
  aovPaise: number;
  dineInCount: number;
  takeawayCount: number;
  mixedCount: number;
  dineInPlates: number;
  takeawayPlates: number;
  dineInNetPaise: number;
  dineInCollectedPaise: number;
  dineInUnpaidPaise: number;
  takeawayNetPaise: number;
  takeawayCollectedPaise: number;
  takeawayUnpaidPaise: number;
  cashPaise: number;
  upiPaise: number;
  otherPaise: number;
  dineInCashPaise: number;
  dineInUpiPaise: number;
  takeawayCashPaise: number;
  takeawayUpiPaise: number;
  dailyBreakdown: DailyBreakdown[];
  topItems: ItemSalesInsight[];
}

export function calculateInsights(orders: Order[]): ComprehensiveInsights {
  const stats = calculateStats(orders);
  const valid = orders.filter(o => o.status !== 'cancelled');
  const aovPaise = valid.length ? Math.round(stats.net / valid.length) : 0;
  let dineInCount = 0, takeawayCount = 0, mixedCount = 0;
  let dineInPlates = 0, takeawayPlates = 0;
  let dineInNetPaise = 0, dineInCollectedPaise = 0, dineInUnpaidPaise = 0;
  let takeawayNetPaise = 0, takeawayCollectedPaise = 0, takeawayUnpaidPaise = 0;
  let cashPaise = 0, upiPaise = 0, otherPaise = 0;
  let dineInCashPaise = 0, dineInUpiPaise = 0;
  let takeawayCashPaise = 0, takeawayUpiPaise = 0;

  for (const o of valid) {
    let orderDineInTotal = 0;
    let orderTakeawayTotal = 0;
    let orderDineInPlates = 0;
    let orderTakeawayPlates = 0;

    for (const item of o.items) {
      const sType = item.serviceType ?? o.type;
      if (sType === 'dine-in') {
        orderDineInTotal += item.total;
        orderDineInPlates += item.quantity;
      } else {
        orderTakeawayTotal += item.total;
        orderTakeawayPlates += item.quantity;
      }
    }

    const itemsSum = orderDineInTotal + orderTakeawayTotal;
    let orderDineInNet = 0;
    let orderTakeawayNet = 0;
    let orderDineInCollected = 0;
    let orderTakeawayCollected = 0;

    if (itemsSum > 0) {
      const dineRatio = orderDineInTotal / itemsSum;
      orderDineInNet = Math.round(o.total * dineRatio);
      orderTakeawayNet = o.total - orderDineInNet;

      orderDineInCollected = Math.round(o.collected * dineRatio);
      orderTakeawayCollected = o.collected - orderDineInCollected;
    } else {
      if (o.type === 'dine-in') {
        orderDineInNet = o.total;
        orderDineInCollected = o.collected;
      } else {
        orderTakeawayNet = o.total;
        orderTakeawayCollected = o.collected;
      }
    }

    dineInNetPaise += orderDineInNet;
    takeawayNetPaise += orderTakeawayNet;
    dineInCollectedPaise += orderDineInCollected;
    takeawayCollectedPaise += orderTakeawayCollected;
    dineInUnpaidPaise += Math.max(0, orderDineInNet - orderDineInCollected);
    takeawayUnpaidPaise += Math.max(0, orderTakeawayNet - orderTakeawayCollected);

    dineInPlates += orderDineInPlates;
    takeawayPlates += orderTakeawayPlates;

    if (orderDineInPlates > 0 && orderTakeawayPlates > 0) {
      mixedCount++;
      dineInCount++;
      takeawayCount++;
    } else if (orderDineInPlates > 0 || o.type === 'dine-in') {
      dineInCount++;
    } else {
      takeawayCount++;
    }

    if (o.collected > 0) {
      if (o.method === 'cash') {
        cashPaise += o.collected;
        dineInCashPaise += orderDineInCollected;
        takeawayCashPaise += orderTakeawayCollected;
      } else if (o.method === 'upi') {
        upiPaise += o.collected;
        dineInUpiPaise += orderDineInCollected;
        takeawayUpiPaise += orderTakeawayCollected;
      } else {
        otherPaise += o.collected;
      }
    }
  }

  const dayMap = new Map<string, { ordersCount: number; completedCount: number; netPaise: number; collectedPaise: number; unpaidPaise: number; platesCount: number; itemCounts: Map<string, number> }>();

  for (const o of orders) {
    let day = dayMap.get(o.businessDate);
    if (!day) {
      day = { ordersCount: 0, completedCount: 0, netPaise: 0, collectedPaise: 0, unpaidPaise: 0, platesCount: 0, itemCounts: new Map() };
      dayMap.set(o.businessDate, day);
    }
    day.ordersCount++;
    if (o.status === 'completed') day.completedCount++;
    day.collectedPaise += o.collected;
    if (o.status !== 'cancelled') {
      day.netPaise += o.total;
      day.unpaidPaise += Math.max(0, o.total - o.collected);
      for (const i of o.items) {
        day.platesCount += i.quantity;
        const key = `${i.name} (${i.variant})`;
        day.itemCounts.set(key, (day.itemCounts.get(key) ?? 0) + i.quantity);
      }
    }
  }

  const dailyBreakdown: DailyBreakdown[] = [...dayMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, d]) => {
      let topItem: string | undefined;
      let maxQty = 0;
      for (const [name, qty] of d.itemCounts.entries()) {
        if (qty > maxQty) {
          maxQty = qty;
          topItem = `${name} × ${qty}`;
        }
      }
      return {
        date,
        ordersCount: d.ordersCount,
        completedCount: d.completedCount,
        netPaise: d.netPaise,
        collectedPaise: d.collectedPaise,
        unpaidPaise: d.unpaidPaise,
        platesCount: d.platesCount,
        topItem
      };
    });

  const itemMap = new Map<string, ItemSalesInsight>();
  for (const o of valid) {
    for (const i of o.items) {
      const key = `${i.name}#${i.variant}#${i.portion}`;
      const entry = itemMap.get(key) ?? {
        name: i.name,
        variant: i.variant,
        portion: i.portion,
        quantity: 0,
        revenuePaise: 0
      };
      entry.quantity += i.quantity;
      entry.revenuePaise += i.total;
      itemMap.set(key, entry);
    }
  }

  const topItems = [...itemMap.values()].sort((a, b) => b.quantity - a.quantity || b.revenuePaise - a.revenuePaise);

  return {
    stats,
    aovPaise,
    dineInCount,
    takeawayCount,
    mixedCount,
    dineInPlates,
    takeawayPlates,
    dineInNetPaise,
    dineInCollectedPaise,
    dineInUnpaidPaise,
    takeawayNetPaise,
    takeawayCollectedPaise,
    takeawayUnpaidPaise,
    cashPaise,
    upiPaise,
    otherPaise,
    dineInCashPaise,
    dineInUpiPaise,
    takeawayCashPaise,
    takeawayUpiPaise,
    dailyBreakdown,
    topItems
  };
}

