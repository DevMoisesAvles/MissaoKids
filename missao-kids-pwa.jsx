import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'missao-kids-data-v2';
const EMOJIS = ['🐯','🐶','🐱','🐼','🐸','🦊','🐵','🦁','🐰','🐨','🐢','🐧','🦉'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateFromV1();
    const parsed = JSON.parse(raw);
    return {
      children: Array.isArray(parsed.children) ? parsed.children : [],
      taskTemplates: Array.isArray(parsed.taskTemplates) ? parsed.taskTemplates : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
    };
  } catch {
    return { children: [], taskTemplates: [], tasks: [] };
  }
}

function migrateFromV1() {
  try {
    const raw = localStorage.getItem('missao-kids-data-v1');
    if (!raw) return { children: [], taskTemplates: [], tasks: [] };
    const parsed = JSON.parse(raw);
    const children = Array.isArray(parsed.children) ? parsed.children : [];
    const oldTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const taskTemplates = [];
    const tasks = oldTasks.map(t => {
      const tmpl = { id: uid(), name: t.name, description: t.description || '', xp: t.xp };
      taskTemplates.push(tmpl);
      return {
        id: t.id, templateId: tmpl.id, childId: t.childId,
        name: t.name, description: t.description || '', xp: t.xp,
        status: t.status || 'available', date: todayStr()
      };
    });
    return { children, taskTemplates, tasks };
  } catch {
    return { children: [], taskTemplates: [], tasks: [] };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateMathChallenge() {
  const a = Math.floor(Math.random() * 4) + 2;
  const b = Math.floor(Math.random() * 4) + 2;
  return { a, b, answer: a * b };
}

export default function MissaoKidsPWA() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState('welcome');
  const [parentTab, setParentTab] = useState('overview'); 
  const [currentChildId, setCurrentChildId] = useState(null);
  const [mathChallenge, setMathChallenge] = useState(null);
  const [mathInput, setMathInput] = useState('');
  const [mathError, setMathError] = useState('');
  const [modal, setModal] = useState(null); 
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => { saveData(data); }, [data]);

  function showToast(message, type = 'info') {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  
  function goWelcome() {
    setMathChallenge(null);
    setMathInput('');
    setMathError('');
    setView('welcome');
  }
  function goParentLogin() {
    setMathChallenge(generateMathChallenge());
    setMathInput('');
    setMathError('');
    setView('login-parent');
  }
  function goChildSelect() { setView('child-select'); }
  function selectChild(id) { setCurrentChildId(id); setView('child-dashboard'); }

  function checkMath() {
    const val = Number(mathInput);
    if (mathInput.trim() === '') {
      setMathError('Digite a resposta');
      return;
    }
    if (val === mathChallenge.answer) {
      setMathChallenge(null);
      setView('parent-dashboard');
    } else {
      setMathError('Resposta incorreta, tente de novo');
      setMathChallenge(generateMathChallenge());
      setMathInput('');
    }
  }

  
  function addChild(name, age) {
    const emoji = EMOJIS[data.children.length % EMOJIS.length];
    setData(d => ({
      ...d,
      children: [...d.children, { id: uid(), name: name.trim(), age: Number(age) || 0, emoji, xp: 0 }]
    }));
    showToast('Criança adicionada 🎉', 'success');
  }
  function updateChild(id, name, age) {
    setData(d => ({
      ...d,
      children: d.children.map(c => c.id === id ? { ...c, name: name.trim(), age: Number(age) || 0 } : c)
    }));
    showToast('Criança atualizada', 'success');
  }
  function deleteChild(id) {
    setData(d => ({
      ...d,
      children: d.children.filter(c => c.id !== id),
      tasks: d.tasks.filter(t => t.childId !== id)
    }));
    showToast('Criança removida', 'success');
  }

  
  function addTaskTemplate(name, description, xp) {
    setData(d => ({
      ...d,
      taskTemplates: [...d.taskTemplates, {
        id: uid(), name: name.trim(), description: (description || '').trim(),
        xp: Math.min(1000, Math.max(1, Number(xp) || 1))
      }]
    }));
    showToast('Tarefa cadastrada 🎉 Agora atribua às crianças', 'success');
  }
  function updateTaskTemplate(id, name, description, xp) {
    const cleanName = name.trim();
    const cleanDesc = (description || '').trim();
    const cleanXp = Math.min(1000, Math.max(1, Number(xp) || 1));
    setData(d => ({
      ...d,
      taskTemplates: d.taskTemplates.map(t => t.id === id ? { ...t, name: cleanName, description: cleanDesc, xp: cleanXp } : t),
      // sincroniza instâncias ainda disponíveis (não altera as já enviadas/concluídas)
      tasks: d.tasks.map(t => (t.templateId === id && t.status === 'available')
        ? { ...t, name: cleanName, description: cleanDesc, xp: cleanXp }
        : t)
    }));
    showToast('Tarefa atualizada', 'success');
  }
  function deleteTaskTemplate(id) {
    setData(d => ({
      ...d,
      taskTemplates: d.taskTemplates.filter(t => t.id !== id),
      tasks: d.tasks.filter(t => t.templateId !== id)
    }));
    showToast('Tarefa removida do catálogo', 'success');
  }

 
  function getAssignedChildIdsForTemplate(templateId) {
    return data.tasks.filter(t => t.templateId === templateId).map(t => t.childId);
  }
  function toggleAssignment(templateId, childId) {
    const tmpl = data.taskTemplates.find(t => t.id === templateId);
    if (!tmpl) return;
    setData(d => {
      const existing = d.tasks.find(t => t.templateId === templateId && t.childId === childId);
      if (existing) {
        return { ...d, tasks: d.tasks.filter(t => t !== existing) };
      }
      return {
        ...d,
        tasks: [...d.tasks, {
          id: uid(), templateId, childId,
          name: tmpl.name, description: tmpl.description, xp: tmpl.xp,
          status: 'available', date: todayStr()
        }]
      };
    });
  }

  
  function setTaskStatus(id, status) {
    setData(d => {
      const tasks = d.tasks.map(t => t.id === id ? { ...t, status } : t);
      let children = d.children;
      if (status === 'done') {
        const t = d.tasks.find(t => t.id === id);
        if (t) children = children.map(c => c.id === t.childId ? { ...c, xp: c.xp + t.xp } : c);
      }
      return { ...d, children, tasks };
    });
  }
  function rejectTask(id) {
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, status: 'available' } : t) }));
    showToast('Tarefa devolvida para a criança', 'info');
  }

  
  function reassignAllTasks() {
    const date = todayStr();
    setData(d => ({ ...d, tasks: d.tasks.map(t => ({ ...t, status: 'available', date })) }));
    showToast('Tarefas reatribuídas para o dia 🔄', 'success');
  }
  function resetAllXp() {
    setData(d => ({ ...d, children: d.children.map(c => ({ ...c, xp: 0 })) }));
    showToast('XP de todas as crianças foi zerado', 'success');
  }

  
  function openModal(m) { setModal(m); }
  function closeModal() { setModal(null); }

  return (
    <div style={styles.appWrapper}>
      <style>{globalCss}</style>
      <div style={styles.app}>
        {view === 'welcome' && (
          <Welcome onParent={goParentLogin} onChild={goChildSelect} />
        )}
        {view === 'login-parent' && (
          <ParentLogin
            challenge={mathChallenge}
            value={mathInput}
            error={mathError}
            onChange={setMathInput}
            onSubmit={checkMath}
            onBack={goWelcome}
          />
        )}
        {view === 'parent-dashboard' && (
          <ParentDashboard
            data={data}
            tab={parentTab}
            onTabChange={setParentTab}
            onBack={goWelcome}
            onAddChild={() => openModal({ type: 'child', mode: 'add', payload: { name: '', age: '' } })}
            onEditChild={(c) => openModal({ type: 'child', mode: 'edit', payload: c })}
            onDeleteChild={(id) => {
              const c = data.children.find(c => c.id === id);
              if (c) {
                openModal({
                  type: 'confirm',
                  title: 'Excluir criança?',
                  message: `Excluir ${c.name} e todas as suas tarefas atribuídas? Essa ação não pode ser desfeita.`,
                  onConfirm: () => deleteChild(id)
                });
              }
            }}
            onAddTaskTemplate={() => openModal({ type: 'task-template', mode: 'add', payload: { name: '', description: '', xp: 50 } })}
            onEditTaskTemplate={(t) => openModal({ type: 'task-template', mode: 'edit', payload: t })}
            onDeleteTaskTemplate={(id) => {
              const t = data.taskTemplates.find(t => t.id === id);
              openModal({
                type: 'confirm',
                title: 'Excluir tarefa?',
                message: `Excluir "${t ? t.name : 'esta tarefa'}" do catálogo? Ela será removida de todas as crianças. Essa ação não pode ser desfeita.`,
                onConfirm: () => deleteTaskTemplate(id)
              });
            }}
            getAssignedChildIdsForTemplate={getAssignedChildIdsForTemplate}
            onToggleAssign={toggleAssignment}
            onApprove={(id) => { setTaskStatus(id, 'done'); showToast('Tarefa aprovada! XP creditado 🎉', 'success'); }}
            onReject={rejectTask}
            onReassignTasks={() => openModal({
              type: 'confirm',
              title: 'Reatribuir tarefas do dia?',
              message: 'Todas as tarefas (concluídas ou aguardando aprovação) voltarão para "Disponível", para que as crianças possam realizá-las novamente hoje.',
              confirmLabel: '🔄 Reatribuir',
              onConfirm: reassignAllTasks
            })}
            onResetAllXp={() => openModal({
              type: 'confirm',
              title: 'Zerar XP de todas as crianças?',
              message: 'O placar de XP de todas as crianças voltará para 0. Essa ação não pode ser desfeita.',
              confirmLabel: '⚠️ Zerar XP',
              onConfirm: resetAllXp
            })}
          />
        )}
        {view === 'child-select' && (
          <ChildSelect data={data} onBack={goWelcome} onSelect={selectChild} />
        )}
        {view === 'child-dashboard' && (
          <ChildDashboard
            data={data}
            childId={currentChildId}
            onBack={goChildSelect}
            onMarkReady={(id) => { setTaskStatus(id, 'pending'); showToast('Enviado para aprovação! ⏳', 'success'); }}
          />
        )}

        {modal && (
          <Modal
            modal={modal}
            data={data}
            onClose={closeModal}
            onSaveChild={(mode, id, name, age) => {
              if (!name.trim()) { showToast('Digite o nome da criança', 'error'); return; }
              if (mode === 'edit') updateChild(id, name, age); else addChild(name, age);
              closeModal();
            }}
            onSaveTaskTemplate={(mode, id, name, desc, xp) => {
              if (!name.trim()) { showToast('Digite o nome da tarefa', 'error'); return; }
              if (mode === 'edit') updateTaskTemplate(id, name, desc, xp); else addTaskTemplate(name, desc, xp);
              closeModal();
            }}
          />
        )}

        {toast && (
          <div style={{ ...styles.toast, ...(styles.toastTypes[toast.type] || {}) }}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}


function Welcome({ onParent, onChild }) {
  return (
    <div style={{ ...styles.screen, ...styles.welcomeScreen }}>
      <div style={styles.logoBadge}>🎮</div>
      <div>
        <h1 style={styles.welcomeTitle}>Missão Kids</h1>
        <p style={{ ...styles.welcomeSubtitle, marginTop: 10 }}>
          Tarefas viram missões, missões viram pontos XP. Quem vai entrar?
        </p>
      </div>
      <div style={styles.roleButtons}>
        <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnBlock }} onClick={onParent}>
          👨‍👩‍👧 Acesso Pai
        </button>
        <button style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnBlock }} onClick={onChild}>
          🧒 Acesso Criança
        </button>
      </div>
    </div>
  );
}

