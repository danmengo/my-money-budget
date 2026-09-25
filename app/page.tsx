import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function Home(){
  const user=await getChatGPTUser();
  if(!user)return <main className="sign-in-page"><div className="sign-in-card"><div className="sign-in-mark">↗</div><h1>Your money, in one place.</h1><p>Sign in to see your budget, spending, savings, and investing goals.</p><a href={chatGPTSignInPath('/')} target="_top">Sign in with ChatGPT</a><small>Each account has its own private budget.</small></div></main>;
  return <DashboardClient displayName={user.displayName}/>;
}
