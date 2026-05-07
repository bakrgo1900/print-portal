import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Upload, CreditCard, Printer, ArrowRight, Shield, Zap, Clock } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Printer className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground tracking-tight">PrintPortal</span>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="text-sm">
              Admin Panel
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5" />
        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6 border border-accent-foreground/10">
              <Zap className="w-3 h-3" />
              Self-Service Printing Made Simple
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Print anything,{" "}
              <span className="text-primary">anywhere</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
              Scan the QR code at your nearest print station, upload your files, pay securely, and collect your prints — all in under two minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary/8 border border-primary/20 text-sm text-primary font-medium">
                <QrCode className="w-4 h-4" />
                Scan a QR code to begin
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-3">How it works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Four simple steps from scan to print. No app download required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: QrCode,
                step: "01",
                title: "Scan QR Code",
                desc: "Find the QR code at your print station and scan it with your phone camera.",
              },
              {
                icon: Upload,
                step: "02",
                title: "Upload Files",
                desc: "Upload PDFs, Word documents, or images. We count pages automatically.",
              },
              {
                icon: CreditCard,
                step: "03",
                title: "Review & Pay",
                desc: "Review your order summary with page counts, copies, and total cost.",
              },
              {
                icon: Printer,
                step: "04",
                title: "Collect Prints",
                desc: "Your documents print instantly. Collect them from the print station.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-accent-foreground" />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1 tracking-wider uppercase">
                          Step {item.step}
                        </div>
                        <h3 className="font-semibold text-foreground mb-1.5">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Secure & Private",
                desc: "Files are encrypted in transit and automatically deleted after printing.",
              },
              {
                icon: Zap,
                title: "Instant Processing",
                desc: "Page counts are detected automatically. No manual counting needed.",
              },
              {
                icon: Clock,
                title: "Real-Time Status",
                desc: "Track your print job status from pending to done in real time.",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-accent mx-auto mb-4 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Printer className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">PrintPortal</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Self-service printing portal — Scan, Upload, Pay, Print
          </p>
        </div>
      </footer>
    </div>
  );
}
