import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Clock, Calendar, ChevronLeft } from "lucide-react";
import { getPostBySlug, getRelatedPosts, getAllSlugs, type Block, type Post } from "@/content/blog";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }) => {
    const post = getPostBySlug(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return {
        meta: [
          { title: "Article not found — My Florida NEMT" },
          { name: "description", content: "The article you requested could not be found." },
        ],
      };
    }
    const url = `/resources/${params.slug}`;
    return {
      meta: [
        { title: post.metaTitle },
        { name: "description", content: post.metaDescription },
        { name: "keywords", content: post.keywords.join(", ") },
        { name: "author", content: post.author },
        { property: "og:title", content: post.metaTitle },
        { property: "og:description", content: post.metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "article:published_time", content: post.publishedAt },
        { property: "article:section", content: post.category },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.metaTitle },
        { name: "twitter:description", content: post.metaDescription },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.metaDescription,
            datePublished: post.publishedAt,
            dateModified: post.publishedAt,
            author: { "@type": "Organization", name: post.author },
            publisher: {
              "@type": "Organization",
              name: "My Florida NEMT",
            },
            articleSection: post.category,
            keywords: post.keywords.join(", "),
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight mb-3">Article not found</h1>
      <p className="text-muted-foreground mb-6">The article you requested is no longer available.</p>
      <Link to="/resources" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
        <ChevronLeft className="size-4" /> Back to the blog
      </Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight mb-3">Something went wrong</h1>
      <p className="text-muted-foreground mb-6">{error.message}</p>
      <button onClick={reset} className="px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-bold uppercase tracking-widest">
        Try again
      </button>
    </div>
  ),
  component: ArticlePage,
});

const COVER_CLASS = "bg-primary";


function ArticlePage() {
  const { post } = Route.useLoaderData() as { post: Post };
  const related = getRelatedPosts(post.slug);


  return (
    <article className="pb-24">
      {/* Back link */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <Link to="/resources" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-accent">
          <ChevronLeft className="size-3.5" /> Back to Blog
        </Link>
      </div>

      {/* Cover */}
      <div className={"mt-6 " + COVER_CLASS}>
        <div className="max-w-3xl mx-auto px-6 py-14 lg:py-20 text-white">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-5 text-white/85">
            {post.category}
          </p>
          <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tighter leading-[1.02] mb-6">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono uppercase tracking-widest text-white/85">
            <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{formatDate(post.publishedAt)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{post.readMinutes} min read</span>
            <span>By {post.author}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{post.excerpt}</p>
        <div className="space-y-6">
          {post.body.map((b, i) => (
            <BlockRenderer key={i} block={b} />
          ))}
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 mt-20">
          <h2 className="text-2xl font-extrabold tracking-tight mb-6">Related resources</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {related.map((r) => (
              <Link
                key={r.slug}
                to="/resources/$slug"
                params={{ slug: r.slug }}
                className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-accent transition-colors"
              >
                <div className={"aspect-[16/9] " + COVER_CLASS} aria-hidden />
                <div className="p-5 flex flex-col gap-2 flex-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-accent font-bold">{r.category}</span>
                  <h3 className="text-base font-extrabold tracking-tight leading-tight">{r.title}</h3>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-primary pt-2">
                    Read <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.t) {
    case "h2":
      return <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight mt-10 mb-3 scroll-mt-24">{block.c}</h2>;
    case "h3":
      return <h3 className="text-xl font-extrabold tracking-tight mt-6 mb-2">{block.c}</h3>;
    case "p":
      return <p className="text-base leading-relaxed text-foreground/90">{block.c}</p>;
    case "ul":
      return (
        <ul className="list-disc pl-6 space-y-2 text-foreground/90">
          {block.items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pl-6 space-y-2 text-foreground/90">
          {block.items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-accent pl-5 py-2 italic text-foreground/85">
          "{block.c}"{block.cite && <footer className="mt-2 not-italic text-xs text-muted-foreground uppercase tracking-widest">— {block.cite}</footer>}
        </blockquote>
      );
    case "cta":
      return (
        <div className="my-8 rounded-2xl bg-primary text-primary-foreground p-8 lg:p-10">
          <h3 className="text-2xl font-extrabold tracking-tight mb-2">{block.heading}</h3>
          <p className="text-primary-foreground/85 mb-5">{block.body}</p>
          <Link
            to={block.to}
            className="inline-flex items-center gap-2 bg-accent text-primary px-6 py-3 rounded-md text-sm font-bold uppercase tracking-widest"
          >
            {block.label} <ArrowRight className="size-4" />
          </Link>
        </div>
      );
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Export slug list for potential build-time prerendering / sitemap consumers.
export const ALL_ARTICLE_SLUGS = getAllSlugs();
