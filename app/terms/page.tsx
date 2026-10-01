import type { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms for using My Money, including account responsibilities, budgeting information, and control of your data.',
};

export default function TermsPage() {
  return <main className="privacy-page terms-page">
    <div className="privacy-shell">
      <Link className="privacy-brand" href="/" aria-label="My Money home"><span className="auth-logo-icon"><TrendingUp size={20} aria-hidden="true"/></span><span>my<span>money</span></span></Link>
      <article className="privacy-card">
        <p className="eyebrow">TERMS</p>
        <h1>Terms of Use</h1>
        <p className="privacy-updated">Effective October 1, 2026</p>

        <p>These terms govern your use of My Money at budget.danmengo.com. By using My Money, you agree to these terms. If you do not agree, do not use the service.</p>

        <h2>A budgeting and tracking tool</h2>
        <p>My Money helps you record transactions, plan budgets, track recurring items and goals, and review your finances. Saving, investing, and surplus allocation actions record amounts in your budget; they do not transfer money, pay bills, buy investments, or open financial accounts.</p>

        <h2>No financial advice or guaranteed results</h2>
        <p>My Money is not a bank, broker, or financial, investment, tax, or legal adviser. Its calculations, charts, and summaries are informational tools, not personalized advice or recommendations to buy or sell investments. Using My Money does not guarantee savings, investment returns, debt reduction, or any other financial outcome. You remain responsible for your financial decisions.</p>

        <h2>Your entries and decisions</h2>
        <p>You are responsible for the accuracy and completeness of the information you enter. Review dates, amounts, categories, recurring schedules, and calculations before relying on them. Records in My Money may differ from your bank or investment statements. Keep your own copies of important records and verify actual balances, payments, and obligations with the relevant provider.</p>

        <h2>Your account</h2>
        <p>Use an email address or Google account you are authorized to access. Keep access to that account secure and do not share sign-in codes or sessions. You are responsible for activity you authorize through your account. Do not enter bank passwords, payment-card security codes, or other credentials into transactions, notes, or feedback.</p>

        <h2>Your data and privacy</h2>
        <p>You retain ownership of the information you enter. You allow My Money and the service providers needed to operate it to store and process that information to provide the features you use. This permission does not transfer ownership of your data. The <Link href="/privacy">Privacy Policy</Link> explains how information is handled.</p>
        <p>You can export your data from Settings and edit or delete records using the available controls. You can delete your account through Settings to remove the account and its associated budgeting records from the app. Export anything you want to keep before deletion; account deletion cannot be undone through My Money. Ending a recurring item preserves past transactions, and resetting budget limits does not delete transaction history.</p>

        <h2>Acceptable use</h2>
        <p>Use My Money lawfully and only with information you have permission to provide. Do not attempt to access another person&apos;s account or data, bypass access controls, upload malicious content, or disrupt the service. Access may be restricted when reasonably necessary to address misuse, protect users, or comply with legal obligations. These terms do not restrict honest reviews or lawful reports of concerns.</p>

        <h2>Availability and limitations</h2>
        <p>My Money may experience errors, interruptions, or changes as it develops. To the extent permitted by law, the service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis, without a promise of uninterrupted operation or error-free results. Nothing in these terms excludes rights, remedies, warranties, or responsibilities that cannot lawfully be excluded.</p>

        <h2>Changes to these terms</h2>
        <p>Updates will be posted on this page with a revised effective date. Where required by law, material changes will receive additional notice or require your agreement before they apply. If you do not agree with updated terms, you may stop using My Money and export or delete your account data.</p>

        <h2>Questions</h2>
        <p>For questions about these terms, sign in and choose Send feedback from the account menu or Settings. Do not include passwords, sign-in codes, or bank credentials in your message.</p>

        <nav className="privacy-actions legal-links" aria-label="Legal page navigation">
          <Link href="/">← Back to My Money</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </nav>
      </article>
    </div>
  </main>;
}
