import type {Metadata,Viewport} from 'next';
import './globals.css';
import PWA from '@/components/pwa';
export const metadata:Metadata={title:'Moped Momos · Counter',description:'Private order counter and live kitchen display for Moped Momos.',manifest:'/manifest.webmanifest',robots:{index:false,follow:false},appleWebApp:{capable:true,title:'Moped Momos'},icons:{icon:'/icon-192.png',apple:'/icon-192.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#17221b'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}<PWA/></body></html>;}
