// mobile/src/screens/sell/SellScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../services/supabase';

const C = { bg:'#070c16', card:'#111827', border:'#1e293b', brand:'#f59e0b', text:'#f1f5f9', muted:'#64748b', green:'#4ade80' };
const SUGGESTED = ['1.99','3.99','6.99','12.99'];
const CATEGORIES = ['General','Electronics','Appliances','Hardware','Apparel','Grocery','Pharmacy','Wholesale'];

// ── Sell Home ─────────────────────────────────────────────────────────────────
export default function SellScreen({ navigation }: any) {
  const pick = async (src: 'camera'|'library') => {
    const r = src === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92 });
    if (!r.canceled) navigation.navigate('Scan', { imageUri: r.assets[0].uri });
  };
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>⚡ Sell a Receipt</Text>
      <Text style={s.subtitle}>Start earning in under 2 minutes</Text>
      {[
        { icon:'📷', title:'Take a Photo', sub:'Point camera at receipt', src:'camera' as const },
        { icon:'📂', title:'Upload from Library', sub:'JPEG, PNG, HEIC up to 20MB', src:'library' as const },
      ].map(({ icon, title, sub, src }) => (
        <TouchableOpacity key={src} style={[s.bigBtn, src==='library' && {marginTop:12}]} onPress={() => pick(src)} activeOpacity={0.85}>
          <Text style={s.bigBtnIcon}>{icon}</Text>
          <Text style={s.bigBtnTitle}>{title}</Text>
          <Text style={s.bigBtnSub}>{sub}</Text>
        </TouchableOpacity>
      ))}
      <View style={s.tipsCard}>
        <Text style={s.tipsTitle}>Tips for best results</Text>
        {['Lay flat on a dark surface','All text clearly visible','Full receipt top to bottom','Good lighting, no glare'].map(t=>(
          <Text key={t} style={s.tip}>✅  {t}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Scan Screen ───────────────────────────────────────────────────────────────
export function ScanScreen({ route, navigation }: any) {
  const { imageUri } = route.params;
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('Uploading...');
  const MSGS = ['Uploading...','Detecting store...','Extracting items...','Reading barcodes...','Fraud check...','Done!'];
  useEffect(() => {
    let p = 0, idx = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random()*10+4, 88);
      idx = Math.min(Math.floor(p/15), MSGS.length-1);
      setPct(p); setMsg(MSGS[idx]);
    }, 400);
    (async () => {
      try {
        const fd = new FormData();
        fd.append('file', { uri: imageUri, name: 'receipt.jpg', type: 'image/jpeg' } as any);
        const json = await api.scanReceipt(fd);
        clearInterval(iv); setPct(100); setMsg('Complete!');
        await new Promise(r => setTimeout(r, 600));
        if (!json?.data) throw new Error(json?.error ?? 'Scan failed');
        if (json.data.needs_manual_input) {
          navigation.replace('ManualReview', { receiptId: json.data.receipt_id, ocr: json.data.ocr });
        } else {
          navigation.replace('PriceReceipt', { receiptId: json.data.receipt_id });
        }
      } catch (e: any) {
        clearInterval(iv);
        Alert.alert('Scan Failed', e.message ?? 'Please try a clearer image.', [{ text:'OK', onPress:()=>navigation.goBack() }]);
      }
    })();
    return () => clearInterval(iv);
  }, []);
  return (
    <View style={[s.container,{alignItems:'center',justifyContent:'center',padding:32}]}>
      <Text style={{fontSize:64,marginBottom:24}}>🔍</Text>
      <Text style={[s.title,{textAlign:'center'}]}>Scanning...</Text>
      <Text style={[s.subtitle,{textAlign:'center',marginBottom:24}]}>{msg}</Text>
      <View style={{width:'100%',height:8,backgroundColor:C.card,borderRadius:99,overflow:'hidden',marginBottom:10}}>
        <View style={{width:`${Math.round(pct)}%`,height:'100%',backgroundColor:C.brand,borderRadius:99}} />
      </View>
      <Text style={{color:C.brand,fontWeight:'900',fontSize:24}}>{Math.round(pct)}%</Text>
    </View>
  );
}

