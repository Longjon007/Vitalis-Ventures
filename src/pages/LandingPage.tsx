import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

const FEATURES = [
  {
    title: 'MusicForge',
    description:
      'Multi-track composition with a canvas-based piano roll editor. Place notes, adjust pitch and duration, and hear your music in real time with our Tone.js audio engine.',
    icon: 'M',
    color: '#6c5ce7',
    highlights: ['Piano roll editor', 'Multi-track mixing', 'Real-time playback', 'MIDI JSON export'],
  },
  {
    title: 'TabForge',
    description:
      'Guitar tablature editor with keyboard-driven input. Navigate a 6-string grid, insert chords from the built-in library, and export to standard ASCII tab format.',
    icon: 'T',
    color: '#00b894',
    highlights: ['6-string tab grid', '30+ chord shapes', 'Multiple tunings', 'Tab text export'],
  },
  {
    title: 'App Builder',
    description:
      'Start from scratch or pick a template — rock band, orchestra, solo guitar, electronic, and more. Configure instruments, tempo, key, and time signature in seconds.',
    icon: '+',
    color: '#fdcb6e',
    highlights: ['6 project templates', 'Custom instrument setup', 'Tempo & key config', 'Instant project creation'],
  },
];

const STEPS = [
  { number: '01', title: 'Pick a Template', description: 'Choose from presets like Rock Band, Orchestra, or start blank.' },
  { number: '02', title: 'Compose & Tab', description: 'Use MusicForge for multi-track composition or TabForge for guitar tabs.' },
  { number: '03', title: 'Export & Share', description: 'Download as MIDI JSON or ASCII tab text. Your music, your way.' },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-forge-bg text-forge-text overflow-auto">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-forge-accent flex items-center justify-center text-white font-bold text-sm">
            MF
          </div>
          <span className="font-bold text-lg">MusicForge</span>
          <span className="text-forge-muted text-sm ml-1">+ TabForge</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/builder')}>
            Builder
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/music')}>
            MusicForge
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tab')}>
            TabForge
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-20 pb-28 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forge-accent/20 via-transparent to-forge-success/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-forge-accent/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forge-accent/10 border border-forge-accent/20 text-forge-accent text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-accent animate-pulse" />
            Browser-based music creation
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-forge-accent via-purple-400 to-forge-success bg-clip-text text-transparent">
              Compose. Tab. Create.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-forge-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            A complete music workstation in your browser. Multi-track composition with MusicForge,
            guitar tablature with TabForge, and template-driven project setup with App Builder.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/builder')}>
              Get Started
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/music')}>
              Open MusicForge
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything You Need</h2>
          <p className="text-forge-muted text-lg max-w-xl mx-auto">
            Three powerful tools, one seamless workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-forge-surface border border-forge-border rounded-2xl p-6 hover:border-forge-accent/40 transition-colors group"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold mb-5 transition-transform group-hover:scale-110"
                style={{ backgroundColor: feature.color + '20', color: feature.color }}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-forge-muted text-sm leading-relaxed mb-4">{feature.description}</p>
              <ul className="space-y-1.5">
                {feature.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-xs text-forge-muted">
                    <span className="w-1 h-1 rounded-full bg-forge-accent shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 border-t border-forge-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">How It Works</h2>
            <p className="text-forge-muted text-lg">Three steps to your next track.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <div className="text-4xl font-bold text-forge-accent/30 mb-3">{step.number}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-forge-muted leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-forge-accent/10 to-forge-success/5 border border-forge-border rounded-2xl p-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Make Music?</h2>
          <p className="text-forge-muted mb-6">
            No sign-up required. Your projects save locally in the browser.
          </p>
          <Button size="lg" onClick={() => navigate('/builder')}>
            Launch App Builder
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-forge-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-forge-accent flex items-center justify-center text-white font-bold text-[10px]">
              MF
            </div>
            <span className="text-sm text-forge-muted">MusicForge + TabForge</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-forge-muted">
            <button onClick={() => navigate('/builder')} className="hover:text-forge-text transition-colors">
              Builder
            </button>
            <button onClick={() => navigate('/music')} className="hover:text-forge-text transition-colors">
              MusicForge
            </button>
            <button onClick={() => navigate('/tab')} className="hover:text-forge-text transition-colors">
              TabForge
            </button>
          </div>
          <p className="text-xs text-forge-muted">Built with React, Tone.js & Tailwind</p>
        </div>
      </footer>
    </div>
  );
}
