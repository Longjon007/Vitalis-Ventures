import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../core/state/projects-store';
import { useProjectStore } from '../core/state/project-store';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projectList, loading, loadProjectList, loadProject, deleteProject, duplicateProject, saveProject } =
    useProjectsStore();
  const currentProject = useProjectStore((s) => s.project);
  const createProject = useProjectStore((s) => s.createProject);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupId, setDupId] = useState<string | null>(null);

  useEffect(() => {
    loadProjectList();
  }, [loadProjectList]);

  // Save current project to IndexedDB whenever we visit
  useEffect(() => {
    if (currentProject) {
      saveProject(currentProject);
    }
  }, [currentProject, saveProject]);

  const handleLoad = async (id: string) => {
    const project = await loadProject(id);
    if (project) {
      useProjectStore.setState({ project });
      navigate('/music');
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProject(deleteId);
      setDeleteId(null);
    }
  };

  const handleDuplicate = async () => {
    if (dupId && dupName.trim()) {
      await duplicateProject(dupId, dupName.trim());
      setDupId(null);
      setDupName('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-forge-border bg-forge-surface shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Projects</h2>
          <Button size="sm" variant="primary" onClick={() => navigate('/builder')}>
            New Project
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center text-forge-muted py-12">Loading projects...</div>
        ) : projectList.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🎵</div>
            <h3 className="text-lg font-semibold mb-2">No saved projects</h3>
            <p className="text-forge-muted text-sm mb-6">
              Create your first project to get started.
            </p>
            <Button variant="primary" onClick={() => navigate('/builder')}>
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectList.map((p) => (
              <div
                key={p.id}
                className="bg-forge-surface border border-forge-border rounded-lg p-4 hover:border-forge-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    <p className="text-xs text-forge-muted mt-1">
                      {p.trackCount} tracks | {p.tempo} BPM
                    </p>
                  </div>
                  {currentProject?.id === p.id && (
                    <span className="text-[10px] bg-forge-accent/20 text-forge-accent px-2 py-0.5 rounded shrink-0 ml-2">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-forge-muted mb-3">
                  Updated {new Date(p.updatedAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => handleLoad(p.id)}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDupId(p.id);
                      setDupName(p.name + ' (copy)');
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(p.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Project">
        <p className="text-sm text-forge-muted mb-4">
          Are you sure you want to delete this project? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Duplicate dialog */}
      <Modal open={!!dupId} onClose={() => setDupId(null)} title="Duplicate Project">
        <div className="mb-4">
          <label className="text-xs text-forge-muted block mb-1">New name</label>
          <input
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
            className="w-full bg-forge-bg border border-forge-border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setDupId(null)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleDuplicate}>
            Duplicate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