// ── Manual Review Screen ──────────────────────────────────────────────────────
const FIELD_LABELS: Record<string,string> = {
  store_name:'Store Name', store_number:'Store Number', store_address:'Address',
  store_city:'City', store_state:'State (2-letter)', purchase_date:'Purchase Date (YYYY-MM-DD)',
  return_by_date:'Return By (YYYY-MM-DD)', total:'Total ($)', subtotal:'Subtotal ($)', tax:'Tax ($)',
};
export function ManualReviewScreen({ route, navigation }: any) {
  const { receiptId, ocr } = route.params;
  const [corrections, setCorrections] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const fields: string[] = ocr?.fields_needing_review ?? [];
  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateManualReview(receiptId, corrections);
      if (res?.data?.ready_to_list) {
        navigation.replace('PriceReceipt', { receiptId });
      } else {
        Alert.alert('Missing fields', 'Please fill in all highlighted fields.');
      }
    } catch { Alert.alert('Error', 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Review Required</Text>
      <Text style={s.subtitle}>Some fields need manual input:</Text>
      {fields.map(field => {
        const ocrField = ocr?.[field];
        return (
          <View key={field} style={{marginBottom:16}}>
            <Text style={s.label}>{FIELD_LABELS[field]??field} — {ocrField?.confidence??0}% confidence</Text>
            {ocrField?.value ? <Text style={{color:C.brand,fontSize:11,marginBottom:4}}>Extracted: "{ocrField.value}"</Text> : null}
            <TextInput
              defaultValue={ocrField?.value ?? ''}
              onChangeText={v => setCorrections(c=>({...c,[field]:v}))}
              style={s.input}
              placeholderTextColor={C.muted}
              placeholder={`Enter ${FIELD_LABELS[field]?.toLowerCase()??field}...`}
            />
          </View>
        );
      })}
      <TouchableOpacity style={s.btnPrimary} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#000"/> : <Text style={s.btnText}>Looks Good →</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Price Screen ──────────────────────────────────────────────────────────────
export function PriceScreen({ route, navigation }: any) {
  const { receiptId } = route.params;
  const [price,    setPrice]    = useState('');
  const [category, setCategory] = useState('General');
  const [listing,  setListing]  = useState(false);
  const num    = parseFloat(price) || 0;
  const payout = num * 0.90;
  const list = async () => {
    if (num < 0.99) { Alert.alert('Too low', 'Minimum price is $0.99'); return; }
    setListing(true);
    try {
      const json = await api.listReceipt(receiptId, num, category);
      const msg = json.data?.live
        ? '🎉 Listed! Your receipt is now live on the marketplace.'
        : '⏳ Under review — will go live within 24 hours.';
      Alert.alert('Success', msg, [{ text:'OK', onPress:()=>navigation.navigate('Dashboard') }]);
    } catch { Alert.alert('Error','Failed to list. Please try again.'); }
    finally { setListing(false); }
  };
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Set Your Price</Text>
      <Text style={s.subtitle}>Buyers pay this to unlock all items, UPCs & barcodes</Text>
      <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
        {SUGGESTED.map(p => (
          <TouchableOpacity key={p} onPress={()=>setPrice(p)}
            style={[s.chip, price===p && s.chipActive]}>
            <Text style={[s.chipText, price===p && {color:C.brand}]}>${p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>Custom Price ($)</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad"
        style={[s.input,{fontSize:28,fontWeight:'900',textAlign:'center'}]}
        placeholder="0.00" placeholderTextColor={C.muted} />
      <Text style={[s.label,{marginTop:16}]}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
        <View style={{flexDirection:'row',gap:8}}>
          {CATEGORIES.map(c=>(
            <TouchableOpacity key={c} onPress={()=>setCategory(c)}
              style={[s.chip, category===c && s.chipActive]}>
              <Text style={[s.chipText, category===c && {color:C.brand}]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {num > 0 && (
        <View style={[s.card,{marginBottom:16,gap:8}]}>
          {[['Listing price',`$${num.toFixed(2)}`,C.text],['Platform fee (10%)',`-$${(num*0.10).toFixed(2)}`,C.muted],['You receive',`$${payout.toFixed(2)}`,C.green]].map(([l,v,c])=>(
            <View key={l as string} style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={{color:C.muted,fontSize:14}}>{l}</Text>
              <Text style={{color:c as string,fontWeight:'700',fontSize:14}}>{v}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity style={[s.btnPrimary, num<0.99&&{opacity:0.4}]} onPress={list} disabled={listing||num<0.99}>
        {listing ? <ActivityIndicator color="#000"/> : <Text style={s.btnText}>⚡ List for ${num.toFixed(2)}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  {flex:1,backgroundColor:C.bg},
  content:    {padding:20,paddingTop:20},
  title:      {color:C.text,fontSize:26,fontWeight:'900',marginBottom:4},
  subtitle:   {color:C.muted,fontSize:14,marginBottom:20},
  bigBtn:     {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:18,padding:22,alignItems:'center',gap:6},
  bigBtnIcon: {fontSize:40,marginBottom:4},
  bigBtnTitle:{color:C.text,fontWeight:'800',fontSize:18},
  bigBtnSub:  {color:C.muted,fontSize:13},
  tipsCard:   {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:14,padding:16,marginTop:16,gap:8},
  tipsTitle:  {color:C.muted,fontWeight:'700',fontSize:11,textTransform:'uppercase',letterSpacing:0.5,marginBottom:4},
  tip:        {color:C.muted,fontSize:13},
  card:       {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:14,padding:14},
  label:      {color:C.muted,fontSize:11,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6},
  input:      {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:15,marginBottom:4},
  btnPrimary: {backgroundColor:C.brand,borderRadius:14,paddingVertical:16,alignItems:'center',marginTop:8},
  btnText:    {color:'#000',fontWeight:'800',fontSize:16},
  chip:       {backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:99,paddingHorizontal:14,paddingVertical:8,alignItems:'center'},
  chipActive: {borderColor:C.brand,backgroundColor:'#f59e0b15'},
  chipText:   {color:C.muted,fontWeight:'700',fontSize:14},
});
