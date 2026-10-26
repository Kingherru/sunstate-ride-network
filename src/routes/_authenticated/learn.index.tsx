import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyEnrollments } from "@/lib/courses.functions";
import { Button } from "@/components/ui/button";
import { Award, BookOpen, CheckCircle2 } from "lucide-react";
import { TrainingTests } from '@/components/portal/TrainingTests';

export const Route = createFileRoute("/_authenticated/learn/")({
  head: () => ({ meta: [{ title: "My Training & Tests — MY FLORIDA NEMT" }, { name: 'description', content: 'Your training purchases, tests, progress and certificates.' }, { property: 'og:title', content: 'My Training & Tests — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Your personal learner area.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex" }] }),
  component: LearnIndex,
});

function LearnIndex() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="ds-section-title mb-6 text-ds-primary">Training & Tests</h1>
      <TrainingTests />
    </div>
  );
}
