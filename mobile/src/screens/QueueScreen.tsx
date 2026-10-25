import React,{useState} from 'react';
import {View,Text,ScrollView,Pressable,StyleSheet,RefreshControl} from 'react-native';
import {isActive,money,ticket,serviceName,canTransition,type Snapshot,type Order,type ServiceFilter} from '../lib/domain';
import {preparationName} from '../lib/presentation';
import type {Repository} from '../lib/repository';
import {Badge,Chip,Empty,Icon,SectionTitle,Button,ErrorBanner,Sheet,u,colors} from '../components/ui';
import {QuickPaySheet} from '../components/Payment';

export function QueueScreen({snapshot,onSelect,onRefresh,repo}:{snapshot:Snapshot;onSelect:(o:Order)=>void;onRefresh:()=>Promise<void>;repo:Repository}){
  const [service,setService]=useState<ServiceFilter>('all');
  const [viewUnpaid,setViewUnpaid]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [payOrder,setPayOrder]=useState<Order|null>(null);
  const [unpaidConfirmOrder,setUnpaidConfirmOrder]=useState<Order|null>(null);

  // All active kitchen orders:
  const active = snapshot.orders.filter(o => isActive(o.status));

  // All unpaid orders for today (both in-kitchen and already served):
  const allUnpaid = snapshot.orders.filter(o => o.collected < o.total && o.status !== 'cancelled');
  const unpaidTotal = allUnpaid.reduce((s, o) => s + (o.total - o.collected), 0);
  const servedUnpaid = allUnpaid.filter(o => o.status === 'completed');

  // Filtered orders:
  const filtered = viewUnpaid
    ? allUnpaid.filter(o => service === 'all' || o.items.some(i => (i.serviceType ?? o.type) === service)).sort((a,b) => b.createdAt - a.createdAt)
    : active.filter(o => service === 'all' || o.items.some(i => (i.serviceType ?? o.type) === service)).sort((a,b) => a.createdAt - b.createdAt);

  async function advance(o:Order){
    if(busy)return;
    if(o.collected < o.total){
      setUnpaidConfirmOrder(o);
      return;
    }
    await markServed(o);
  }

  async function markServed(o:Order){
    setBusy(o.id);
    setError('');
    try{
      await repo.update(o.id,{version:o.version,status:'completed'});
      await onRefresh();
    }catch(e){
      setError(e instanceof Error?e.message:'Could not update ticket.');
    }finally{
      setBusy(null);
      setUnpaidConfirmOrder(null);
    }
  }

  async function handleQuickPay(method:'cash'|'upi',andServe=false){
    if(!payOrder||busy)return;
    setBusy(payOrder.id);
    setError('');
    try{
      const updated=await repo.update(payOrder.id,{version:payOrder.version,payment:{collected:payOrder.total,method}});
      if(andServe && canTransition(updated.status, 'completed')){
        await repo.update(payOrder.id,{version:updated.version,status:'completed'});
      }
      setPayOrder(null);
      await onRefresh();
    }catch(e){
      setError(e instanceof Error?e.message:'Could not record payment.');
    }finally{
      setBusy(null);
    }
  }

  return <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl tintColor={colors.yellow} refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void onRefresh().finally(()=>setRefreshing(false));}}/>} contentContainerStyle={[u.content,{padding:16,gap:16}]}>
    <SectionTitle
      eyebrow={viewUnpaid ? "PAYMENT DUE SETTLEMENT" : "LIVE KITCHEN"}
      title={viewUnpaid ? "Unpaid orders" : "Order queue"}
      right={
        <View style={[s.active, viewUnpaid && {borderColor:'#C55328',backgroundColor:'#331911'}]}>
          <Text style={[s.activeNumber, viewUnpaid && {color:'#FF8D5B'}]}>{viewUnpaid ? allUnpaid.length : active.length}</Text>
          <Text style={[s.activeLabel, viewUnpaid && {color:'#FF8D5B'}]}>{viewUnpaid ? 'UNPAID' : 'ACTIVE'}</Text>
        </View>
      }
    />

    {/* Primary Mode Chips */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
      <Chip label={`Live Queue (${active.length})`} icon="list" selected={!viewUnpaid} onPress={()=>setViewUnpaid(false)}/>
      <Chip
        label={`⚡ Unpaid Due (${allUnpaid.length}${allUnpaid.length ? ` · ${money(unpaidTotal)}` : ''})`}
        icon="clock"
        selected={viewUnpaid}
        onPress={()=>setViewUnpaid(true)}
      />
      {(['all','dine-in','takeaway'] as const).map(t=>(
        <Chip key={t} label={t==='all'?'All dining':serviceName(t)} selected={service===t} onPress={()=>setService(t)}/>
      ))}
    </ScrollView>

    {/* Alert Banner when there are served orders with pending payments */}
    {!viewUnpaid && servedUnpaid.length > 0 && (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${servedUnpaid.length} served unpaid orders`}
        onPress={()=>setViewUnpaid(true)}
        style={s.unpaidNoticeBanner}
      >
        <View style={s.unpaidNoticeIcon}>
          <Icon name="clock" size={16} color="#FF9B70"/>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text style={s.unpaidNoticeTitle}>{servedUnpaid.length} served {servedUnpaid.length===1?'ticket has':'tickets have'} pending payment</Text>
          <Text style={s.unpaidNoticeDetail}>{money(servedUnpaid.reduce((s,o)=>s+(o.total-o.collected),0))} outstanding due · Tap to collect</Text>
        </View>
        <Icon name="chevron-right" size={16} color="#FF9B70"/>
      </Pressable>
    )}

    {Boolean(error) && <ErrorBanner message={error}/>}

    {filtered.map((o,index)=>(
      <TicketCard
        key={o.id}
        order={o}
        position={viewUnpaid ? undefined : index+1}
        onPress={()=>onSelect(o)}
        onOpenPay={()=>setPayOrder(o)}
        service={service}
        busy={busy===o.id}
        disabled={Boolean(busy)}
        onAdvance={viewUnpaid || o.status === 'completed' ? undefined : ()=>void advance(o)}
      />
    ))}

    {!filtered.length && (
      <Empty
        title={viewUnpaid ? "All tickets are paid" : "Queue is clear"}
        description={viewUnpaid ? "Every served and active order has zero outstanding balance." : "New orders appear here. Use New order to create a ticket."}
        icon="check-circle"
      />
    )}

    {/* Settle Unpaid Warning / Confirmation Sheet when marking served */}
    {unpaidConfirmOrder && (
      <Sheet
        visible
        title={`Unpaid ticket ${ticket(unpaidConfirmOrder.sequence)}`}
        onClose={()=>setUnpaidConfirmOrder(null)}
        footer={<Button title="Keep in queue" variant="secondary" onPress={()=>setUnpaidConfirmOrder(null)}/>}
      >
        <View style={{alignItems:'center',gap:8,paddingVertical:12}}>
          <View style={s.warnIcon}>
            <Icon name="clock" size={32} color="#FF9B70"/>
          </View>
          <Text style={u.eyebrow}>OUTSTANDING DUE</Text>
          <Text style={{fontSize:36,fontWeight:'800',color:colors.green}}>{money(unpaidConfirmOrder.total - unpaidConfirmOrder.collected)}</Text>
          <Text style={[u.body,{textAlign:'center',maxWidth:320}]}>
            This order has not been paid yet. Choose whether to collect now or allow post-meal payment:
          </Text>
        </View>
        <View style={{gap:10,marginTop:6}}>
          <Button
            title="⚡ Settle Payment & Mark Served"
            icon="check"
            style={{backgroundColor:colors.green,minHeight:50}}
            onPress={()=>{
              const target = unpaidConfirmOrder;
              setUnpaidConfirmOrder(null);
              setPayOrder(target);
            }}
          />
          <Button
            title="Serve Food Now (Collect Payment Later)"
            variant="secondary"
            icon="arrow-right"
            style={{minHeight:48,borderColor:colors.orange}}
            onPress={()=>void markServed(unpaidConfirmOrder)}
          />
        </View>
      </Sheet>
    )}

    <QuickPaySheet order={payOrder} visible={Boolean(payOrder)} onClose={()=>setPayOrder(null)} onPay={handleQuickPay} busy={Boolean(busy)}/>
  </ScrollView>;
}

export function TicketCard({order:o,onPress,onOpenPay,service='all',position,onAdvance,busy=false,disabled=false}:{order:Order;onPress:()=>void;onOpenPay?:()=>void;service?:ServiceFilter;position?:number;onAdvance?:()=>void;busy?:boolean;disabled?:boolean}){
  const isPaid = o.collected >= o.total;
  const isServed = o.status === 'completed';
  const due = Math.max(0, o.total - o.collected);

  return <View style={[s.ticket, isServed && !isPaid && {borderColor:'#6E3C22',backgroundColor:'#1B1817'}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ticket ${ticket(o.sequence)}`} onPress={onPress} style={{gap:10}}>
      <View style={u.between}>
        <View style={u.row}>
          <Text style={s.number}>{ticket(o.sequence)}</Text>
          <Badge status={o.status}/>
          {isServed && !isPaid && (
            <View style={{backgroundColor:'#4D2111',paddingHorizontal:8,paddingVertical:3,borderRadius:6}}>
              <Text style={{color:'#FF9B70',fontSize:9,fontWeight:'800'}}>SERVED · DUE</Text>
            </View>
          )}
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={s.amount}>{money(o.total)}</Text>
          {!isPaid && <Text style={{fontSize:11,fontWeight:'700',color:'#FF8D5B'}}>{money(due)} due</Text>}
        </View>
      </View>
      <Text style={u.tiny}>{position?`Queue ${position} · `:''}{new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</Text>
      <View style={s.items}>
        {o.items.filter(i=>service==='all'||i.serviceType===service).map(i=><View key={i.id} style={{gap:4}}>
          <View style={[u.between,{alignItems:'flex-start'}]}>
            <Text style={s.itemName}>{preparationName(i)}{i.pieces?` ${i.pieces}pc`:''}{'\n'}<Text style={s.service}>{serviceName(i.serviceType)}</Text></Text>
            <Text style={s.qty}>× {i.quantity}</Text>
          </View>
          {Boolean(i.note) && <Text style={s.itemInstruction}>{i.note}</Text>}
        </View>)}
      </View>
      {Boolean(o.note) && <View style={s.note}><Icon name="edit-3" size={14} color="#FFB285"/><Text style={s.noteText}>{o.note}</Text></View>}
    </Pressable>
    <View style={u.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Payment details for ${ticket(o.sequence)}`} onPress={onOpenPay ?? onPress} style={[s.paid,{borderColor:isPaid?'#255341':'#695125',backgroundColor:isPaid?'#152D25':'#30291B'}]}>
        <Icon name={isPaid?'check-circle':'clock'} size={15} color={isPaid?colors.green:'#F5AD19'}/>
        <Text style={{fontSize:10,fontWeight:'700',color:isPaid?colors.green:'#F5AD19'}}>{isPaid?'PAID':o.collected?'PART PAID':'⚡ COLLECT DUE'}</Text>
      </Pressable>
      {onAdvance ? (
        <Button title="Mark served" icon="arrow-right" onPress={onAdvance} busy={busy} disabled={disabled&&!busy} style={{flex:1,backgroundColor:colors.orange,minHeight:46}}/>
      ) : !isPaid ? (
        <Button title={`⚡ Settle payment (${money(due)})`} icon="check" onPress={onOpenPay ?? onPress} busy={busy} disabled={disabled&&!busy} style={{flex:1,backgroundColor:colors.green,minHeight:46}}/>
      ) : (
        <Button title="View ticket" variant="secondary" icon="arrow-up-right" onPress={onPress} style={{flex:1}}/>
      )}
    </View>
  </View>;
}

const s=StyleSheet.create({
  active:{minWidth:55,padding:10,borderWidth:1,borderColor:'#A54B2E',backgroundColor:'#2C1D18',borderRadius:17,alignItems:'center',gap:3},
  activeNumber:{fontSize:23,fontWeight:'800',color:colors.yellow},
  activeLabel:{fontSize:8,letterSpacing:.5,color:colors.yellow},
  ticket:{padding:15,borderRadius:18,borderWidth:1,borderColor:colors.line,backgroundColor:colors.card,gap:13},
  number:{fontSize:25,fontWeight:'800',color:colors.ink},
  amount:{fontSize:20,fontWeight:'800',color:colors.green},
  items:{padding:12,borderRadius:12,backgroundColor:colors.raised,gap:12},
  itemName:{flex:1,fontSize:12,fontWeight:'600',lineHeight:18,color:colors.ink},
  service:{fontSize:10,fontWeight:'500',color:colors.muted},
  qty:{fontSize:12,fontWeight:'700',color:colors.muted},
  itemInstruction:{fontSize:11,lineHeight:17,color:'#FFB285'},
  note:{backgroundColor:'#30251E',padding:11,borderRadius:9,flexDirection:'row',gap:8,alignItems:'center'},
  noteText:{fontSize:12,lineHeight:18,color:'#FFB285',flex:1},
  paid:{minHeight:46,borderWidth:1,borderRadius:11,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:6},
  unpaidNoticeBanner:{backgroundColor:'#2C1C16',borderWidth:1,borderColor:'#75341D',borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:12},
  unpaidNoticeIcon:{width:32,height:32,borderRadius:10,backgroundColor:'#3D221A',alignItems:'center',justifyContent:'center'},
  unpaidNoticeTitle:{fontSize:12,fontWeight:'700',color:'#FF9B70'},
  unpaidNoticeDetail:{fontSize:11,color:colors.muted},
  warnIcon:{width:60,height:60,borderRadius:20,backgroundColor:'#331911',alignItems:'center',justifyContent:'center'}
});
