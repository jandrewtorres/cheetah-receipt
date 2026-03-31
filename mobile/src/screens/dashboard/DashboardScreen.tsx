// mobile/src/screens/dashboard/DashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, TextInput, FlatList,
} from 'react-native';
import { supabase, api } from '../../services/supabase';
import { format } from 'date-fns';

const C = { bg:'#070c16', surface:'#0f172a', card:'#111827', border:'#1e293b', brand:'#f59e0b', text:'#f1f5f9', muted:'#64748b', green:'#4ade80', red:'#f87171', blue:'#60a5fa' };

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }: any) {
  const [profile,  setProfile]  = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [orders,   setOrders]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: prof }, { data: lst }, { data: ord }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('receipts').select('*').eq('seller_id', user.id).order('created_at',{ascending:false}).limit(10),
      supabase.from('orders').select('*, receipts(store_name)').eq('seller_id', user.id).order('created_at',{ascending:false}).limit(10),
    ]);
    setProfile(prof); setListings(lst??[]); setOrders(ord??[]);
    setLoading(false); setRefresh(false);
  };

  useEffect(() => { load(); }, []);

  const totalEarned = orders.filter(o=>['paid','completed'].includes(o.status)).reduce((s,o)=>s+(o.seller_payout??0),0);

  if (loading) return <View style={[s.container,s.center]}><ActivityIndicator color={C.brand} size="large"/></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refresh} onRefresh={()=>{setRefresh(true);load();}} tintColor={C.brand}/>}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📊 Dashboard</Text>
        <Text style={s.headerSub}>Welcome, {profile?.full_name??'Seller'}</Text>
      </View>
      <View style={{padding:16,gap:12}}>
        {!profile?.stripe_account_id && (
          <TouchableOpacity style={s.banner} onPress={()=>navigation.navigate('Settings')}>
            <Text style={{color:C.brand,fontWeight:'800'}}>⚡ Connect bank to get paid →</Text>
          </TouchableOpacity>
        )}
        <View style={{flexDirection:'row',gap:8}}>
          {[
            {label:'Earned',   value:`$${totalEarned.toFixed(2)}`, color:C.green},
            {label:'Listings', value:listings.length,               color:C.blue},
            {label:'Sales',    value:orders.filter(o=>o.status!=='pending').length, color:C.brand},
            {label:'Rating',   value:`${profile?.seller_rating?.toFixed(1)??'0'}★`, color:'#fbbf24'},
          ].map(({label,value,color})=>(
            <View key={label} style={[s.stat,{flex:1}]}>
              <Text style={[s.statVal,{color}]}>{value}</Text>
              <Text style={s.statLbl}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={s.sectionTitle}>Recent Listings</Text>
        {listings.slice(0,5).map(l=>(
          <View key={l.id} style={s.card}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
              <Text style={s.cardStore}>{l.store_name}</Text>
              <Text style={{color:l.status==='active'?C.green:l.status==='sold'?C.blue:C.brand,fontWeight:'700',fontSize:13}}>{l.status}</Text>
            </View>
            <Text style={s.cardMeta}>${l.listing_price?.toFixed(2)} listing · ${l.total?.toFixed(2)} receipt value</Text>
          </View>
        ))}
        {listings.length===0 && <Text style={{color:C.muted,textAlign:'center',padding:20}}>No listings yet. Sell your first receipt!</Text>}
      </View>
    </ScrollView>
  );
}

// ── Orders Screen ─────────────────────────────────────────────────────────────
export function OrdersScreen({ navigation }: any) {
  const [orders, setOrders]   = useState<any[]>([]);
  const [loading,setLoading]  = useState(true);
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if (!user) return;
      supabase.from('orders').select('*, receipt:receipts(store_name,total), seller:users!orders_seller_id_fkey(full_name)')
        .eq('buyer_id',user.id).order('created_at',{ascending:false})
        .then(({data})=>{setOrders(data??[]);setLoading(false);});
    });
  },[]);
  if (loading) return <View style={[s.container,s.center]}><ActivityIndicator color={C.brand} size="large"/></View>;
  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>📦 My Purchases</Text></View>
      <View style={{padding:16,gap:10}}>
        {orders.length===0
          ? <Text style={{color:C.muted,textAlign:'center',padding:40}}>No purchases yet</Text>
          : orders.map(o=>(
            <TouchableOpacity key={o.id} style={s.card} onPress={()=>navigation.navigate('OrderDetail',{order:o})} activeOpacity={0.85}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                <Text style={s.cardStore}>{o.receipt?.store_name}</Text>
                <Text style={{color:['paid','completed'].includes(o.status)?C.green:C.brand,fontWeight:'700',fontSize:13}}>{o.status}</Text>
              </View>
              <Text style={s.cardMeta}>${o.amount?.toFixed(2)} · {format(new Date(o.created_at),'MMM d, yyyy')}</Text>
              {o.status==='disputed'&&<Text style={{color:C.red,fontSize:12,marginTop:4,fontWeight:'600'}}>⚠️ Dispute open</Text>}
            </TouchableOpacity>
          ))
        }
      </View>
    </ScrollView>
  );
}

