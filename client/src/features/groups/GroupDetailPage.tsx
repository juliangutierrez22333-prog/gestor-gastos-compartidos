import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { errorMessage } from '../../api/client';
import * as groupsApi from '../../api/groups';
import { useAuth } from '../auth/auth-context';
import type { GroupDetail } from '../../types/api';

export function GroupDetailPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  // Cadena de promesas en lugar de async/await: el camino síncrono de la
  // función no toca estado, condición que exige react-hooks para efectos.
  const reload = useCallback(() => {
    return groupsApi
      .getGroup(groupId)
      .then((data) => {
        setDetail(data);
        setLoadError('');
      })
      .catch((err: unknown) => setLoadError(errorMessage(err)));
  }, [groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await groupsApi.addMember(groupId, memberEmail);
      setMemberEmail('');
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleRemoveMember(userId: number) {
    setError('');
    try {
      await groupsApi.removeMember(groupId, userId);
      // Si me fui yo, el grupo deja de ser accesible: vuelvo al listado.
      if (userId === user?.id) {
        await navigate('/');
        return;
      }
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loadError) {
    return (
      <section>
        <p className="error-message">{loadError}</p>
        <Link to="/">← Volver a mis grupos</Link>
      </section>
    );
  }

  if (!detail) {
    return <p className="status-message">Cargando grupo…</p>;
  }

  const soyCreador = user?.id === detail.group.createdBy;

  return (
    <section>
      <p>
        <Link to="/">← Mis grupos</Link>
      </p>
      <h1>{detail.group.name}</h1>

      <h2>Miembros ({detail.members.length})</h2>
      <ul className="member-list">
        {detail.members.map((member) => {
          const esCreador = member.id === detail.group.createdBy;
          const soyYo = member.id === user?.id;
          // El backend valida igual; esto solo evita mostrar botones inútiles.
          const puedoSacarlo = !esCreador && (soyYo || soyCreador);
          return (
            <li key={member.id}>
              <span>
                {member.name} {esCreador && <em className="tag">creador</em>}{' '}
                {soyYo && <em className="tag">vos</em>}
              </span>
              {puedoSacarlo && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void handleRemoveMember(member.id)}
                >
                  {soyYo ? 'Salir del grupo' : 'Quitar'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form className="inline-form" onSubmit={handleAddMember}>
        <input
          type="email"
          placeholder="Email de quien querés sumar"
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
          required
        />
        <button type="submit">Agregar miembro</button>
      </form>

      {error && <p className="error-message">{error}</p>}

      <p className="status-message">Los gastos y balances del grupo llegan en la próxima fase.</p>
    </section>
  );
}
