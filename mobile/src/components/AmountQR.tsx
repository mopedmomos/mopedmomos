import React,{useMemo} from 'react';
import Svg,{Path,Rect} from 'react-native-svg';
import QRCode from 'qrcode/lib/core/qrcode';
/** Local SVG rendering, with a four-module white quiet zone for reliable scanning. */
export function AmountQR({value,size=264}:{value:string;size?:number}){
 const {path,dimension}=useMemo(()=>{const qr=QRCode.create(value,{errorCorrectionLevel:'M'});const n=qr.modules.size;let path='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.modules.get(y,x))path+=`M${x+4},${y+4}h1v1h-1z`;return {path,dimension:n+8};},[value]);
 return <Svg testID="amount-payment-qr" accessibilityLabel="UPI QR with the exact amount to collect" width={size} height={size} viewBox={`0 0 ${dimension} ${dimension}`}><Rect width={dimension} height={dimension} fill="white"/><Path d={path} fill="#000000"/></Svg>;
}
