"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Database, MessageSquare, BarChart3, Download, Sparkles } from "lucide-react";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function HomePage() {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);

  // Refs for animation targets
  const logoRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const descRef = useRef(null);
  const ctaRef = useRef(null);
  const cardsRef = useRef(null);

  useGSAP(() => {
    // Initial timeline for staggered entrance
    const tl = gsap.timeline();

    // Hero animations
    tl.from(logoRef.current, {
      y: -20,
      opacity: 0,
      duration: 0.8,
      ease: "back.out(1.7)",
    })
      .from(titleRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      }, "-=0.4")
      .from(subtitleRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      }, "-=0.6")
      .from(descRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      }, "-=0.6")
      .from(ctaRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "back.out(1.7)",
      }, "-=0.6");

    // Feature cards stagger animation
    gsap.fromTo(".feature-card",
      {
        y: 50,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.5,
      }
    );

    // Continuous floating animation for logo
    gsap.to(logoRef.current, {
      y: -10,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 1,
    });

  }, { scope: container });

  const features = [
    {
      icon: Database,
      title: "Data Ingestion",
      description: "Upload CSV and Excel files with automatic parsing and validation",
    },
    {
      icon: MessageSquare,
      title: "Natural Language Queries",
      description: "Ask questions in plain English and get accurate answers",
    },
    {
      icon: BarChart3,
      title: "Visualizations",
      description: "Generate charts and graphs from your query results",
    },
    {
      icon: Download,
      title: "Export Anywhere",
      description: "Download your data and generated tables as CSV or Excel",
    },
  ];

  return (
    <div ref={container} className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-4xl">
          {/* Logo/Icon */}
          <div className="flex justify-center" ref={logoRef}>
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
              <Sparkles className="w-12 h-12 text-primary" />
            </div>
          </div>

          {/* Title */}
          <h1 ref={titleRef} className="text-5xl md:text-6xl font-bold text-foreground">
            Adminless
          </h1>

          {/* Subtitle */}
          <p ref={subtitleRef} className="text-xl md:text-2xl text-muted-foreground">
            Talk to Your Excel Sheets
          </p>

          {/* Description */}
          <p ref={descRef} className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your data, ask questions in natural language, and get instant insights.
            Powered by AI for seamless data analysis—no coding required.
          </p>

          {/* CTA Button */}
          <div ref={ctaRef} className="pt-4">
            <Button
              size="lg"
              onClick={() => router.push("/upload")}
              className="group"
            >
              <Sparkles className="mr-2 h-5 w-5 transition-transform group-hover:rotate-12" />
              Start Session
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div ref={cardsRef} className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="feature-card bg-card border-border hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardHeader className="pb-2">
                <feature.icon className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground border-t border-border">
        Built with Pydantic AI + E2B • Secure Sandboxed Execution
      </footer>
    </div>
  );
}
