import type { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for My Money.',
};

export default function PrivacyPage() {
  return <main className="privacy-page">
    <div className="privacy-shell">
      <a className="privacy-brand" href="/"><span className="auth-logo-icon"><TrendingUp size={20}/></span><span>my<span>money</span></span></a>
      <article className="privacy-card">
        <p className="eyebrow">PRIVACY</p>
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last updated September 25, 2026</p>

        <p>My Money is a personal budgeting application. This policy explains what information the app processes, why it is used, and the choices available to you.</p>

        <h2>Information you provide</h2>
        <p>When you use My Money, you may provide account information such as your email address and financial information that you enter into the app, including transactions, income, budgets, goals, categories, recurring items, savings, and investing entries. If you send feedback, the message is stored with your account so it can be reviewed in context.</p>

        <h2>Authentication</h2>
        <p>My Money uses Supabase Authentication for account access. If you choose Google sign-in, Google provides the account information needed to authenticate you. My Money does not receive your Google password.</p>

        <h2>How your information is used</h2>
        <p>Your information is used to provide the budgeting features you request, calculate budgets and analytics, maintain recurring items, preserve your account data across sessions, troubleshoot problems, and review feedback you submit.</p>

        <h2>Storage and security</h2>
        <p>Application data is stored in Supabase. Financial records are associated with your authenticated account and protected with database Row Level Security so signed-in users can access only records associated with their own account. The app uses a public Supabase browser key and does not expose a service-role key in the browser.</p>

        <h2>Sharing and selling</h2>
        <p>My Money does not sell your personal or financial information. Information may be processed by service providers that are necessary to operate the application, such as Supabase for authentication and database hosting, Google when you choose Google sign-in, and Cloudflare for application hosting and delivery.</p>

        <h2>Feedback</h2>
        <p>Feedback submitted through the app may include the message you write and the account that submitted it. Do not include passwords, authentication codes, bank credentials, or other secrets in feedback messages.</p>

        <h2>Data retention and deletion</h2>
        <p>Your budgeting data remains associated with your account while you use the service unless it is deleted through available app features or the underlying account/data is removed. Past transactions may remain when you end a recurring rule because preserving transaction history is part of the budgeting experience.</p>

        <h2>Your choices</h2>
        <p>You can edit or delete many records directly in My Money, pause or end recurring items, and choose whether to use Google or email authentication. You can also use the in-app feedback form for privacy questions or requests.</p>

        <h2>Financial information</h2>
        <p>My Money is a budgeting and tracking tool. It is not a bank, broker, investment adviser, tax adviser, or financial adviser. Information displayed by the app is based on the data you enter.</p>

        <h2>Changes to this policy</h2>
        <p>This policy may be updated as the application changes. The date at the top of this page will be updated when material changes are made.</p>

        <div className="privacy-actions"><a href="/">← Back to My Money</a></div>
      </article>
    </div>
  </main>;
}
