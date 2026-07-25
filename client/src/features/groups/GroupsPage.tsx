import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { errorMessage } from '../../api/client';
import * as groupsApi from '../../api/groups';
import type { GroupSummary } from '../../types/api';

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void groupsApi
      .listGroups()
      .then((res) => setGroups(res.groups))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await groupsApi.createGroup(name);
      setGroups((prev) => [res.group, ...(prev ?? [])]);
      setName('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section>
      <h1>Mis grupos</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Nombre del grupo nuevo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Creando…' : 'Crear grupo'}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

      {groups === null ? (
        <p className="status-message">Cargando grupos…</p>
      ) : groups.length === 0 ? (
        <p className="status-message">Todavía no tenés grupos. Creá el primero arriba.</p>
      ) : (
        <ul className="card-list">
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={`/groups/${group.id}`} className="card-link">
                <span className="card-title">{group.name}</span>
                <span className="card-meta">
                  creado el {new Date(group.createdAt).toLocaleDateString('es')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
