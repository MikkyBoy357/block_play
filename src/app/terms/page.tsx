import Link from "next/link"
import { Gamepad2, ArrowLeft } from "lucide-react"

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/30">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to blockPlay</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: March 24, 2026</p>
          </div>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using blockPlay (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree to all the terms and conditions, you must not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years of age to participate in cash competitions on blockPlay. By creating an account, you represent and warrant that you meet this age requirement and that all registration information you submit is truthful, accurate, and complete.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use. blockPlay reserves the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Subscriptions & Payments</h2>
            <p className="text-muted-foreground leading-relaxed">
              blockPlay offers subscription plans (Weekly, Monthly, Yearly) that grant access to all games and eligibility for cash prizes. Subscriptions are billed in advance on a recurring basis. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period. No refunds are provided for partial billing periods.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Earnings & Payouts</h2>
            <p className="text-muted-foreground leading-relaxed">
              Players may earn cash prizes by achieving qualifying scores in games. Earnings are subject to weekly caps based on your subscription tier. Weekly earnings can never exceed the cost of your subscription plan. Prize pools are distributed every Monday. blockPlay reserves the right to withhold payouts pending verification of gameplay integrity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Fair Play & Anti-Cheat</h2>
            <p className="text-muted-foreground leading-relaxed">
              All gameplay must be performed by a human player without the use of automation, bots, scripts, or any form of cheating software. blockPlay employs server-side verification and reserves the right to disqualify scores, revoke earnings, and permanently ban accounts found to be in violation of fair play policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, games, graphics, logos, and software on the Platform are the intellectual property of blockPlay or its licensors. You are granted a limited, non-exclusive, non-transferable license to access and use the Platform for personal, non-commercial purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. User Conduct</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to: (a) use the Platform for any unlawful purpose; (b) attempt to gain unauthorized access to any part of the Platform; (c) harass, abuse, or harm other users; (d) upload malicious code or interfere with the Platform&apos;s operation; (e) create multiple accounts to circumvent earning caps or bans.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              blockPlay is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law, blockPlay shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform, including but not limited to loss of profits, data, or goodwill.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              blockPlay reserves the right to modify these Terms of Service at any time. Changes will be posted on this page with an updated revision date. Continued use of the Platform after changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which blockPlay operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">12. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact us at{" "}
              <span className="text-primary font-medium">support@blockplay.gg</span>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} blockPlay. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  )
}
