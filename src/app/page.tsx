import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getSession,SESSION_COOKIE} from '@/server/auth';
export const dynamic='force-dynamic';
export default async function Home(){const token=(await cookies()).get(SESSION_COOKIE)?.value;const session=await getSession(token).catch(()=>null);if(!session)redirect('/login');return <main className="setup-screen"><h1>Moped Momos</h1><p>Signed in with the owner Google account.</p>{process.env.NATIVE_WEB_ORIGIN?<a href={process.env.NATIVE_WEB_ORIGIN}>Open Orders</a>:<p>Set the production Orders web URL to open your mobile counter.</p>}</main>;}