function ParentLogin({ challenge, value, error, onChange, onSubmit, onBack }) {
  if (!challenge) return null;
  return (
    <div style={{ ...styles.screen, ...styles.loginScreen }}>
      <div style={{ ...styles.logoBadge, width: 80, height: 80, fontSize: 40 }}>🔐</div>
      <h2 style={{ fontSize: 22, color: '#6d28d9', fontFamily: "'Fredoka', sans-serif" }}>Área dos Pais</h2>
      <p style={styles.welcomeSubtitle}>Resolva a continha para entrar</p>
      <div style={styles.mathCard}>
        <div style={styles.mathQuestion}>{challenge.a} × {challenge.b} = ?</div>
        <input
          type="number"
          inputMode="numeric"
          style={styles.mathInput}
          placeholder="?"
          value={value}
          autoFocus
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
        />
        <div style={styles.mathError}>{error}</div>
        <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnBlock }} onClick={onSubmit}>Entrar</button>
      </div>
      <button style={{ ...styles.btn, ...styles.btnGhost, ...styles.btnBlock }} onClick={onBack}>← Voltar</button>
    </div>
  );
}

function ParentDashboard({
  data, tab, onTabChange, onBack,
  onAddChild, onEditChild, onDeleteChild,
  onAddTaskTemplate, onEditTaskTemplate, onDeleteTaskTemplate,
  getAssignedChildIdsForTemplate, onToggleAssign,
  onApprove, onReject, onReassignTasks, onResetAllXp
}) {
  const { children, tasks, taskTemplates } = data;
  const pending = tasks.filter(t => t.status === 'pending');
  const totalXp = children.reduce((sum, c) => sum + c.xp, 0);

  return (
    <>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.topbarTitle}>👨‍👩‍👧 Painel dos Pais</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={styles.tabbar}>
        <button style={{ ...styles.tabBtn, ...(tab === 'overview' ? styles.tabBtnActive : {}) }} onClick={() => onTabChange('overview')}>📋 Visão Geral</button>
        <button style={{ ...styles.tabBtn, ...(tab === 'children' ? styles.tabBtnActive : {}) }} onClick={() => onTabChange('children')}>👧👦 Crianças</button>
        <button style={{ ...styles.tabBtn, ...(tab === 'tasks' ? styles.tabBtnActive : {}) }} onClick={() => onTabChange('tasks')}>📝 Tarefas</button>
      </div>

      <div style={styles.content}>
        {tab === 'overview' && (
          <>
            <div style={styles.summaryRow}>
              <SummaryCard num={children.length} label="Crianças" />
              <SummaryCard num={taskTemplates.length} label="Tarefas" />
              <SummaryCard num={totalXp} label="XP total" />
            </div>

            <div style={styles.sectionTitle}>⏳ Aguardando aprovação {pending.length ? `(${pending.length})` : ''}</div>
            {pending.length === 0 ? (
              <EmptyState emoji="📭" title="Nada para aprovar" text="Quando uma criança marcar uma tarefa como pronta, ela aparece aqui." small />
            ) : pending.map(t => {
              const child = children.find(c => c.id === t.childId);
              return (
                <div key={t.id} style={{ ...styles.taskRow, borderLeftColor: '#fbbf24' }}>
                  <div style={styles.taskInfo}>
                    <div style={styles.taskName}>{t.name}</div>
                    <div style={styles.taskDesc}>{t.description}</div>
                    <div style={styles.taskMeta}>
                      <span style={{ ...styles.badge, ...styles.badgeXp }}>⭐ {t.xp} XP</span>
                      <span style={{ ...styles.badge, ...styles.badgePending }}>{child ? `${child.emoji} ${child.name}` : '—'}</span>
                    </div>
                  </div>
                  <div style={styles.taskActions}>
                    <button style={{ ...styles.iconBtn, background: '#d1fae5', color: '#059669' }} onClick={() => onApprove(t.id)} title="Aprovar">✅</button>
                    <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => onReject(t.id)} title="Rejeitar">❌</button>
                  </div>
                </div>
              );
            })}

            <div style={styles.sectionTitle}>⚙️ Ações</div>
            <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnBlock }} onClick={onResetAllXp}>⚠️ Zerar XP de Todas as Crianças</button>
              <p style={{ fontSize: 12, color: '#6b6890', marginTop: -4 }}>Zera o placar de XP de todas as crianças. Essa ação não pode ser desfeita.</p>
            </div>
          </>
        )}

        {tab === 'children' && (
          <>
            {children.length === 0 ? (
              <EmptyState emoji="👶" title="Nenhuma criança cadastrada" text='Toque em "Adicionar Criança" para começar.' />
            ) : children.map(c => {
              const childTasks = tasks.filter(t => t.childId === c.id);
              return (
                <div key={c.id} style={styles.childRow}>
                  <div style={styles.avatar}>{c.emoji}</div>
                  <div style={styles.taskInfo}>
                    <div style={styles.taskName}>{c.name}</div>
                    <div style={styles.taskMetaText}>{c.age} anos · ⭐ {c.xp} XP · {childTasks.length} tarefa(s) atribuída(s)</div>
                  </div>
                  <div style={styles.taskActions}>
                    <button style={styles.iconBtn} onClick={() => onEditChild(c)} title="Editar">✏️</button>
                    <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => onDeleteChild(c.id)} title="Excluir">🗑️</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'tasks' && (
          <>
            <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={{ ...styles.btn, ...styles.btnOutline, ...styles.btnBlock }} onClick={onReassignTasks}>🔄 Reatribuir Tarefas do Dia</button>
              <p style={{ fontSize: 12, color: '#6b6890', marginTop: -4 }}>Volta todas as tarefas para "Disponível", para começar um novo dia.</p>
            </div>
            {taskTemplates.length === 0 ? (
              <EmptyState emoji="📝" title="Nenhuma tarefa cadastrada" text="Cadastre uma tarefa diária e depois é só atribuir às crianças." />
            ) : taskTemplates.map(tmpl => {
              const assignedIds = getAssignedChildIdsForTemplate(tmpl.id);
              return (
                <div key={tmpl.id} style={styles.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={styles.taskInfo}>
                      <div style={styles.taskName}>{tmpl.name}</div>
                      <div style={styles.taskDesc}>{tmpl.description}</div>
                      <div style={styles.taskMeta}>
                        <span style={{ ...styles.badge, ...styles.badgeXp }}>⭐ {tmpl.xp} XP</span>
                        <span style={{ ...styles.badge, ...styles.badgeDaily }}>🔁 Diária</span>
                        {assignedIds.length > 0 && <span style={{ color: '#6b6890' }}>{assignedIds.length} atribuída(s)</span>}
                      </div>
                    </div>
                    <div style={styles.taskActions}>
                      <button style={styles.iconBtn} onClick={() => onEditTaskTemplate(tmpl)} title="Editar">✏️</button>
                      <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => onDeleteTaskTemplate(tmpl.id)} title="Excluir">🗑️</button>
                    </div>
                  </div>
                  <div style={{ ...styles.sectionTitle, margin: '14px 0 0', fontSize: 13 }}>Atribuir para:</div>
                  <div style={styles.assigneeList}>
                    {children.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#6b6890' }}>Cadastre crianças para poder atribuir.</p>
                    ) : children.map(c => {
                      const isAssigned = assignedIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          style={{ ...styles.assigneeChip, ...(isAssigned ? styles.assigneeChipAssigned : {}) }}
                          onClick={() => onToggleAssign(tmpl.id, c.id)}
                        >
                          <span>{isAssigned ? '✅' : '⬜'}</span>
                          <span>{c.emoji} {c.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {tab === 'children' && (
        <div style={styles.fabWrap}>
          <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnBlock, pointerEvents: 'all' }} onClick={onAddChild}>
            ➕ Adicionar Criança
          </button>
        </div>
      )}
      {tab === 'tasks' && (
        <div style={styles.fabWrap}>
          <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnBlock, pointerEvents: 'all' }} onClick={onAddTaskTemplate}>
            ➕ Cadastrar Tarefa
          </button>
        </div>
      )}
    </>
  );
}

function ChildSelect({ data, onBack, onSelect }) {
  const { children } = data;
  return (
    <>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.topbarTitle}>🧒 Quem é você?</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={styles.content}>
        {children.length === 0 ? (
          <EmptyState emoji="👶" title="Nenhuma criança cadastrada" text="Peça para um adulto entrar na Área dos Pais e cadastrar você!" />
        ) : (
          <div style={styles.childGrid}>
            {children.map(c => (
              <div key={c.id} style={styles.childTile} onClick={() => onSelect(c.id)}>
                <span style={styles.childEmoji}>{c.emoji}</span>
                <div style={styles.childName}>{c.name}</div>
                <div style={styles.childXp}>⭐ {c.xp} XP</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ChildDashboard({ data, childId, onBack, onMarkReady }) {
  const child = data.children.find(c => c.id === childId);
  if (!child) return null;
  const myTasks = data.tasks.filter(t => t.childId === child.id);
  const available = myTasks.filter(t => t.status === 'available');
  const pending = myTasks.filter(t => t.status === 'pending');
  const done = myTasks.filter(t => t.status === 'done');

  function TaskCard({ t }) {
    const borderColor = t.status === 'done' ? '#34d399' : t.status === 'pending' ? '#fbbf24' : '#8b5cf6';
    let action;
    if (t.status === 'available') {
      action = <button style={{ ...styles.btn, ...styles.btnSuccess, ...styles.btnSm }} onClick={() => onMarkReady(t.id)}>Marcar como Pronta</button>;
    } else if (t.status === 'pending') {
      action = <span style={{ ...styles.badge, ...styles.badgePending }}>⏳ Aguardando aprovação</span>;
    } else {
      action = <span style={{ ...styles.badge, ...styles.badgeDone }}>✅ Concluída</span>;
    }
    return (
      <div style={{ ...styles.taskRow, borderLeftColor: borderColor, flexDirection: 'column', alignItems: 'stretch', opacity: t.status === 'done' ? 0.75 : 1 }}>
        <div style={styles.taskInfo}>
          <div style={styles.taskName}>{t.name}</div>
          <div style={styles.taskDesc}>{t.description}</div>
          <div style={styles.taskMeta}>
            <span style={{ ...styles.badge, ...styles.badgeXp }}>⭐ {t.xp} XP</span>
            <span style={{ ...styles.badge, ...styles.badgeDaily }}>🔁 Diária</span>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>{action}</div>
      </div>
    );
  }

  return (
    <>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.topbarTitle}>{child.emoji} {child.name}</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={styles.content}>
        <div style={styles.xpBanner}>
          <div style={styles.childGreeting}>Oi, {child.name}! {child.emoji}</div>
          <div style={styles.bigNum}>{child.xp}</div>
          <div style={styles.smallLabel}>Pontos XP</div>
        </div>

        {myTasks.length === 0 ? (
          <EmptyState emoji="🎉" title="Nenhuma missão por aqui" text="Quando seus pais atribuírem tarefas, elas aparecem aqui!" />
        ) : (
          <>
            {available.length > 0 && (
              <>
                <div style={styles.sectionTitle}>🟢 Disponíveis</div>
                {available.map(t => <TaskCard key={t.id} t={t} />)}
              </>
            )}
            {pending.length > 0 && (
              <>
                <div style={styles.sectionTitle}>⏳ Aguardando aprovação</div>
                {pending.map(t => <TaskCard key={t.id} t={t} />)}
              </>
            )}
            {done.length > 0 && (
              <>
                <div style={styles.sectionTitle}>✅ Concluídas</div>
                {done.map(t => <TaskCard key={t.id} t={t} />)}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}


function SummaryCard({ num, label }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryNum}>{num}</div>
      <div style={styles.summaryLabel}>{label}</div>
    </div>
  );
}

function EmptyState({ emoji, title, text, small }) {
  return (
    <div style={{ ...styles.emptyState, ...(small ? { padding: '24px 20px' } : {}) }}>
      <span style={styles.emptyEmoji}>{emoji}</span>
      <h3 style={styles.emptyTitle}>{title}</h3>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function Modal({ modal, data, onClose, onSaveChild, onSaveTaskTemplate }) {
  const { type, mode, payload } = modal;

 
  const [name, setName] = useState(payload?.name || '');
  const [age, setAge] = useState(payload?.age || '');
  const [description, setDescription] = useState(payload?.description || '');
  const [xp, setXp] = useState(payload?.xp ?? 50);

  if (type === 'child') {
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHandle} />
          <h2 style={styles.modalTitle}>{mode === 'edit' ? '✏️ Editar Criança' : '➕ Adicionar Criança'}</h2>
          <div style={styles.field}>
            <label style={styles.label}>Nome</label>
            <input style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João" maxLength={30} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Idade</label>
            <input style={styles.input} type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex: 8" min={1} max={18} />
          </div>
          <div style={styles.modalActions}>
            <button style={{ ...styles.btn, ...styles.btnGhost, ...styles.btnBlock }} onClick={onClose}>Cancelar</button>
            <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnBlock }} onClick={() => onSaveChild(mode, payload?.id, name, age)}>Salvar</button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'task-template') {
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHandle} />
          <h2 style={styles.modalTitle}>{mode === 'edit' ? '✏️ Editar Tarefa' : '➕ Cadastrar Tarefa'}</h2>
          <div style={styles.field}>
            <label style={styles.label}>Nome da tarefa</label>
            <input style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lavar louça" maxLength={40} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Descrição (opcional)</label>
            <textarea style={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Lavar todos os pratos depois do jantar" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>XP (1 - 1000)</label>
            <div style={styles.rangeRow}>
              <input type="range" min={1} max={1000} step={1} value={xp} onChange={e => setXp(Number(e.target.value))} style={{ flex: 1, accentColor: '#8b5cf6' }} />
              <div style={styles.xpPill}>{xp} XP</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#6b6890', marginBottom: 6 }}>
            💡 Depois de salvar, atribua esta tarefa às crianças na aba "Tarefas".
          </p>
          <div style={styles.modalActions}>
            <button style={{ ...styles.btn, ...styles.btnGhost, ...styles.btnBlock }} onClick={onClose}>Cancelar</button>
            <button style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnBlock }} onClick={() => onSaveTaskTemplate(mode, payload?.id, name, description, xp)}>Salvar</button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'confirm') {
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHandle} />
          <h2 style={styles.modalTitle}>{modal.title || 'Confirmar'}</h2>
          <p style={{ color: '#6b6890', fontSize: 15, lineHeight: 1.5, marginBottom: 6 }}>{modal.message || ''}</p>
          <div style={styles.modalActions}>
            <button style={{ ...styles.btn, ...styles.btnGhost, ...styles.btnBlock }} onClick={onClose}>Cancelar</button>
            <button
              style={{ ...styles.btn, ...styles.btnBlock, background: 'linear-gradient(135deg, #f87171, #fca5a5)', color: '#fff', boxShadow: '0 6px 16px rgba(248,113,113,0.3)' }}
              onClick={() => { modal.onConfirm?.(); onClose(); }}
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}



const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Baloo+2:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 0; height: 0; }
`;

const colors = {
  purple: '#8b5cf6',
  purpleDark: '#6d28d9',
  pink: '#f472b6',
  yellow: '#fbbf24',
  green: '#34d399',
  red: '#f87171',
  text: '#2d2a4a',
  textSoft: '#6b6890',
  shadow: '0 4px 20px rgba(139, 92, 246, 0.15)'
};

const styles = {
  appWrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #fce7f3 100%)',
    fontFamily: "'Baloo 2', sans-serif",
    color: colors.text,
    display: 'flex',
    justifyContent: 'center'
  },
  app: {
    width: '100%',
    maxWidth: 480,
    minHeight: '100vh',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column'
  },
  screen: { flex: 1, display: 'flex', flexDirection: 'column', padding: 24 },
  welcomeScreen: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 28, padding: '40px 24px' },
  loginScreen: { justifyContent: 'center', alignItems: 'center', gap: 22, textAlign: 'center' },
  logoBadge: {
    width: 120, height: 120, borderRadius: 32,
    background: `linear-gradient(135deg, ${colors.purple}, ${colors.pink})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 60, boxShadow: '0 12px 30px rgba(139,92,246,0.35)'
  },
  welcomeTitle: {
    fontSize: 36, fontWeight: 700, fontFamily: "'Fredoka', sans-serif",
    background: `linear-gradient(135deg, ${colors.purpleDark}, ${colors.pink})`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px'
  },
  welcomeSubtitle: { color: colors.textSoft, fontSize: 16, maxWidth: 280, lineHeight: 1.5, margin: '0 auto' },
  roleButtons: { display: 'flex', flexDirection: 'column', gap: 14, width: '100%', marginTop: 12 },

  btn: {
    border: 'none', borderRadius: 18, padding: '16px 22px', fontFamily: "'Fredoka', sans-serif",
    fontSize: 17, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10
  },
  btnPrimary: { background: `linear-gradient(135deg, ${colors.purple}, #a78bfa)`, color: '#fff', boxShadow: '0 6px 16px rgba(139,92,246,0.35)' },
  btnSecondary: { background: `linear-gradient(135deg, ${colors.pink}, #fb7185)`, color: '#fff', boxShadow: '0 6px 16px rgba(244,114,182,0.35)' },
  btnGhost: { background: '#fff', color: colors.purpleDark, border: '2px solid #e9e4fc' },
  btnSuccess: { background: `linear-gradient(135deg, ${colors.green}, #6ee7b7)`, color: '#fff', boxShadow: '0 6px 16px rgba(52,211,153,0.35)' },
  btnOutline: { background: '#fff', color: colors.purple, border: `2px solid ${colors.purple}` },
  btnDanger: { background: `linear-gradient(135deg, ${colors.red}, #fca5a5)`, color: '#fff', boxShadow: '0 6px 16px rgba(248,113,113,0.3)' },
  btnBlock: { width: '100%' },
  btnSm: { padding: '10px 16px', fontSize: 14, borderRadius: 12 },

  mathCard: {
    background: '#fff', borderRadius: 24, padding: '32px 24px', boxShadow: colors.shadow,
    width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18
  },
  mathQuestion: { fontSize: 38, fontWeight: 700, fontFamily: "'Fredoka', sans-serif", color: colors.purpleDark, letterSpacing: '1px' },
  mathInput: {
    width: 140, textAlign: 'center', fontSize: 28, fontFamily: "'Fredoka', sans-serif", fontWeight: 600,
    padding: 12, borderRadius: 16, border: '3px solid #e9e4fc', color: colors.text, outline: 'none'
  },
  mathError: { color: colors.red, fontSize: 14, fontWeight: 600, minHeight: 20 },

  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px',
    background: '#fff', boxShadow: '0 2px 10px rgba(139,92,246,0.06)', position: 'sticky', top: 0, zIndex: 10
  },
  topbarTitle: { fontSize: 20, fontWeight: 700, color: colors.purpleDark, fontFamily: "'Fredoka', sans-serif", display: 'flex', alignItems: 'center', gap: 8 },
  backBtn: {
    background: 'none', border: 'none', fontSize: 22, color: colors.purpleDark, cursor: 'pointer',
    width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12
  },

  tabbar: {
    display: 'flex', gap: 8, padding: '14px 20px', position: 'sticky', top: 74,
    background: 'linear-gradient(180deg, #fff 60%, rgba(255,255,255,0))', zIndex: 9
  },
  tabBtn: {
    flex: 1, border: 'none', background: '#f3f0ff', color: colors.textSoft, fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600, fontSize: 14, padding: '11px 8px', borderRadius: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
  },
  tabBtnActive: {
    background: `linear-gradient(135deg, ${colors.purple}, #a78bfa)`, color: '#fff', boxShadow: '0 4px 12px rgba(139,92,246,0.3)'
  },

  content: { flex: 1, padding: 20, overflowY: 'auto', paddingBottom: 100 },

  card: { background: '#fff', borderRadius: 20, padding: 18, boxShadow: colors.shadow, marginBottom: 14 },

  summaryRow: { display: 'flex', gap: 12, marginBottom: 18 },
  summaryCard: { flex: 1, background: '#fff', borderRadius: 16, padding: 14, textAlign: 'center', boxShadow: colors.shadow },
  summaryNum: { fontFamily: "'Fredoka', sans-serif", fontSize: 24, fontWeight: 700, color: colors.purpleDark },
  summaryLabel: { fontSize: 12, color: colors.textSoft, marginTop: 2 },

  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, margin: '22px 0 12px', display: 'flex', alignItems: 'center', gap: 8 },

  emptyState: { textAlign: 'center', padding: '50px 20px', color: colors.textSoft },
  emptyEmoji: { fontSize: 48, display: 'block', marginBottom: 14 },
  emptyTitle: { color: colors.text, marginBottom: 6, fontSize: 18, fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
  emptyText: { fontSize: 14, lineHeight: 1.5, margin: 0 },

  childRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, boxShadow: colors.shadow },
  avatar: { width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ede9fe, #fce7f3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },

  taskRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, boxShadow: colors.shadow, borderLeft: '5px solid #8b5cf6' },
  taskInfo: { flex: 1, minWidth: 0 },
  taskName: { fontWeight: 700, fontFamily: "'Fredoka', sans-serif", fontSize: 15 },
  taskDesc: { fontSize: 13, color: colors.textSoft, marginTop: 2, lineHeight: 1.4 },
  taskMeta: { fontSize: 12, color: colors.textSoft, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  taskMetaText: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  taskActions: { display: 'flex', flexDirection: 'column', gap: 6 },

  badge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 10, fontFamily: "'Fredoka', sans-serif" },
  badgeXp: { background: '#fef3c7', color: '#92400e' },
  badgePending: { background: '#fef9c3', color: '#854d0e' },
  badgeDone: { background: '#d1fae5', color: '#065f46' },
  badgeAvailable: { background: '#ede9fe', color: colors.purpleDark },
  badgeDaily: { background: '#dbeafe', color: '#1d4ed8' },

  iconBtn: { width: 38, height: 38, borderRadius: 12, border: 'none', background: '#f3f0ff', color: colors.purpleDark, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  iconBtnDanger: { background: '#fee2e2', color: '#dc2626' },

  childGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  childTile: { background: '#fff', borderRadius: 20, padding: '22px 14px', textAlign: 'center', boxShadow: colors.shadow, cursor: 'pointer' },
  childEmoji: { fontSize: 46, display: 'block', marginBottom: 8 },
  childName: { fontWeight: 700, fontFamily: "'Fredoka', sans-serif", fontSize: 16 },
  childXp: { color: colors.textSoft, fontSize: 13, marginTop: 4 },

  assigneeList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  assigneeChip: {
    display: 'flex', alignItems: 'center', gap: 6, background: '#f3f0ff', borderRadius: 12, padding: '8px 12px',
    cursor: 'pointer', border: '2px solid transparent', fontFamily: "'Fredoka', sans-serif", fontWeight: 600,
    fontSize: 13, color: colors.text, userSelect: 'none'
  },
  assigneeChipAssigned: { background: '#ede9fe', borderColor: colors.purple, color: colors.purpleDark },

  xpBanner: { background: `linear-gradient(135deg, ${colors.purple}, ${colors.pink})`, borderRadius: 22, padding: 22, color: '#fff', textAlign: 'center', boxShadow: '0 10px 24px rgba(139,92,246,0.35)', marginBottom: 20 },
  bigNum: { fontFamily: "'Fredoka', sans-serif", fontSize: 42, fontWeight: 700, lineHeight: 1 },
  smallLabel: { fontSize: 13, opacity: 0.9, marginTop: 4, letterSpacing: '1px', textTransform: 'uppercase' },
  childGreeting: { fontSize: 16, marginBottom: 6, fontWeight: 600 },

  fabWrap: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '0 20px', zIndex: 50, pointerEvents: 'none' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(45,42,74,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: '24px 24px 0 0', padding: 24, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' },
  modalHandle: { width: 40, height: 4, background: '#e9e4fc', borderRadius: 4, margin: '0 auto 18px' },
  modalTitle: { fontSize: 20, marginBottom: 18, color: colors.purpleDark, fontFamily: "'Fredoka', sans-serif" },
  modalActions: { display: 'flex', gap: 10, marginTop: 6 },

  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: colors.textSoft, marginBottom: 6 },
  input: { width: '100%', padding: '13px 14px', borderRadius: 14, border: '2px solid #e9e4fc', fontFamily: "'Baloo 2', sans-serif", fontSize: 15, color: colors.text, outline: 'none', background: '#fcfbff' },
  textarea: { width: '100%', padding: '13px 14px', borderRadius: 14, border: '2px solid #e9e4fc', fontFamily: "'Baloo 2', sans-serif", fontSize: 15, color: colors.text, outline: 'none', background: '#fcfbff', minHeight: 70, resize: 'vertical' },
  rangeRow: { display: 'flex', alignItems: 'center', gap: 12 },
  xpPill: { background: `linear-gradient(135deg, ${colors.yellow}, #fcd34d)`, color: '#92400e', fontWeight: 700, fontFamily: "'Fredoka', sans-serif", padding: '8px 14px', borderRadius: 12, fontSize: 15, minWidth: 78, textAlign: 'center' },

  toast: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: colors.text, color: '#fff',
    padding: '14px 22px', borderRadius: 16, fontSize: 14, fontWeight: 600, fontFamily: "'Fredoka', sans-serif",
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 200, maxWidth: '90%', textAlign: 'center'
  },
  toastTypes: {
    success: { background: 'linear-gradient(135deg, #10b981, #34d399)' },
    error: { background: 'linear-gradient(135deg, #ef4444, #f87171)' }
  }
};
