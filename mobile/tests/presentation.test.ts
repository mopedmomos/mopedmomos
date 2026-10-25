import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesMenuTab,menuTabs,preparationName} from '../src/lib/presentation';
import {seedMenu} from './fixtures/menu';
test('Peri Peri contains only regular peri peri momos',()=>{assert.deepEqual(seedMenu.filter(o=>matchesMenuTab(o,'Peri Peri')).map(o=>o.id),['chicken-peri-6']);});
test('peri combinations and classic preparations have separate tabs',()=>{assert.deepEqual(seedMenu.filter(o=>matchesMenuTab(o,'Kurkure + Peri Peri')).map(o=>o.id),['chicken-kurkure-peri-3','chicken-kurkure-peri-6']);assert.deepEqual(seedMenu.filter(o=>matchesMenuTab(o,'Sides + Peri Peri')).map(o=>o.id),['potato-twister-peri','french-fries-peri']);assert.ok(seedMenu.filter(o=>matchesMenuTab(o,'Kurkure')).every(o=>!o.variant.includes('Peri')));assert.ok(seedMenu.filter(o=>matchesMenuTab(o,'Sides')).every(o=>o.variant==='Classic'));});
test('every menu option has exactly one preparation tab',()=>{for(const o of seedMenu)assert.equal(menuTabs.filter(t=>t!=='All'&&matchesMenuTab(o,t)).length,1,o.id);});
test('kitchen highlights preparation instead of generic chicken label',()=>{assert.equal(preparationName({name:'Chicken Momos',variant:'Steamed'}),'Steamed');assert.equal(preparationName({name:'Chicken Momos',variant:'Kurkure + Peri Peri'}),'Kurkure + Peri Peri');assert.equal(preparationName({name:'French Fries',variant:'Peri Peri (+₹10)'}),'French Fries + Peri Peri');assert.equal(preparationName({name:'Special Mojito',variant:'Chilled'}),'Special Mojito');});

test('kitchen cards follow menu options and count plates without a combined card',async()=>{
 const {kitchenPlateCounts}=await import('../src/lib/presentation');
 const {kitchenMenu,filterKitchenOrders}=await import('../src/lib/domain');
 const custom={...seedMenu[0],id:'paneer-steam',productId:'paneer',name:'Paneer Momos',portion:'Full plate'};
 const menu=kitchenMenu([...seedMenu,custom]);
 const order={id:'x',sequence:1,businessDate:'2026-10-25',type:'takeaway' as const,status:'pending' as const,note:'',createdAt:0,updatedAt:0,version:1,items:[{optionId:'chicken-kurkure-6',name:'Chicken Momos',variant:'Kurkure',portion:'Full plate',pieces:6,quantity:2,note:'',serviceType:'dine-in' as const},{optionId:'chicken-kurkure-3',name:'Chicken Momos',variant:'Kurkure',portion:'Half plate',pieces:3,quantity:1,note:'',serviceType:'takeaway' as const},{optionId:'special-mojito',name:'Special Mojito',variant:'Chilled',portion:'Regular',pieces:null,quantity:2,note:'',serviceType:'takeaway' as const}]};
 const counts=kitchenPlateCounts([order],menu);
 assert.equal(counts.rows.length,3);assert.equal(counts.rows.some(r=>r.id==='paneer-steam'),false);
 assert.equal(counts.rows.every(r=>r.quantity>0),true);
 assert.equal(counts.rows.find(r=>r.id==='chicken-kurkure-6')?.quantity,2);
 assert.equal(counts.rows.find(r=>r.id==='chicken-kurkure-3')?.quantity,1);
 assert.equal(counts.rows.find(r=>r.id==='chicken-kurkure-6')?.dineIn,2);
 assert.equal(counts.rows.find(r=>r.id==='chicken-kurkure-3')?.parcel,1);
 assert.equal(counts.totalPlates,3);assert.equal(counts.totalDrinks,2);
 assert.equal(counts.rows.some(r=>r.label==='Total plates'),false);assert.equal('pieces' in counts.rows[0],false);
 const dine=kitchenPlateCounts(filterKitchenOrders([order],'dine-in'),menu);assert.equal(dine.totalPlates,2);assert.equal(dine.rows.length,1);assert.equal(dine.rows[0].id,'chicken-kurkure-6');
 assert.equal(kitchenPlateCounts([{...order,status:'ready'}],menu).totalPlates,3);
 const served=kitchenPlateCounts([{...order,status:'completed'},{...order,status:'cancelled'}],menu);assert.equal(served.totalPlates,0);assert.equal(served.rows.length,0);assert.equal(kitchenPlateCounts([],menu).rows.length,0);
 // Sold-out items stay visible while ordered; no hard-coded ghost rows without menu.
 assert.equal(kitchenPlateCounts([order],menu.map(m=>({...m,available:false}))).rows.length,3);
 assert.equal(kitchenPlateCounts([],[]).rows.length,0);
});
