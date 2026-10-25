import Kitchen from '@/components/kitchen';
export default async function KitchenPage({params}:{params:Promise<{token:string}>}) {const {token}=await params;return <Kitchen token={token}/>;}
