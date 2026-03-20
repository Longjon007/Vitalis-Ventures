import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEMPLATES, ProjectTemplate } from './data/templates';
import { useProjectStore } from '../../core/state/project-store';
import { INSTRUMENTS, InstrumentDefinition } from '../../core/types/instrument';
import { TimeSignature } from '../../core/types/music';
import { Button } from '../../components/Button';

export function AppBuilder() {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  const existingProject = useProjectStore((s) => s.project);

  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [projectName, setProjectName] = useState('');
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>([4, 4]);
  const [key, setKey] = useState('C');
  const [tracks, setTracks] = useState<{ name: string; instrument: InstrumentDefinition }[]>([]);

  function selectTemplate(template: ProjectTemplate) {
    setSelectedTemplate(template);
    setProjectName(template.name + ' Project');
    setTempo(template.defaultTempo);
    setTimeSignature(template.defaultTimeSignature);
    setKey(template.defaultKey);
    setTracks([...template.tracks]);
  }

  function addTrack() {
    setTracks([...tracks, { name: `Track ${tracks.length + 1}`, instrument: INSTRUMENTS.synth }]);
  }

  function removeTrack(index: number) {
    setTracks(tracks.filter((_, i) => i !== index));
  }

  function updateTrackInstrument(index: number, instrumentId: string) {
    const updated = [...tracks];
    updated[index] = { ...updated[index], instrument: INSTRUMENTS[instrumentId] };
    setTracks(updated);
  }

  function updateTrackName(index: number, name: string) {
    const updated = [...tracks];
    updated[index] = { ...updated[index], name };
    setTracks(updated);
  }

  function handleCreate() {
    createProject({ name: projectName, tempo, timeSignature, key, tracks });
    navigate('/music');
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">App Builder</h1>
        <p className="text-forge-muted">
          Choose a template or configure a custom project setup
        </p>
      </div>

      {existingProject && (
        <div className="mb-6 p-4 bg-forge-accent/10 border border-forge-accent/30 rounded-lg">
          <p className="text-sm">
            Active project: <strong>{existingProject.name}</strong> ({existingProject.tracks.length} tracks)
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={() => navigate('/music')}>Open in MusicForge</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/tab')}>Open in TabForge</Button>
          </div>
        </div>
      )}

      {!selectedTemplate ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => selectTemplate(template)}
              className="p-6 bg-forge-surface border border-forge-border rounded-xl text-left hover:border-forge-accent transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-forge-accent/20 flex items-center justify-center text-xl font-bold text-forge-accent mb-4 group-hover:bg-forge-accent/30">
                {template.icon}
              </div>
              <h3 className="font-semibold mb-1">{template.name}</h3>
              <p className="text-sm text-forge-muted">{template.description}</p>
              <p className="text-xs text-forge-muted mt-2">
                {template.tracks.length} tracks | {template.defaultTempo} BPM
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedTemplate(null)}
            className="text-forge-muted hover:text-forge-text text-sm"
          >
            &larr; Back to templates
          </button>

          <div className="bg-forge-surface border border-forge-border rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Project Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-forge-muted mb-1">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-forge-muted mb-1">Tempo (BPM)</label>
                <input
                  type="number"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  min={20}
                  max={300}
                  className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-forge-muted mb-1">Time Signature</label>
                <select
                  value={`${timeSignature[0]}/${timeSignature[1]}`}
                  onChange={(e) => {
                    const [a, b] = e.target.value.split('/').map(Number);
                    setTimeSignature([a, b]);
                  }}
                  className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                  <option value="2/4">2/4</option>
                  <option value="5/4">5/4</option>
                  <option value="7/8">7/8</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-forge-muted mb-1">Key</label>
                <select
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2 text-sm"
                >
                  {['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Dm', 'Em'].map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-forge-surface border border-forge-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Tracks</h2>
              <Button size="sm" variant="secondary" onClick={addTrack}>+ Add Track</Button>
            </div>

            {tracks.length === 0 ? (
              <p className="text-sm text-forge-muted py-4 text-center">
                No tracks yet. Add a track to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {tracks.map((track, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-forge-bg rounded-lg"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: track.instrument.color }}
                    />
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => updateTrackName(i, e.target.value)}
                      className="flex-1 bg-transparent border-b border-transparent focus:border-forge-border text-sm outline-none"
                    />
                    <select
                      value={track.instrument.id}
                      onChange={(e) => updateTrackInstrument(i, e.target.value)}
                      className="bg-forge-surface border border-forge-border rounded px-2 py-1 text-sm"
                    >
                      {Object.values(INSTRUMENTS).map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeTrack(i)}
                      className="text-forge-muted hover:text-forge-danger text-sm"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={!projectName.trim()}>
              Create Project
            </Button>
            <Button variant="ghost" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
