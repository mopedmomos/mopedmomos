import * as ImagePicker from 'expo-image-picker';
import {manipulateAsync,SaveFormat} from 'expo-image-manipulator';
/** Embed an optimized copy so uploads survive app restarts and sync with the menu. */
export async function pickMenuPhoto():Promise<string|null>{
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false,quality:1,exif:false});
 if(result.canceled)return null;
 const asset=result.assets[0];
 for(const [maxSide,quality] of [[900,.75],[700,.55],[500,.4]] as const){
  const scale=Math.min(1,maxSide/Math.max(asset.width,asset.height));
  const photo=await manipulateAsync(asset.uri,[{resize:{width:Math.max(1,Math.round(asset.width*scale)),height:Math.max(1,Math.round(asset.height*scale))}}],{compress:quality,format:SaveFormat.JPEG,base64:true});
  if(photo.base64){const data='data:image/jpeg;base64,'+photo.base64;if(data.length<=350000)return data;}
 }
 throw new Error('This photo is too large. Choose a smaller photo and try again.');
}
