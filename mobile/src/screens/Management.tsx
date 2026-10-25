import React,{useState,useEffect,useMemo} from 'react';
import {View,Text,ScrollView,Image,Switch,Pressable,StyleSheet,Share,ActivityIndicator} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import {businessDate,money,calculateInsights,type MenuOption,type Snapshot,type Settings,type Order} from '../lib/domain';
import type {Repository} from '../lib/repository';
import {pickMenuPhoto} from '../lib/photoUpload';
import {uuid} from '../lib/id';
import {menuPhotos,menuPhoto} from '../lib/assets';
import {Sheet,Button,Field,Chip,Icon,ErrorBanner,SectionTitle,u,colors,Confirm} from '../components/ui';

type TimeframePreset = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export function Overview({snapshot:s,repo,onSelect,onHistory}:{snapshot:Snapshot;repo?:Repository;onSelect:(o:Order)=>void;onHistory:()=>void}){
  const [timeframe,setTimeframe]=useState<TimeframePreset>('today');
  const [historyOrders,setHistoryOrders]=useState<Order[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [typeFilter,setTypeFilter]=useState<'all'|'dine-in'|'takeaway'>('all');
  const [paymentFilter,setPaymentFilter]=useState<'all'|'paid'|'unpaid'|'cancelled'>('all');
  const [methodFilter,setMethodFilter]=useState<'all'|'cash'|'upi'>('all');
  const [selectedDay,setSelectedDay]=useState<string|null>(null);
  const [customFrom,setCustomFrom]=useState(s.businessDate);
  const [customTo,setCustomTo]=useState(s.businessDate);

  async function loadHistory(from?:string,to?:string){
    if(!repo)return;
    setLoading(true);
    setError('');
    try {
      const data = await repo.history(from,to);
      setHistoryOrders(data);
    } catch(e) {
      setError(e instanceof Error?e.message:'Could not load history for insights.');
    } finally {
      setLoading(false);
    }
  }

  function handlePreset(preset:TimeframePreset){
    setTimeframe(preset);
    setSelectedDay(null);
    if(preset==='today'){
      setHistoryOrders(null);
      return;
    }
    const today = s.businessDate;
    if(preset==='yesterday'){
      const d=new Date(today+'T12:00:00Z');
      d.setUTCDate(d.getUTCDate()-1);
      const y=d.toISOString().slice(0,10);
      void loadHistory(y,y);
    } else if(preset==='7days'){
      const d=new Date(today+'T12:00:00Z');
      d.setUTCDate(d.getUTCDate()-6);
      void loadHistory(d.toISOString().slice(0,10),today);
    } else if(preset==='30days'){
      const d=new Date(today+'T12:00:00Z');
      d.setUTCDate(d.getUTCDate()-29);
      void loadHistory(d.toISOString().slice(0,10),today);
    } else if(preset==='all'){
      void loadHistory('2020-01-01',today);
    } else if(preset==='custom'){
      void loadHistory(customFrom,customTo);
    }
  }

  const baseOrders = useMemo(()=>{
    if(timeframe==='today') return s.orders.filter(o=>o.businessDate===s.businessDate);
    return historyOrders ?? [];
  },[timeframe,s.orders,s.businessDate,historyOrders]);

  const filteredOrders = useMemo(()=>{
    return baseOrders.filter(o=>{
      if(selectedDay && o.businessDate !== selectedDay) return false;
      if(typeFilter !== 'all') {
        const match = typeFilter === 'dine-in'
          ? (o.type === 'dine-in' || o.items.some(i => (i.serviceType ?? o.type) === 'dine-in'))
          : (o.type === 'takeaway' || o.items.some(i => (i.serviceType ?? o.type) === 'takeaway'));
        if(!match) return false;
      }
      if(methodFilter !== 'all' && o.method !== methodFilter) return false;
      if(paymentFilter === 'paid') return o.collected >= o.total && o.status !== 'cancelled';
      if(paymentFilter === 'unpaid') return o.collected < o.total && o.status !== 'cancelled';
      if(paymentFilter === 'cancelled') return o.status === 'cancelled';
      return true;
    });
  },[baseOrders,selectedDay,typeFilter,methodFilter,paymentFilter]);

  const insights = useMemo(()=>calculateInsights(filteredOrders),[filteredOrders]);
  const stats = insights.stats;

  const displayStats = useMemo(()=>{
    if(typeFilter === 'dine-in'){
      return {
        net: insights.dineInNetPaise,
        orders: insights.dineInCount,
        plates: insights.dineInPlates,
        aov: insights.dineInCount ? Math.round(insights.dineInNetPaise / insights.dineInCount) : 0,
        collected: insights.dineInCollectedPaise,
        unpaid: insights.dineInUnpaidPaise,
        cash: insights.dineInCashPaise,
        upi: insights.dineInUpiPaise
      };
    }
    if(typeFilter === 'takeaway'){
      return {
        net: insights.takeawayNetPaise,
        orders: insights.takeawayCount,
        plates: insights.takeawayPlates,
        aov: insights.takeawayCount ? Math.round(insights.takeawayNetPaise / insights.takeawayCount) : 0,
        collected: insights.takeawayCollectedPaise,
        unpaid: insights.takeawayUnpaidPaise,
        cash: insights.takeawayCashPaise,
        upi: insights.takeawayUpiPaise
      };
    }
    return {
      net: stats.net,
      orders: stats.orders,
      plates: stats.plates,
      aov: insights.aovPaise,
      collected: stats.collected,
      unpaid: stats.unpaid,
      cash: insights.cashPaise,
      upi: insights.upiPaise
    };
  },[typeFilter, insights, stats]);

  const activeLabel = useMemo(()=>{
    if(selectedDay) return `DAY: ${selectedDay}`;
    switch(timeframe){
      case 'today': return 'TODAY';
      case 'yesterday': return 'YESTERDAY';
      case '7days': return 'LAST 7 DAYS';
      case '30days': return 'LAST 30 DAYS';
      case 'all': return 'ALL TIME';
      case 'custom': return `${customFrom} → ${customTo}`;
    }
  },[timeframe,selectedDay,customFrom,customTo]);

  return (
    <ScrollView contentContainerStyle={[u.content,{padding:16,gap:16}]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <SectionTitle
        eyebrow="EVERYDAY & ALL-TIME ANALYTICS"
        title="Insights"
        right={
          <View style={{backgroundColor:'#173B2B',paddingHorizontal:12,paddingVertical:7,borderRadius:20}}>
            <Text style={{color:colors.green,fontSize:10,fontWeight:'700'}}>{activeLabel}</Text>
          </View>
        }
      />

      {/* Timeframe Scope Selector */}
      <View style={{gap:8}}>
        <Text style={u.eyebrow}>TIMEFRAME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
          <Chip label="Today" selected={timeframe==='today'} onPress={()=>handlePreset('today')}/>
          <Chip label="Yesterday" selected={timeframe==='yesterday'} onPress={()=>handlePreset('yesterday')}/>
          <Chip label="7 Days" selected={timeframe==='7days'} onPress={()=>handlePreset('7days')}/>
          <Chip label="30 Days" selected={timeframe==='30days'} onPress={()=>handlePreset('30days')}/>
          <Chip label="All Time" selected={timeframe==='all'} onPress={()=>handlePreset('all')}/>
          <Chip label="Custom" selected={timeframe==='custom'} onPress={()=>handlePreset('custom')}/>
        </ScrollView>
      </View>

      {/* Custom Range Inputs */}
      {timeframe==='custom' && (
        <View style={[u.card,{gap:10}]}>
          <View style={[u.row,{alignItems:'flex-start'}]}>
            <View style={{flex:1}}><Field label="From (YYYY-MM-DD)" value={customFrom} onChangeText={setCustomFrom} maxLength={10}/></View>
            <View style={{flex:1}}><Field label="To (YYYY-MM-DD)" value={customTo} onChangeText={setCustomTo} maxLength={10}/></View>
          </View>
          <Button title="Apply range" variant="secondary" icon="refresh-cw" busy={loading} onPress={()=>void loadHistory(customFrom,customTo)}/>
        </View>
      )}

      {/* Filterable Bar */}
      <View style={{gap:8}}>
        <Text style={u.eyebrow}>FILTERS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
          {(['all','dine-in','takeaway'] as const).map(f=>(
            <Chip key={f} label={f==='all'?'All dining':f==='dine-in'?'Dine-in':'Parcel'} selected={typeFilter===f} onPress={()=>setTypeFilter(f)}/>
          ))}
          {(['all','paid','unpaid','cancelled'] as const).map(p=>(
            <Chip key={p} label={p==='all'?'All payments':p==='paid'?'Paid':p==='unpaid'?'Unpaid due':'Cancelled'} selected={paymentFilter===p} onPress={()=>setPaymentFilter(p)}/>
          ))}
          {(['all','cash','upi'] as const).map(m=>(
            <Chip key={m} label={m==='all'?'Any method':m==='cash'?'Cash':'UPI / Online'} selected={methodFilter===m} onPress={()=>setMethodFilter(m)}/>
          ))}
        </ScrollView>
      </View>

      {selectedDay && (
        <View style={[u.row,{justifyContent:'space-between',backgroundColor:colors.card,padding:12,borderRadius:12,borderWidth:1,borderColor:colors.line}]}>
          <Text style={[u.body,{color:colors.yellow}]}>Viewing only: {selectedDay}</Text>
          <Button title="Show all days" variant="secondary" icon="x" onPress={()=>setSelectedDay(null)}/>
        </View>
      )}

      {loading && (
        <View style={[u.card,{alignItems:'center',paddingVertical:24,gap:12}]}>
          <ActivityIndicator color={colors.green}/>
          <Text style={u.body}>Aggregating insights…</Text>
        </View>
      )}

      <ErrorBanner message={error}/>

      {/* Hero Metrics Grid */}
      <View style={m.metrics}>
        <View style={m.metric}>
          <Icon name="rupee" size={20} color={colors.green}/>
          <Text style={m.metricValue}>{money(displayStats.net)}</Text>
          <Text style={u.tiny}>{typeFilter==='dine-in'?'Dine-in Revenue':typeFilter==='takeaway'?'Parcel Revenue':'Net Revenue'}</Text>
        </View>
        <View style={m.metric}>
          <Icon name="file-text" size={20} color={colors.yellow}/>
          <Text style={m.metricValue}>{String(displayStats.orders)}</Text>
          <Text style={u.tiny}>{typeFilter==='dine-in'?'Dine-in Orders':typeFilter==='takeaway'?'Parcel Orders':'Total Orders'}</Text>
        </View>
        <View style={m.metric}>
          <Icon name="utensils" size={20} color="#6389F1"/>
          <Text style={m.metricValue}>{String(displayStats.plates)}</Text>
          <Text style={u.tiny}>{typeFilter==='dine-in'?'Dine-in Plates':typeFilter==='takeaway'?'Parcel Plates':'Plates Sold'}</Text>
        </View>
        <View style={m.metric}>
          <Icon name="coffee" size={20} color="#C488F2"/>
          <Text style={m.metricValue}>{money(displayStats.aov)}</Text>
          <Text style={u.tiny}>Average Order Value</Text>
        </View>
      </View>

      {/* Payment Settlement & Distribution Card */}
      <View style={u.card}>
        <Text style={u.eyebrow}>{typeFilter==='dine-in'?'DINE-IN PAYMENTS':typeFilter==='takeaway'?'PARCEL PAYMENTS':'PAYMENTS & COLLECTIONS'}</Text>
        <View style={u.between}>
          <Text style={u.body}>Collected revenue</Text>
          <Text style={[u.label,{color:colors.green}]}>{money(displayStats.collected)}</Text>
        </View>
        <View style={u.between}>
          <Text style={u.body}>Pending / Unpaid due</Text>
          <Text style={[u.label,{color:displayStats.unpaid>0?colors.orange:colors.green}]}>{money(displayStats.unpaid)}</Text>
        </View>
        <View style={u.between}>
          <Text style={u.body}>Cash collections</Text>
          <Text style={u.label}>{money(displayStats.cash)}</Text>
        </View>
        <View style={u.between}>
          <Text style={u.body}>UPI / Online collections</Text>
          <Text style={u.label}>{money(displayStats.upi)}</Text>
        </View>
        <View style={u.between}>
          <Text style={u.body}>Completed tickets</Text>
          <Text style={u.label}>{stats.completed}</Text>
        </View>
        {stats.cancelled > 0 && (
          <View style={u.between}>
            <Text style={u.body}>Cancelled tickets</Text>
            <Text style={[u.label,{color:colors.red}]}>{stats.cancelled}</Text>
          </View>
        )}
      </View>

      {/* Dine-in vs Parcel Payment & Revenue Distribution */}
      <View style={u.card}>
        <Text style={u.eyebrow}>DINE-IN VS PARCEL DISTRIBUTION</Text>

        {/* Dine-in Box */}
        <View style={{backgroundColor:'#192231',padding:14,borderRadius:12,borderLeftWidth:4,borderLeftColor:'#82ABFF',gap:8}}>
          <View style={u.between}>
            <View style={u.row}>
              <Icon name="utensils" size={17} color="#82ABFF"/>
              <Text style={[u.label,{color:'#82ABFF'}]}>Dine-in</Text>
            </View>
            <Text style={[u.label,{color:colors.ink}]}>{money(insights.dineInNetPaise)}</Text>
          </View>
          <View style={u.between}>
            <Text style={u.tiny}>Collected (Paid)</Text>
            <Text style={[u.tiny,{color:colors.green,fontWeight:'700'}]}>{money(insights.dineInCollectedPaise)}</Text>
          </View>
          {insights.dineInUnpaidPaise > 0 && (
            <View style={u.between}>
              <Text style={u.tiny}>Pending due</Text>
              <Text style={[u.tiny,{color:colors.orange,fontWeight:'700'}]}>{money(insights.dineInUnpaidPaise)}</Text>
            </View>
          )}
          <View style={u.between}>
            <Text style={u.tiny}>Collections</Text>
            <Text style={u.tiny}>Cash {money(insights.dineInCashPaise)} · UPI {money(insights.dineInUpiPaise)}</Text>
          </View>
          <View style={u.between}>
            <Text style={u.tiny}>Volume</Text>
            <Text style={u.tiny}>{insights.dineInCount} orders · {insights.dineInPlates} plates ({stats.plates?Math.round((insights.dineInPlates/stats.plates)*100):0}%)</Text>
          </View>
        </View>

        {/* Parcel Box */}
        <View style={{backgroundColor:'#2B1F1B',padding:14,borderRadius:12,borderLeftWidth:4,borderLeftColor:'#FF9B70',gap:8,marginTop:10}}>
          <View style={u.between}>
            <View style={u.row}>
              <Icon name="package" size={17} color="#FF9B70"/>
              <Text style={[u.label,{color:'#FF9B70'}]}>Parcel / Takeaway</Text>
            </View>
            <Text style={[u.label,{color:colors.ink}]}>{money(insights.takeawayNetPaise)}</Text>
          </View>
          <View style={u.between}>
            <Text style={u.tiny}>Collected (Paid)</Text>
            <Text style={[u.tiny,{color:colors.green,fontWeight:'700'}]}>{money(insights.takeawayCollectedPaise)}</Text>
          </View>
          {insights.takeawayUnpaidPaise > 0 && (
            <View style={u.between}>
              <Text style={u.tiny}>Pending due</Text>
              <Text style={[u.tiny,{color:colors.orange,fontWeight:'700'}]}>{money(insights.takeawayUnpaidPaise)}</Text>
            </View>
          )}
          <View style={u.between}>
            <Text style={u.tiny}>Collections</Text>
            <Text style={u.tiny}>Cash {money(insights.takeawayCashPaise)} · UPI {money(insights.takeawayUpiPaise)}</Text>
          </View>
          <View style={u.between}>
            <Text style={u.tiny}>Volume</Text>
            <Text style={u.tiny}>{insights.takeawayCount} orders · {insights.takeawayPlates} plates ({stats.plates?Math.round((insights.takeawayPlates/stats.plates)*100):0}%)</Text>
          </View>
        </View>

        {insights.mixedCount > 0 && (
          <View style={[u.between,{marginTop:6}]}>
            <Text style={u.tiny}>Mixed orders (Dine-in + Parcel)</Text>
            <Text style={u.tiny}>{insights.mixedCount} tickets</Text>
          </View>
        )}
      </View>

      {/* Everyday Daily Breakdown */}
      {insights.dailyBreakdown.length > 0 && (
        <View style={u.card}>
          <View style={u.between}>
            <Text style={u.eyebrow}>EVERYDAY BREAKDOWN</Text>
            <Text style={u.tiny}>{insights.dailyBreakdown.length} days recorded</Text>
          </View>
          {insights.dailyBreakdown.map(d=>(
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={`Select day ${d.date}`}
              onPress={()=>setSelectedDay(selectedDay===d.date?null:d.date)}
              style={[u.card,{marginVertical:4,backgroundColor:selectedDay===d.date?'#1B271E':'#161920',borderColor:selectedDay===d.date?colors.green:colors.line}]}
            >
              <View style={u.between}>
                <View style={{gap:2}}>
                  <Text style={{fontSize:14,fontWeight:'700',color:colors.ink}}>{d.date}{d.date===s.businessDate?' · Today':''}</Text>
                  <Text style={u.tiny}>{d.ordersCount} orders · {d.platesCount} plates</Text>
                </View>
                <View style={{alignItems:'flex-end',gap:2}}>
                  <Text style={{fontSize:15,fontWeight:'800',color:colors.green}}>{money(d.netPaise)}</Text>
                  {d.unpaidPaise>0 && <Text style={{fontSize:10,color:colors.orange,fontWeight:'600'}}>{money(d.unpaidPaise)} due</Text>}
                </View>
              </View>
              {d.topItem && (
                <View style={[u.row,{paddingTop:6,borderTopWidth:1,borderColor:colors.line,marginTop:4}]}>
                  <Icon name="award" size={12} color={colors.yellow}/>
                  <Text style={[u.tiny,{flex:1,color:colors.muted}]}>Top seller: {d.topItem}</Text>
                  <Text style={{fontSize:10,color:selectedDay===d.date?colors.green:colors.muted,fontWeight:'600'}}>
                    {selectedDay===d.date?'Viewing day':'Filter day →'}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Top Selling Items Ranking */}
      {insights.topItems.length > 0 && (
        <View style={u.card}>
          <View style={u.between}>
            <Text style={u.eyebrow}>TOP SELLING MENU ITEMS</Text>
            <Text style={u.tiny}>{insights.topItems.length} products</Text>
          </View>
          {insights.topItems.slice(0,10).map((item,idx)=>(
            <View key={item.name+item.variant+item.portion} style={[u.between,{minHeight:48,borderTopWidth:idx===0?0:1,borderColor:colors.line,paddingVertical:6}]}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1}}>
                <View style={{width:24,height:24,borderRadius:12,backgroundColor:'#191C23',alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:11,fontWeight:'800',color:idx===0?colors.yellow:colors.muted}}>#{idx+1}</Text>
                </View>
                <View style={{flex:1,gap:2}}>
                  <Text style={u.label}>{item.name}</Text>
                  <Text style={u.tiny}>{item.variant} · {item.portion}</Text>
                </View>
              </View>
              <View style={{alignItems:'flex-end',gap:2}}>
                <Text style={{fontSize:13,fontWeight:'700',color:colors.ink}}>{item.quantity} plates</Text>
                <Text style={{fontSize:11,color:colors.green,fontWeight:'600'}}>{money(item.revenuePaise)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Filtered Tickets List */}
      <View style={u.card}>
        <View style={u.between}>
          <Text style={u.eyebrow}>FILTERED TICKETS</Text>
          <Text style={u.tiny}>{filteredOrders.length} tickets</Text>
        </View>
        {[...filteredOrders].sort((a,b)=>b.createdAt-a.createdAt).slice(0,12).map(o=>(
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ticket #${o.sequence}`}
            onPress={()=>onSelect(o)}
            style={[u.between,{minHeight:48,borderTopWidth:1,borderColor:colors.line}]}
          >
            <View style={{gap:2}}>
              <Text style={{fontSize:13,fontWeight:'700',color:colors.yellow}}>#{o.sequence} · {o.businessDate}</Text>
              <Text style={u.tiny}>{o.type==='dine-in'?'Dine-in':'Parcel'} · {o.items.length} items</Text>
            </View>
            <View style={{flex:1,paddingHorizontal:12}}>
              <Text style={[u.tiny,{color:o.status==='completed'?'#789B4D':o.status==='cancelled'?colors.red:colors.orange}]}>
                {o.status.toUpperCase()}
              </Text>
            </View>
            <View style={{alignItems:'flex-end',gap:2}}>
              <Text style={{fontSize:13,fontWeight:'700',color:colors.green}}>{money(o.total)}</Text>
              {o.collected < o.total && o.status !== 'cancelled' && (
                <Text style={{fontSize:9,color:colors.orange,fontWeight:'600'}}>{money(o.total-o.collected)} unpaid</Text>
              )}
            </View>
            <Icon name="chevron-right" size={15} color={colors.muted}/>
          </Pressable>
        ))}
        {!filteredOrders.length && !loading && (
          <Text style={[u.body,{textAlign:'center',paddingVertical:12}]}>No orders found matching the selected timeframe and filters.</Text>
        )}
      </View>

      <Button title="Open Order History & CSV Exports" icon="clock" variant="secondary" onPress={onHistory}/>

      <Text style={u.tiny}>
        Net sales and averages exclude cancelled tickets. All-time insights reflect every ticket preserved in your Turso database.
      </Text>
    </ScrollView>
  );
}
export function MenuManager({repo,menu,onSaved}:{repo:Repository;menu:MenuOption[];onSaved:()=>Promise<void>}){const [edit,setEdit]=useState<MenuOption|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[priceText,setPriceText]=useState('0'),[photoBusy,setPhotoBusy]=useState(false);useEffect(()=>{if(edit)setPriceText(String(edit.price/100));},[edit?.id]);async function upload(){if(photoBusy||busy)return;setPhotoBusy(true);setError('');try{const image=await pickMenuPhoto();if(image){const uploaded=await repo.uploadPhoto(image,edit?.name||'Menu photo');setEdit(current=>current?{...current,...uploaded}:null);}}catch(e){setError(e instanceof Error?e.message:'Could not open the photo library.');}finally{setPhotoBusy(false);}}
 async function save(o:MenuOption){if(busy||photoBusy)return;if(edit?.id===o.id)o={...o,price:Math.round(Number(priceText)*100)};if(!o.name.trim()||!o.variant.trim()||!o.portion.trim()||!o.category.trim()||!Number.isInteger(o.price)||o.price<0){setError('Complete every required field and enter a valid price.');return;}setBusy(true);setError('');try{await repo.saveMenu(o);await onSaved();setEdit(null);}catch(e){setError(e instanceof Error?e.message:'Could not save menu.');}finally{setBusy(false);}}
 return <ScrollView contentContainerStyle={u.content} keyboardShouldPersistTaps="handled"><SectionTitle eyebrow="KEEP YOUR MENU FRESH" title="Menu & pricing" description="Add your own items, upload photos and set prices. Kitchen cards appear automatically."/><Button title="Add new item" icon="plus" onPress={()=>{setError('');setEdit({id:uuid(),productId:uuid(),name:'',variant:'Classic',portion:'Regular',pieces:null,price:0,available:true,category:'Momos',sort:Math.max(0,...menu.map(o=>o.sort))+1,image:'steam'});}}/><Field label="Search menu" placeholder="Item or preparation" value={search} onChangeText={setSearch}/>{menu.filter(o=>`${o.name} ${o.variant}`.toLowerCase().includes(search.toLowerCase())).map(o=><View key={o.id} style={u.card}><View style={u.row}><Image source={menuPhoto(o.image)} style={{width:58,height:58,borderRadius:12}}/><View style={{flex:1,gap:5}}><Text style={u.label}>{o.name}</Text><Text style={u.tiny}>{o.variant} · {o.portion}{o.pieces?` · ${o.pieces} pcs`:''}</Text><Text style={{fontSize:18,fontWeight:'800',color:colors.ink}}>{money(o.price)}</Text></View><Switch accessibilityLabel={`Available: ${o.name} ${o.variant} ${o.portion}`} disabled={busy} value={o.available} onValueChange={available=>void save({...o,available})} trackColor={{false:'#D9DFCF',true:'#8CA863'}} thumbColor="white"/></View><View style={u.between}><Text style={[u.tiny,{color:o.available?'#77985A':'#B28A70'}]}>{o.available?'Available to order · Kitchen card added automatically':'Sold out'}</Text><Button title="Edit option" variant="secondary" icon="edit-2" onPress={()=>{setEdit({...o});setError('');}}/></View></View>)}<ErrorBanner message={!edit?error:''}/>{edit&&<Sheet visible full title={menu.some(o=>o.id===edit.id)?'Edit menu option':'New menu item'} onClose={()=>{if(!busy&&!photoBusy)setEdit(null);}} footer={<Button title="Save menu option" busy={busy} disabled={photoBusy} icon="save" onPress={()=>void save(edit)}/>}><Text style={u.tiny}>Add a variation to an existing product or start a new one.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}><Chip label="New product" selected={!menu.some(o=>o.productId===edit.productId)} onPress={()=>setEdit({...edit,productId:uuid()})}/>{[...new Map(menu.map(o=>[o.productId,o])).values()].map(o=><Chip key={o.productId} label={o.name} selected={edit.productId===o.productId} onPress={()=>setEdit({...edit,productId:o.productId,name:o.name,category:o.category,image:o.image})}/>)}</ScrollView><Field label="Product name" value={edit.name} onChangeText={name=>setEdit({...edit,name})} maxLength={80}/><Field label="Category" value={edit.category} onChangeText={category=>setEdit({...edit,category})} maxLength={40}/><Field label="Preparation / variation" value={edit.variant} onChangeText={variant=>setEdit({...edit,variant})} maxLength={80}/><Field label="Portion name" value={edit.portion} onChangeText={portion=>setEdit({...edit,portion})} maxLength={50}/><View style={[u.row,{alignItems:'flex-start'}]}><View style={{flex:1}}><Field label="Price (₹)" keyboardType="decimal-pad" value={priceText} onChangeText={setPriceText}/></View><View style={{flex:1}}><Field label="Pieces (optional)" keyboardType="number-pad" value={edit.pieces===null?'':String(edit.pieces)} onChangeText={value=>setEdit({...edit,pieces:value?Number(value):null})}/></View></View><Field label="Display order" keyboardType="number-pad" value={String(edit.sort)} onChangeText={value=>setEdit({...edit,sort:Number(value)})}/><Text style={u.label}>Menu photo</Text><Image source={menuPhoto(edit.image)} accessibilityLabel="Selected menu photo preview" style={{width:'100%',height:175,borderRadius:14}} resizeMode="cover"/><Button title={edit.image.startsWith('data:')?'Replace uploaded photo':'Upload photo'} icon="plus" variant="secondary" busy={photoBusy} disabled={busy} onPress={()=>void upload()}/><Text style={u.tiny}>Connect your owner Google Drive in Account & Drive first. Uploaded photos stay private in Drive, with an optimized copy for the menu.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>{Object.entries(menuPhotos).map(([key,photo])=><Pressable key={key} accessibilityRole="button" accessibilityLabel={'Use '+key+' photo'} accessibilityState={{selected:edit.image===key}} disabled={photoBusy||busy} onPress={()=>setEdit({...edit,image:key,driveFileId:undefined})} style={{borderWidth:2,borderColor:edit.image===key?'#C5B15B':'transparent',borderRadius:12,overflow:'hidden'}}><Image source={photo} style={{width:78,height:65}}/><Text style={{fontSize:8,padding:5,color:'#A5ABB7'}}>{key}</Text></Pressable>)}</ScrollView><Text style={u.tiny}>Saved tickets keep their original product names and prices.</Text><ErrorBanner message={error}/></Sheet>}</ScrollView>;
}
export function SettingsScreen({repo,snapshot,onSaved,onKitchen}:{repo:Repository;snapshot:Snapshot;onSaved:()=>Promise<void>;onKitchen:(token:string)=>void}){const [settings,setSettings]=useState<Settings>(snapshot.settings),[busy,setBusy]=useState(false),[clearing,setClearing]=useState(false),[confirmClear,setConfirmClear]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[link,setLink]=useState<{token:string;url:string;qr?:string}|null>(null),[confirm,setConfirm]=useState(false);async function clearAllOrders(){setClearing(true);setError('');try{await repo.resetData();await AsyncStorage.removeItem('moped-native-draft:'+repo.origin);await onSaved();setConfirmClear(false);setNotice('All test orders cleared. Queue reset to 0.');}catch(e){setError(e instanceof Error?e.message:'Could not clear orders.');}finally{setClearing(false);}}
 async function save(){setBusy(true);setError('');try{await repo.saveSettings(settings);await onSaved();setNotice('Stall settings saved.');}catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}
 async function generate(){setBusy(true);setError('');try{const r=await repo.rotate();setLink({token:r.token,url:repo.origin+r.path,qr:r.qrDataUrl});setConfirm(false);await onSaved();}catch(e){setError(e instanceof Error?e.message:'Could not create kitchen link.');}finally{setBusy(false);}}
 return <ScrollView contentContainerStyle={u.content} keyboardShouldPersistTaps="handled"><SectionTitle eyebrow="THE DETAILS THAT MATTER" title="Stall settings" description="Keep the counter and kitchen connected."/><View style={u.card}><Field label="Stall name" value={settings.name} maxLength={80} onChangeText={name=>setSettings({...settings,name})}/><Field label="Business timezone" value={settings.timezone} onChangeText={timezone=>setSettings({...settings,timezone})} help="Asia/Kolkata by default. Future ticket dates use this timezone."/><View style={[u.row,{alignItems:'flex-start'}]}><View style={{flex:1}}><Field label="Opens at (HH:MM)" value={settings.open} onChangeText={open=>setSettings({...settings,open})}/></View><View style={{flex:1}}><Field label="Closes at (HH:MM)" value={settings.close} onChangeText={close=>setSettings({...settings,close})}/></View></View><Button title="Save stall details" busy={busy} onPress={()=>void save()} icon="save"/>{notice&&<Text style={[u.body,{color:colors.green}]}>{notice}</Text>}</View><View style={u.card}><View style={u.between}><Text style={m.panelTitle}>Kitchen display</Text><Icon name="monitor" color="#819B5E" size={23}/></View><Text style={u.body}>A private, read-only queue for workers. No account or sign-in needed.</Text>{confirm?<><Text style={[u.body,{color:colors.orange}]}>The old link will stop receiving new updates. Open the new link on every kitchen device.</Text><Button title="Replace kitchen link" busy={busy} variant="danger" onPress={()=>void generate()}/><Button title="Keep existing link" variant="secondary" onPress={()=>setConfirm(false)}/></>:<Button title={snapshot.displayConfigured?'Generate replacement link':'Create kitchen link'} variant="secondary" icon="refresh-cw" disabled={busy} onPress={()=>snapshot.displayConfigured?setConfirm(true):void generate()}/>} {link&&<View style={{gap:15}}>{link.qr&&<Image source={{uri:link.qr}} style={{width:240,height:240,alignSelf:'center',backgroundColor:colors.card}} resizeMode="contain" accessibilityLabel="Kitchen display link QR"/>}<Text selectable style={[u.tiny,{backgroundColor:'#191C23',padding:14,borderRadius:10}]}>{link.url}</Text><Button title="Open kitchen display" icon="monitor" onPress={()=>onKitchen(link.token)}/>{<><Button title="Copy kitchen link" variant="secondary" icon="copy" onPress={()=>void Clipboard.setStringAsync(link.url).then(()=>setNotice('Kitchen link copied.'))}/><Button title="Share kitchen link" variant="secondary" icon="share" onPress={()=>void Share.share({message:link.url})}/></>}<Text style={u.tiny}>Copy the link now. Only its hash is stored on the server; generate a replacement if it is lost.</Text></View>}</View><View style={[u.card,{borderColor:'#633626'}]}><View style={u.between}><Text style={[m.panelTitle,{color:colors.orange}]}>Testing · Clear Orders</Text><Icon name='refresh-cw' color={colors.orange} size={20}/></View><Text style={u.body}>Clears all active orders, kitchen queue tickets, daily numbers, and history. Your menu, prices, and account stay intact.</Text><Button title='Clear all test orders' variant='danger' icon='refresh-cw' disabled={busy||clearing} busy={clearing} onPress={()=>setConfirmClear(true)}/></View>{confirmClear&&<Confirm title='Clear all test orders?' message='This will delete all current tickets and reset the queue to 0 for testing. Your menu items will NOT be affected.' busy={clearing} onConfirm={()=>void clearAllOrders()} onCancel={()=>setConfirmClear(false)}/>}<View style={u.card}><Text style={m.panelTitle}>Connection</Text><Text style={u.body}>{repo.origin}</Text><Text style={u.tiny}>{snapshot.realtimeConfigured?'Ably live updates + reconciliation enabled.':'Automatic refresh enabled. Configure Ably for instant updates.'}</Text></View><ErrorBanner message={error}/></ScrollView>;
}
const m=StyleSheet.create({metrics:{flexDirection:'row',flexWrap:'wrap',gap:12},metric:{flexGrow:1,width:'47%',backgroundColor:colors.card,borderWidth:1,borderColor:colors.line,borderRadius:17,padding:18,gap:13},metricValue:{fontSize:26,fontWeight:'800',letterSpacing:-1,color:colors.ink},panelTitle:{fontSize:19,fontWeight:'700',letterSpacing:-.5,color:colors.ink}});

export function AccountScreen({repo,onDeleted}:{repo:Repository;onDeleted:()=>void}){
 const [account,setAccount]=useState<{email:string;driveConnected:boolean}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[deleting,setDeleting]=useState(false),[confirmation,setConfirmation]=useState('');
 async function load(){try{setAccount(await repo.account());}catch(e){setError(e instanceof Error?e.message:'Could not load account.');}}
 useEffect(()=>{void load();},[repo]);
 async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();await load();}catch(e){setError(e instanceof Error?e.message:'Could not complete this action.');}finally{setBusy(false);}}
 async function remove(){if(busy||confirmation!=='DELETE')return;setBusy(true);setError('');try{await repo.deleteAccount(confirmation);await AsyncStorage.multiRemove(['moped-native-draft:'+repo.origin,'moped-oauth-pending-v1']);onDeleted();}catch(e){setError(e instanceof Error?e.message:'Could not delete account.');}finally{setBusy(false);}}
 return <ScrollView contentContainerStyle={[u.content,{paddingBottom:32}]} keyboardShouldPersistTaps="handled"><SectionTitle eyebrow="PRIVATE STALL WORKSPACE" title="Account & Drive" description="One Google account for the entire Orders app."/><View style={u.card}><Icon name="lock" color={colors.yellow}/><Text style={u.label}>{account?.email??'Loading owner account…'}</Text><Text style={u.body}>Other Google accounts are rejected by the server. Kitchen uses its separate viewing link and never signs in.</Text></View><View style={u.card}><Text style={u.label}>Google Drive menu photos</Text><Text style={u.body}>{account?.driveConnected?'Connected to the owner account. Your uploaded photos remain private.':'Connect the same owner account to upload menu images to your Drive.'}</Text><Text style={u.tiny}>The app requests access only to files it creates or you explicitly share with it. It does not make photos public.</Text><Button title={account?.driveConnected?'Reconnect Google Drive':'Connect Google Drive'} disabled={!account} busy={busy} icon="arrow-up-right" onPress={()=>void action(()=>repo.connectDrive())}/>{account?.driveConnected&&<Button title="Disconnect Drive" variant="secondary" disabled={busy} onPress={()=>void action(()=>repo.disconnectDrive())}/>}</View><View style={[u.card,{borderColor:'#6E3434'}]}><Text style={[u.label,{color:colors.red}]}>Delete app account</Text><Text style={u.body}>Deletes the app account, orders, menu, payment records and stored Google connection. Every session and kitchen viewing link is revoked. Photos already in your Drive remain there. This does not delete your Google account.</Text><Text style={u.tiny}>Sign in with Google again within five minutes before deleting. The app stays locked after deletion until the deployment owner explicitly resets it.</Text><Button title="Delete account" variant="danger" disabled={!account||busy} onPress={()=>setDeleting(true)}/></View><ErrorBanner message={error}/>{deleting&&<Sheet visible title="Delete this app account?" onClose={()=>{if(!busy)setDeleting(false);}} footer={<Button title="Permanently delete account" variant="danger" disabled={confirmation!=='DELETE'} busy={busy} onPress={()=>void remove()}/>}><Text style={u.body}>This permanently removes your stall data from this app. You cannot undo it here.</Text><Field label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" editable={!busy}/><Button title="Keep my account" variant="secondary" disabled={busy} onPress={()=>setDeleting(false)}/></Sheet>}</ScrollView>;
}
