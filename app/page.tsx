export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
          NARIMATO
        </h1>
        <p className="text-xl mb-8 text-foreground/80">
          A real-time, card-based web application for dynamic image/text management and ranking
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="card p-6">
            <h2 className="text-2xl font-semibold mb-4">Image Cards</h2>
            <p className="text-foreground/70">
              Upload and manage images with our intuitive card system. Perfect for visual content organization.
            </p>
          </div>
          
          <div className="card p-6">
            <h2 className="text-2xl font-semibold mb-4">Text Cards</h2>
            <p className="text-foreground/70">
              Create and organize text-based cards. Ideal for notes, quotes, or any textual content.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="btn btn-primary">
            Start Creating
          </button>
          <button className="btn btn-secondary">
            Learn More
          </button>
        </div>
      </main>

      <footer className="mt-16 text-sm text-foreground/60">
        <p>© 2025 NARIMATO. All rights reserved.</p>
      </footer>
    </div>
  );
}