// ── Order Detail ──────────────────────────────────────────────────────────────
export function OrderDetailScreen({ route, navigation }: any) {
  const { order } = route.params;
  const [items,   setItems]   = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);
  const [rating,  setRating]  = useState(0);
  const isPaid = ['paid','delivered','completed'].includes(order.status);

  useEffect(()=>{
    if (!isPaid) return;
    supabase.from('receipts').select('*').eq('id',order.receipt_id).single().then(({data})=>setReceipt(data));
    supabase.from('receipt_items').select('*').eq('receipt_id',order.receipt_id).then(({data})=>setItems(data??[]));
  },[]);

  const submitRating = async (r: number) => {
    setRating(r);
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) return;
    const { data:{session} } = await supabase.auth.getSession();
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/orders/${order.id}/rate`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token}`},
      body:JSON.stringify({rating:r}),
    });
    Alert.alert('Thanks!','Rating submitted.');
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{padding:16,gap:12}}>
      <View style={s.card}>
        <Text style={s.cardStore}>{receipt?.store_name??order.receipt?.store_name??'Receipt'}</Text>
        <Text style={s.cardMeta}>Order #{order.id.slice(0,8).toUpperCase()}</Text>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}>
          <Text style={{color:C.muted}}>Paid</Text>
          <Text style={{color:C.brand,fontWeight:'800'}}>${order.amount?.toFixed(2)}</Text>
        </View>
      </View>

      {isPaid && receipt && (
        <>
          <Text style={s.sectionTitle}>Receipt Details</Text>
          {[
            ['Store',receipt.store_name],
            ['Location',[receipt.store_city,receipt.store_state].filter(Boolean).join(', ')||'—'],
            ['Purchase Date',receipt.purchase_date||'—'],
            ['Return By',receipt.return_by_date||'No policy'],
            ['Payment',receipt.payment_method||'—'],
          ].map(([l,v])=>(
            <View key={l} style={[s.card,{flexDirection:'row',justifyContent:'space-between',paddingVertical:10}]}>
              <Text style={{color:C.muted,fontSize:13}}>{l}</Text>
              <Text style={{color:C.text,fontWeight:'600',fontSize:13,maxWidth:'60%',textAlign:'right'}}>{v}</Text>
            </View>
          ))}
          <Text style={s.sectionTitle}>Items & Barcodes ({items.length})</Text>
          {items.map(item=>(
            <View key={item.id} style={[s.card,{paddingVertical:10}]}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                <Text style={{color:C.text,fontWeight:'600',flex:1,marginRight:8}}>{item.name}</Text>
                <Text style={{color:C.text,fontWeight:'700'}}>${item.total_price?.toFixed(2)}</Text>
              </View>
              <Text style={{color:C.brand,fontSize:11,fontFamily:'monospace'}}>
                UPC: {item.upc||item.barcode||'N/A'}
              </Text>
            </View>
          ))}
        </>
      )}

      {isPaid && !order.buyer_rated && (
        <View style={[s.card,{gap:10}]}>
          <Text style={{color:C.text,fontWeight:'700'}}>Rate this seller</Text>
          <View style={{flexDirection:'row',gap:6}}>
            {[1,2,3,4,5].map(n=>(
              <TouchableOpacity key={n} onPress={()=>submitRating(n)}>
                <Text style={{fontSize:32,color:n<=rating?C.brand:C.muted}}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {isPaid && (
        <TouchableOpacity style={[s.card,{borderColor:'#f87171',alignItems:'center',padding:14}]}
          onPress={()=>navigation.navigate('Dispute',{orderId:order.id})}>
          <Text style={{color:C.red,fontWeight:'700'}}>⚠️ Open a Dispute</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Dispute Screen ────────────────────────────────────────────────────────────
const REASONS = [
  {value:'receipt_not_as_described',label:'Not as described'},
  {value:'receipt_already_used',    label:'Already used'},
  {value:'duplicate_receipt',       label:'Duplicate receipt'},
  {value:'missing_items',           label:'Missing items'},
  {value:'fraudulent_receipt',      label:'Fraudulent receipt'},
  {value:'other',                   label:'Other'},
];
export function DisputeScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const [reason,      setReason]      = useState('receipt_not_as_described');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const submit = async () => {
    if (description.length<20) { Alert.alert('Too short','Please provide at least 20 characters.'); return; }
    setSubmitting(true);
    try {
      const json = await api.openDispute(orderId, reason, description);
      if (json.data) {
        Alert.alert('Dispute Opened','Our team will review within 24 hours.',[{text:'OK',onPress:()=>navigation.goBack()}]);
      } else {
        Alert.alert('Error', json.error??'Failed to open dispute.');
      }
    } catch { Alert.alert('Error','Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>⚠️ Open Dispute</Text>
      <Text style={s.subtitle}>Our team responds within 24 hours</Text>
      <Text style={s.label}>Reason</Text>
      {REASONS.map(r=>(
        <TouchableOpacity key={r.value} onPress={()=>setReason(r.value)}
          style={[s.card,{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8,borderColor:reason===r.value?C.brand:C.border}]}>
          <View style={{width:18,height:18,borderRadius:9,borderWidth:2,borderColor:reason===r.value?C.brand:C.muted,backgroundColor:reason===r.value?C.brand:'transparent'}}/>
          <Text style={{color:C.text,fontSize:14}}>{r.label}</Text>
        </TouchableOpacity>
      ))}
      <Text style={[s.label,{marginTop:12}]}>Description (min 20 chars)</Text>
      <TextInput value={description} onChangeText={setDescription} multiline numberOfLines={6}
        style={[s.input,{textAlignVertical:'top',minHeight:120,fontSize:14}]}
        placeholder="Describe the issue in detail..." placeholderTextColor={C.muted}/>
      <Text style={{color:C.muted,fontSize:11,marginBottom:12,textAlign:'right'}}>{description.length} chars</Text>
      <TouchableOpacity style={[s.btnPrimary,{backgroundColor:'#ef4444'}]} onPress={submit} disabled={submitting}>
        {submitting?<ActivityIndicator color="#fff"/>:<Text style={[s.btnText,{color:'#fff'}]}>Open Dispute</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Notifications Screen ──────────────────────────────────────────────────────
const NOTIF_EMOJI: Record<string,string> = {
  sale:'💰', purchase:'✅', dispute_opened:'⚠️', dispute_resolved:'⚖️',
  payout:'💸', listing_approved:'✅', listing_flagged:'🚩', system:'🔔',
};
export function NotificationsScreen() {
  const [notifs,  setNotifs]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if (!user) return;
      supabase.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(60)
        .then(({data})=>{setNotifs(data??[]);setLoading(false);});
      supabase.from('notifications').update({read:true}).eq('user_id',user.id).eq('read',false);
    });
  },[]);
  if (loading) return <View style={[s.container,s.center]}><ActivityIndicator color={C.brand} size="large"/></View>;
  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>🔔 Notifications</Text></View>
      <View style={{padding:16,gap:8}}>
        {notifs.length===0
          ? <Text style={{color:C.muted,textAlign:'center',padding:40}}>No notifications yet</Text>
          : notifs.map(n=>(
            <View key={n.id} style={[s.card,!n.read&&{borderColor:'#f59e0b44'}]}>
              <View style={{flexDirection:'row',gap:10,alignItems:'flex-start'}}>
                <Text style={{fontSize:20}}>{NOTIF_EMOJI[n.type]??'🔔'}</Text>
                <View style={{flex:1}}>
                  <Text style={[s.cardStore,{fontSize:14}]}>{n.title}</Text>
                  <Text style={s.cardMeta}>{n.body}</Text>
                  <Text style={{color:C.muted,fontSize:11,marginTop:4}}>{format(new Date(n.created_at),'MMM d, h:mm a')}</Text>
                </View>
                {!n.read&&<View style={{width:8,height:8,borderRadius:4,backgroundColor:C.brand,marginTop:4}}/>}
              </View>
            </View>
          ))
        }
      </View>
    </ScrollView>
  );
}

// ── Settings Screen ───────────────────────────────────────────────────────────
export function SettingsScreen() {
  const [profile, setProfile] = useState<any>(null);
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if (!user) return;
      supabase.from('users').select('*').eq('id',user.id).single().then(({data})=>setProfile(data));
    });
  },[]);
  const signOut = async () => {
    Alert.alert('Sign Out','Are you sure?',[
      {text:'Cancel',style:'cancel'},
      {text:'Sign Out',style:'destructive',onPress:()=>supabase.auth.signOut()},
    ]);
  };
  return (
    <ScrollView style={s.container} contentContainerStyle={{padding:20,gap:12}}>
      <Text style={s.title}>⚙️ Settings</Text>
      {profile&&(
        <View style={[s.card,{alignItems:'center',padding:24,gap:6}]}>
          <View style={{width:64,height:64,borderRadius:20,backgroundColor:'#f59e0b22',alignItems:'center',justifyContent:'center'}}>
            <Text style={{color:C.brand,fontWeight:'900',fontSize:26}}>{profile.full_name?.[0]?.toUpperCase()??'?'}</Text>
          </View>
          <Text style={[s.cardStore,{fontSize:20,marginTop:6}]}>{profile.full_name}</Text>
          <Text style={s.cardMeta}>{profile.email}</Text>
          <View style={{flexDirection:'row',gap:6,marginTop:4}}>
            <View style={{backgroundColor:'#f59e0b22',paddingHorizontal:10,paddingVertical:4,borderRadius:99}}>
              <Text style={{color:C.brand,fontSize:11,fontWeight:'700'}}>{profile.role}</Text>
            </View>
            {profile.is_verified&&(
              <View style={{backgroundColor:'#60a5fa22',paddingHorizontal:10,paddingVertical:4,borderRadius:99}}>
                <Text style={{color:'#60a5fa',fontSize:11,fontWeight:'700'}}>Verified</Text>
              </View>
            )}
          </View>
        </View>
      )}
      {[
        {label:'💰 Total Earned',   value:`$${profile?.total_earned?.toFixed(2)??'0.00'}`},
        {label:'📦 Total Purchases', value:profile?.total_purchases??0},
        {label:'⭐ Seller Rating',   value:`${profile?.seller_rating?.toFixed(1)??'0.0'} (${profile?.seller_rating_count??0} ratings)`},
        {label:'🛒 Total Sales',     value:profile?.total_sales??0},
      ].map(({label,value})=>(
        <View key={label} style={[s.card,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}>
          <Text style={{color:C.muted,fontSize:14}}>{label}</Text>
          <Text style={{color:C.text,fontWeight:'700',fontSize:14}}>{value}</Text>
        </View>
      ))}
      <TouchableOpacity style={[s.btnPrimary,{backgroundColor:'#ef444415',borderWidth:1,borderColor:'#ef444444',marginTop:8}]} onPress={signOut}>
        <Text style={[s.btnText,{color:'#f87171'}]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  {flex:1,backgroundColor:C.bg},
  content:    {padding:20,paddingTop:20},
  header:     {padding:16,paddingTop:60,backgroundColor:C.surface,borderBottomWidth:1,borderBottomColor:C.border},
  headerTitle:{color:C.text,fontSize:22,fontWeight:'900'},
  headerSub:  {color:C.muted,fontSize:13,marginTop:2},
  center:     {alignItems:'center',justifyContent:'center',flex:1,padding:20},
  card:       {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:16,padding:14},
  cardStore:  {color:C.text,fontWeight:'800',fontSize:16,marginBottom:2},
  cardMeta:   {color:C.muted,fontSize:12},
  stat:       {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:14,padding:12,alignItems:'center',gap:2},
  statVal:    {fontWeight:'900',fontSize:18},
  statLbl:    {color:C.muted,fontSize:10},
  banner:     {backgroundColor:'#f59e0b15',borderWidth:1,borderColor:'#f59e0b44',borderRadius:14,padding:14,alignItems:'center'},
  sectionTitle:{color:C.text,fontWeight:'800',fontSize:16,marginTop:4,marginBottom:4},
  label:      {color:C.muted,fontSize:11,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6},
  input:      {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:15},
  btnPrimary: {backgroundColor:C.brand,borderRadius:14,paddingVertical:16,alignItems:'center'},
  btnText:    {color:'#000',fontWeight:'800',fontSize:16},
  title:      {color:C.text,fontSize:26,fontWeight:'900',marginBottom:4},
  subtitle:   {color:C.muted,fontSize:14,marginBottom:20},
});
