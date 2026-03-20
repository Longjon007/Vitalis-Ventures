import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

const FEATURES = [
  {
    title: 'MusicForge',
    description:
      'Multi-track composition with a canvas-based piano roll editor. Place notes, adjust pitch and duration, and hear your music in real time with our Tone.js audio engine.',
    icon: 'M',
    color: '#6c5ce7',
    highlights: ['Piano roll editor', 'Multi-track mixing', 'Real-time playback', 'MIDI & audio export'],
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
    title: 'Drum Sequencer',
    description:
      '16-step drum machine with 9 synthesized sounds. Load preset patterns or build your own beats from scratch with per-track mute and volume control.',
    icon: 'D',
    color: '#e17055',
    highlights: ['9 drum sounds', '16-step grid', 'Preset patterns', 'Per-track controls'],
  },
];

const STEPS = [
  { number: '01', title: 'Pick a Template', description: 'Choose from presets like Rock Band, Orchestra, or start blank.' },
  { number: '02', title: 'Compose & Tab', description: 'Use MusicForge for multi-track composition or TabForge for guitar tabs.' },
  { number: '03', title: 'Export & Share', description: 'Download as MIDI, audio, or ASCII tab. Your music, your way.' },
];

function LyreLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lyre-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4a853"/>
          <stop offset="50%" stopColor="#c9956b"/>
          <stop offset="100%" stopColor="#b8860b"/>
        </linearGradient>
      </defs>
      <path d="M20 34 L20 16" stroke="url(#lyre-gold)" strokeWidth="2" />
      <path d="M14 34 L26 34" stroke="url(#lyre-gold)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 34 Q10 22 13 12 Q16 7 20 6 Q24 7 27 12 Q30 22 26 34" stroke="url(#lyre-gold)" strokeWidth="1.8" />
      <line x1="16" y1="14" x2="16" y2="34" stroke="url(#lyre-gold)" strokeWidth="0.7" opacity="0.5"/>
      <line x1="20" y1="10" x2="20" y2="34" stroke="url(#lyre-gold)" strokeWidth="0.7" opacity="0.5"/>
      <line x1="24" y1="14" x2="24" y2="34" stroke="url(#lyre-gold)" strokeWidth="0.7" opacity="0.5"/>
      <path d="M14 16 Q20 12 26 16" stroke="url(#lyre-gold)" strokeWidth="1.4" />
    </svg>
  );
}

export { LyreLogo };

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-forge-bg text-forge-text overflow-auto">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <LyreLogo className="w-9 h-9" />
          <div>
            <span className="font-bold text-lg bg-gradient-to-r from-[#d4a853] to-[#b8860b] bg-clip-text text-transparent">
              Vitalis Ventures
            </span>
            <span className="text-forge-muted text-xs ml-2">MusicForge + TabForge</span>
          </div>
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
          <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')}>
            Pricing
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-20 pb-28 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#d4a853]/10 via-transparent to-forge-accent/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#d4a853]/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20 text-[#d4a853] text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a853] animate-pulse" />
            A Vitalis Ventures Product
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-[#d4a853] via-forge-accent to-forge-success bg-clip-text text-transparent">
              Compose. Tab. Create.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-forge-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            A complete music workstation in your browser. Multi-track composition with MusicForge,
            guitar tablature with TabForge, drum sequencing, effects processing, and MIDI export.
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
              className="bg-forge-surface border border-forge-border rounded-2xl p-6 hover:border-[#d4a853]/40 transition-colors group"
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
                    <span className="w-1 h-1 rounded-full bg-[#d4a853] shrink-0" />
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
                <div className="text-4xl font-bold text-[#d4a853]/30 mb-3">{step.number}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-forge-muted leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-[#d4a853]/10 to-forge-accent/5 border border-forge-border rounded-2xl p-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Make Music?</h2>
          <p className="text-forge-muted mb-6">
            No sign-up required. Your projects save locally in the browser.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/builder')}>
              Launch App Builder
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/pricing')}>
              View Plans
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-forge-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LyreLogo className="w-6 h-6" />
            <span className="text-sm bg-gradient-to-r from-[#d4a853] to-[#b8860b] bg-clip-text text-transparent font-semibold">
              Vitalis Ventures LLC
            </span>
            <span className="text-xs text-forge-muted">| MusicForge + TabForge</span>
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
            <button onClick={() => navigate('/drums')} className="hover:text-forge-text transition-colors">
              Drums
            </button>
            <button onClick={() => navigate('/store')} className="hover:text-forge-text transition-colors">
              Store
            </button>
          </div>
          <p className="text-xs text-forge-muted">Built with React, Tone.js & Tailwind</p>
        </div>
      </footer>
    </div>
  );
}
